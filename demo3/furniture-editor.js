// furniture-editor.js — Furniture Editor Core
// Spawn GLB items, gumball edit, sessionStorage cache

import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const _gltfLoader = new GLTFLoader();
const _dracoLoader = new DRACOLoader();
_dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
_gltfLoader.setDRACOLoader(_dracoLoader);
_gltfLoader.setMeshoptDecoder(MeshoptDecoder);

export class FurnitureEditor {
    constructor(threeScene, camera, renderer, orbitControls, sceneIndex = 0) {
        this.scene = threeScene;
        this.camera = camera;
        this.renderer = renderer;
        this.orbitControls = orbitControls;
        this.sceneIndex = sceneIndex;

        this._items = [];
        this._selected = null;
        this._gizmoDragging = false;
        this._recentlyDragged = false; // prevents click-deselect after drag
        this._active = false;
        this._cacheLoaded = false;

        this.onChange = null;

        this._setupTransformControls();
    }

    // ---- PUBLIC API ----

    async spawnItem(libraryItem, position) {
        const pos = position || { x: 0, y: 0, z: 0 };
        const gltf = await new Promise((resolve, reject) => {
            _gltfLoader.load(libraryItem.url, resolve, undefined, reject);
        });

        const root = gltf.scene;
        root.position.set(pos.x, 0, pos.z);
        root.userData._furnitureId = libraryItem.id;
        root.userData._furnitureName = libraryItem.name;
        root.userData._furnitureUrl = libraryItem.url;
        root.traverse(child => { child.userData._isFurniture = true; });
        this.scene.add(root);

        const placed = this._makePlacedItem(libraryItem.id, libraryItem.url, libraryItem.name, root);
        this._items.push(placed);
        this.selectItem(placed);
        this.saveToCache();
        this._notifyChange();
        return placed;
    }

    selectItem(placed) {
        if (!placed) { this.deselectItem(); return; }
        this._selected = placed;
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
        const obj = this._selected.threeObject;
        this._transformControls.detach();
        this._transformControls.visible = false;
        this._transformControls.enabled = false;
        this.scene.remove(obj);
        obj.traverse(c => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) { (Array.isArray(c.material) ? c.material : [c.material]).forEach(m => m.dispose()); }
        });
        this._items = this._items.filter(i => i !== this._selected);
        this._selected = null;
        this.saveToCache();
        this._notifyChange();
    }

    removeItem(placed) {
        if (!placed) return;
        if (this._selected === placed) this.deselectItem();
        this.scene.remove(placed.threeObject);
        placed.threeObject.traverse(c => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) { (Array.isArray(c.material) ? c.material : [c.material]).forEach(m => m.dispose()); }
        });
        this._items = this._items.filter(i => i !== placed);
        this.saveToCache();
        this._notifyChange();
    }

    get placedItems() { return this._items; }
    get selected() { return this._selected; }
    get isDragging() { return this._gizmoDragging; }
    get wasRecentlyDragging() { return this._recentlyDragged; }
    get itemCount() { return this._items.length; }

    setMode(mode) {
        this._transformControls.setMode(mode);
    }

    /** Activate editor — orbit stays enabled, only disabled during gumball drag */
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

    get active() { return this._active; }

    // ---- SESSION CACHE ----

    /** Cache key — shared across all scenes using same interior model */
    get _cacheKey() { return this._customCacheKey || `vea-furniture-${this.sceneIndex}`; }
    set cacheKey(key) { this._customCacheKey = key; }

    saveToCache() {
        const data = this._items.map(i => ({
            id: i.id, url: i.url, name: i.name,
            pos: i.position, rot: i.rotation, scale: i.scale
        }));
        try { sessionStorage.setItem(this._cacheKey, JSON.stringify(data)); } catch (_) {}
    }

    async loadFromCache() {
        if (this._cacheLoaded) return;
        this._cacheLoaded = true;
        let raw;
        try { raw = sessionStorage.getItem(this._cacheKey); } catch (_) { return; }
        if (!raw) return;
        let data;
        try { data = JSON.parse(raw); } catch (_) { return; }
        if (!Array.isArray(data) || data.length === 0) return;

        await Promise.all(data.map(async (entry) => {
            const gltf = await new Promise((resolve, reject) => {
                _gltfLoader.load(entry.url, resolve, undefined, reject);
            });
            const root = gltf.scene;
            root.position.set(entry.pos.x, entry.pos.y, entry.pos.z);
            root.rotation.set(entry.rot.x, entry.rot.y, entry.rot.z);
            root.scale.set(entry.scale.x, entry.scale.y, entry.scale.z);
            root.userData._furnitureId = entry.id;
            root.userData._furnitureName = entry.name;
            root.userData._furnitureUrl = entry.url;
            root.traverse(child => { child.userData._isFurniture = true; });
            this.scene.add(root);
            this._items.push(this._makePlacedItem(entry.id, entry.url, entry.name, root));
        }));
        this._notifyChange();
    }

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

    /** Ensure gumball is never clipped — call after clipping materials are set */
    exemptGumballFromClipping() {
        this._transformControls.traverse(c => {
            if (c.material) {
                const mats = Array.isArray(c.material) ? c.material : [c.material];
                mats.forEach(m => { m.clippingPlanes = []; m.clipIntersection = false; });
            }
        });
    }

    dispose() {
        this._transformControls.detach();
        this._transformControls.dispose();
        this.scene.remove(this._transformControls);
        for (const item of this._items) {
            this.scene.remove(item.threeObject);
            item.threeObject.traverse(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) { (Array.isArray(c.material) ? c.material : [c.material]).forEach(m => m.dispose()); }
            });
        }
        this._items = [];
        this._selected = null;
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

    _setupTransformControls() {
        this._transformControls = new TransformControls(this.camera, this.renderer.domElement);
        this._transformControls.visible = false;
        this._transformControls.enabled = false;
        this._transformControls.setMode('translate');
        this._transformControls.size = 1.5;

        this._transformControls.addEventListener('dragging-changed', (e) => {
            this._gizmoDragging = e.value;
            // Disable orbit ONLY while dragging gumball, re-enable on release
            if (this.orbitControls) this.orbitControls.enabled = !e.value;
            if (!e.value) {
                // Mark recently dragged so click handler doesn't deselect
                this._recentlyDragged = true;
                setTimeout(() => { this._recentlyDragged = false; }, 150);
            }
        });

        // Uniform scale: when in scale mode, enforce XYZ uniform
        this._transformControls.addEventListener('objectChange', () => {
            if (this._transformControls.mode === 'scale' && this._selected) {
                const s = this._selected.threeObject.scale;
                const max = Math.max(s.x, s.y, s.z);
                s.set(max, max, max);
            }
        });

        this._transformControls.addEventListener('mouseDown', () => {
            this._gizmoDragging = true;
        });
        this._transformControls.addEventListener('mouseUp', () => {
            setTimeout(() => {
                this._gizmoDragging = false;
                this.saveToCache();
                this._notifyChange();
            }, 50);
        });

        this.scene.add(this._transformControls);
    }

    _notifyChange() {
        if (this.onChange) this.onChange();
    }
}
