// furniture-editor.js — Furniture Editor Core
// Spawn GLB items, gumball edit, sessionStorage cache, undo/redo

import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { FURNITURE_CONFIG as C } from './furniture-config.js';

const _gltfLoader = new GLTFLoader();
const _dracoLoader = new DRACOLoader();
_dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
_gltfLoader.setDRACOLoader(_dracoLoader);
_gltfLoader.setMeshoptDecoder(MeshoptDecoder);

// ---- Module-level helpers (no `this` needed) ----

/** Dispose geometry + materials of a 3D object (deep traverse) */
function disposeObject(obj) {
    obj.traverse(c => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
            (Array.isArray(c.material) ? c.material : [c.material]).forEach(m => m.dispose());
        }
    });
}

/** Tag root's userData + all descendants as furniture (clipping-exempt) */
function tagAsFurniture(root, extraUserData = {}, isPreset = false) {
    Object.assign(root.userData, extraUserData);
    root.traverse(child => {
        child.userData._isFurniture = true;
        if (isPreset) child.userData._isPreset = true;
    });
}

/** Load GLB → returns Promise<THREE.Group> */
function loadGLB(url) {
    return new Promise((resolve, reject) => {
        _gltfLoader.load(url, gltf => resolve(gltf.scene), undefined, reject);
    });
}

export class FurnitureEditor {
    constructor(threeScene, camera, renderer, orbitControls, sceneIndex = 0) {
        this.scene = threeScene;
        this.camera = camera;
        this.renderer = renderer;
        this.orbitControls = orbitControls;
        this.sceneIndex = sceneIndex;

        this._items = [];
        this._selected = null;
        this._prevScale = 1;
        this._gizmoDragging = false;
        this._recentlyDragged = false;
        this._active = false;
        this._cacheLoaded = false;
        this._cacheLoadPromise = null;
        this._presets = [];

        // Undo/redo
        this._undoStack = [];
        this._redoStack = [];
        this._maxHistory = C.undoHistoryMax;
        this._restoringSnapshot = false;

        this.onChange = null;
        this.onError = null;  // ({ type, message }) => void — quota/storage/load errors

        this._setupTransformControls();
    }

    // ---- PUBLIC API ----

    async spawnItem(libraryItem, position) {
        await this.ready();
        const pos = position || { x: 0, y: 0, z: 0 };
        let root;
        try {
            root = await loadGLB(libraryItem.url);
        } catch (e) {
            if (this.onError) this.onError({ type: 'load', message: 'Mobilya yüklenemedi: ' + libraryItem.name, error: e });
            throw e;
        }
        root.position.set(pos.x, 0, pos.z);
        tagAsFurniture(root, {
            _furnitureId: libraryItem.id,
            _furnitureName: libraryItem.name,
            _furnitureUrl: libraryItem.url
        });
        this.scene.add(root);

        const placed = this._makePlacedItem(libraryItem.id, libraryItem.url, libraryItem.name, root);
        this._items.push(placed);
        this.selectItem(placed);
        this._pushUndo();
        this.saveToCache();
        this._notifyChange();
        return placed;
    }

    selectItem(placed) {
        if (!placed) { this.deselectItem(); return; }
        this._selected = placed;
        // Reset uniform scale tracker to the newly selected item's scale
        this._prevScale = placed.threeObject.scale.x;
        this._transformControls.attach(placed.threeObject);
        this._transformControls.visible = true;
        this._transformControls.enabled = true;
    }

    deselectItem() {
        this._selected = null;
        this._transformControls.detach();
        this._transformControls.visible = false;
        this._transformControls.enabled = false;
    }

    deleteSelected() {
        if (!this._selected) return;
        this._pushUndo();
        this._removeItemObject(this._selected);
        this._selected = null;
        this.saveToCache();
        this._notifyChange();
    }

    removeItem(placed) {
        if (!placed) return;
        this._pushUndo();
        if (this._selected === placed) this.deselectItem();
        this._removeItemObject(placed);
        this.saveToCache();
        this._notifyChange();
    }

    get placedItems() { return this._items; }
    get selected() { return this._selected; }
    get isDragging() { return this._gizmoDragging; }
    get wasRecentlyDragging() { return this._recentlyDragged; }
    get itemCount() { return this._items.length; }
    get active() { return this._active; }

    setMode(mode) {
        this._transformControls.setMode(mode);
    }

    activate() {
        this._active = true;
        this._transformControls.camera = this.camera;
        if (this._selected) {
            this._transformControls.visible = true;
            this._transformControls.enabled = true;
        }
    }

    deactivate() {
        this._active = false;
        this._transformControls.detach();
        this._transformControls.visible = false;
        this._transformControls.enabled = false;
        this._selected = null;
        if (this.orbitControls) this.orbitControls.enabled = true;
    }

    clearAll() {
        this._pushUndo();
        while (this._items.length > 0) {
            this._removeItemObject(this._items[0]);
        }
        this.deselectItem();
        try { sessionStorage.removeItem(this._cacheKey); } catch (_) {}
        this._notifyChange();
    }

    // ---- UNDO / REDO ----

    _pushUndo() {
        if (this._restoringSnapshot) return;
        this._undoStack.push(this._takeSnapshot());
        if (this._undoStack.length > this._maxHistory) this._undoStack.shift();
        this._redoStack = [];
    }

    _takeSnapshot() {
        return {
            items: this._items.map(i => ({
                id: i.id, url: i.url, name: i.name,
                pos: { x: i.threeObject.position.x, y: i.threeObject.position.y, z: i.threeObject.position.z },
                rot: { x: i.threeObject.rotation.x, y: i.threeObject.rotation.y, z: i.threeObject.rotation.z },
                scale: { x: i.threeObject.scale.x, y: i.threeObject.scale.y, z: i.threeObject.scale.z }
            })),
            presets: this._presets.map(p => ({
                id: p.id, name: p.name, url: p.threeObject.userData._presetUrl
            }))
        };
    }

    async _restoreSnapshot(snapshot) {
        this._restoringSnapshot = true;
        this.deselectItem();

        // Clear current scene state
        for (const item of this._items) {
            this.scene.remove(item.threeObject);
            disposeObject(item.threeObject);
        }
        this._items = [];
        for (const p of this._presets) {
            this.scene.remove(p.threeObject);
            disposeObject(p.threeObject);
        }
        this._presets = [];

        // Rebuild from snapshot
        for (const entry of snapshot.items || []) {
            await this._spawnItemFromEntry(entry);
        }
        for (const entry of snapshot.presets || []) {
            await this._loadPresetFromEntry(entry);
        }

        this.saveToCache();
        this._savePresetCache();
        this._restoringSnapshot = false;
        this._notifyChange();
    }

    async undo() {
        if (this._undoStack.length === 0) return;
        this._redoStack.push(this._takeSnapshot());
        const snapshot = this._undoStack.pop();
        await this._restoreSnapshot(snapshot);
    }

    async redo() {
        if (this._redoStack.length === 0) return;
        this._undoStack.push(this._takeSnapshot());
        const snapshot = this._redoStack.pop();
        await this._restoreSnapshot(snapshot);
    }

    get canUndo() { return this._undoStack.length > 0; }
    get canRedo() { return this._redoStack.length > 0; }

    // ---- SESSION CACHE ----

    /** Cache key — shared across all scenes using same interior model */
    get _cacheKey() { return this._customCacheKey || `vea-furniture-${this.sceneIndex}`; }
    set cacheKey(key) { this._customCacheKey = key; }
    get _presetCacheKey() { return this._cacheKey + '-presets'; }

    saveToCache() {
        const data = this._items.map(i => ({
            id: i.id, url: i.url, name: i.name,
            pos: i.position, rot: i.rotation, scale: i.scale
        }));
        this._safeSetItem(this._cacheKey, JSON.stringify(data));
        this._savePresetCache();
    }

    _savePresetCache() {
        const data = this._presets.map(p => ({ id: p.id, name: p.name, url: p.threeObject.userData._presetUrl }));
        this._safeSetItem(this._presetCacheKey, JSON.stringify(data));
    }

    /** sessionStorage.setItem with quota-exceeded detection → onError callback */
    _safeSetItem(key, value) {
        try {
            sessionStorage.setItem(key, value);
        } catch (e) {
            if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
                if (this.onError) this.onError({ type: 'quota', message: 'Cache dolu — yerleştirilmiş mobilyalar geçici olarak kaydedilemiyor.' });
            } else {
                if (this.onError) this.onError({ type: 'storage', message: 'Cache kaydedilemedi: ' + (e?.message || e) });
            }
        }
    }

    /** Wait until initial cache load has finished (no-op if not loading) */
    async ready() {
        if (this._cacheLoadPromise) await this._cacheLoadPromise;
    }

    async loadFromCache() {
        if (this._cacheLoadPromise) return this._cacheLoadPromise;
        this._cacheLoadPromise = this._doLoadFromCache();
        await this._cacheLoadPromise;
        this._cacheLoaded = true;
    }

    async _doLoadFromCache() {
        // Load presets first
        try {
            const presetRaw = sessionStorage.getItem(this._presetCacheKey);
            if (presetRaw) {
                const presetData = JSON.parse(presetRaw);
                if (Array.isArray(presetData)) {
                    for (const p of presetData) {
                        if (!this.isPresetLoaded(p.id)) {
                            await this._loadPresetFromEntry(p);
                        }
                    }
                }
            }
        } catch (_) {}

        // Load individual items
        let raw;
        try { raw = sessionStorage.getItem(this._cacheKey); } catch (_) { this._notifyChange(); return; }
        if (!raw) { this._notifyChange(); return; }
        let data;
        try { data = JSON.parse(raw); } catch (_) { this._notifyChange(); return; }
        if (!Array.isArray(data) || data.length === 0) { this._notifyChange(); return; }

        await Promise.all(data.map(e => this._spawnItemFromEntry(e)));
        this._notifyChange();
    }

    // ---- PRESETS ----

    async loadPreset(preset) {
        await this.ready();
        if (this.isPresetLoaded(preset.id)) return this._presets.find(p => p.id === preset.id);
        this._pushUndo();
        let entry;
        try {
            entry = await this._loadPresetFromEntry(preset);
        } catch (e) {
            if (this.onError) this.onError({ type: 'load', message: 'Preset yüklenemedi: ' + preset.name, error: e });
            throw e;
        }
        this._savePresetCache();
        this._notifyChange();
        return entry;
    }

    removePreset(presetId) {
        const idx = this._presets.findIndex(p => p.id === presetId);
        if (idx === -1) return;
        this._pushUndo();
        const entry = this._presets[idx];
        this.scene.remove(entry.threeObject);
        disposeObject(entry.threeObject);
        this._presets.splice(idx, 1);
        this._savePresetCache();
        this._notifyChange();
    }

    isPresetLoaded(presetId) { return this._presets.some(p => p.id === presetId); }
    get loadedPresets() { return this._presets; }

    // ---- OTHER ----

    findByObject(obj) {
        let target = obj;
        while (target) {
            const found = this._items.find(i => i.threeObject === target);
            if (found) return found;
            target = target.parent;
        }
        return null;
    }

    update() {
        if (this._active && this._selected && this._gizmoDragging) {
            this.saveToCache();
        }
    }

    exemptGumballFromClipping() {
        this._transformControls.traverse(c => {
            if (c.material) {
                const mats = Array.isArray(c.material) ? c.material : [c.material];
                mats.forEach(m => { m.clippingPlanes = []; m.clipIntersection = false; });
            }
        });
    }

    dispose() {
        // Remove TransformControls event listeners
        if (this._tcHandlers) {
            for (const [evt, fn] of Object.entries(this._tcHandlers)) {
                this._transformControls.removeEventListener(evt, fn);
            }
            this._tcHandlers = null;
        }
        this._transformControls.detach();
        this._transformControls.dispose();
        this.scene.remove(this._transformControls);

        for (const item of this._items) {
            this.scene.remove(item.threeObject);
            disposeObject(item.threeObject);
        }
        for (const p of this._presets) {
            this.scene.remove(p.threeObject);
            disposeObject(p.threeObject);
        }
        this._items = [];
        this._presets = [];
        this._selected = null;
        this._undoStack = [];
        this._redoStack = [];
    }

    // ---- INTERNAL ----

    _makePlacedItem(id, url, name, root) {
        return {
            id, url, name, threeObject: root,
            get position() { return { x: root.position.x, y: root.position.y, z: root.position.z }; },
            get rotation() { return { x: root.rotation.x, y: root.rotation.y, z: root.rotation.z }; },
            get scale() { return { x: root.scale.x, y: root.scale.y, z: root.scale.z }; }
        };
    }

    /** Remove a placed item from scene + items array (shared by delete/clear) */
    _removeItemObject(placed) {
        this.scene.remove(placed.threeObject);
        disposeObject(placed.threeObject);
        this._items = this._items.filter(i => i !== placed);
        if (this._selected === placed) {
            this._transformControls.detach();
            this._transformControls.visible = false;
            this._transformControls.enabled = false;
        }
    }

    /** Spawn an item from a cached/snapshot entry (no undo push, no cache save) */
    async _spawnItemFromEntry(entry) {
        const root = await loadGLB(entry.url);
        root.position.set(entry.pos.x, entry.pos.y, entry.pos.z);
        root.rotation.set(entry.rot.x, entry.rot.y, entry.rot.z);
        root.scale.set(entry.scale.x, entry.scale.y, entry.scale.z);
        tagAsFurniture(root, {
            _furnitureId: entry.id,
            _furnitureName: entry.name,
            _furnitureUrl: entry.url
        });
        this.scene.add(root);
        this._items.push(this._makePlacedItem(entry.id, entry.url, entry.name, root));
    }

    /** Load a preset from entry (no undo push, no cache save) — returns entry */
    async _loadPresetFromEntry(preset) {
        const root = await loadGLB(preset.url);
        root.position.set(0, 0, 0);
        tagAsFurniture(root, {
            _isPreset: true,
            _presetId: preset.id,
            _presetUrl: preset.url
        }, true);
        this.scene.add(root);
        const entry = { id: preset.id, name: preset.name, threeObject: root };
        this._presets.push(entry);
        return entry;
    }

    _setupTransformControls() {
        this._transformControls = new TransformControls(this.camera, this.renderer.domElement);
        this._transformControls.visible = false;
        this._transformControls.enabled = false;
        this._transformControls.setMode('translate');
        this._transformControls.size = C.gumballSize;

        // Store bound handlers so dispose() can remove them cleanly
        this._tcHandlers = {
            'dragging-changed': (e) => {
                this._gizmoDragging = e.value;
                if (this.orbitControls) this.orbitControls.enabled = !e.value;
                if (!e.value) {
                    this._recentlyDragged = true;
                    setTimeout(() => { this._recentlyDragged = false; }, C.recentlyDraggedMs);
                }
            },
            'mouseDown': () => {
                this._gizmoDragging = true;
                this._pushUndo();
            },
            'objectChange': () => {
                if (this._transformControls.mode === 'scale' && this._selected) {
                    const s = this._selected.threeObject.scale;
                    const diffs = [Math.abs(s.x - this._prevScale), Math.abs(s.y - this._prevScale), Math.abs(s.z - this._prevScale)];
                    const maxDiffIdx = diffs.indexOf(Math.max(...diffs));
                    const newVal = [s.x, s.y, s.z][maxDiffIdx];
                    const clamped = Math.max(C.scaleMin, newVal);
                    s.set(clamped, clamped, clamped);
                    this._prevScale = clamped;
                }
            },
            'mouseUp': () => {
                setTimeout(() => {
                    this._gizmoDragging = false;
                    this.saveToCache();
                    this._notifyChange();
                }, C.saveToCacheDebounceMs);
            }
        };
        for (const [evt, fn] of Object.entries(this._tcHandlers)) {
            this._transformControls.addEventListener(evt, fn);
        }

        this.scene.add(this._transformControls);
    }

    _notifyChange() {
        if (this.onChange) this.onChange();
    }
}
