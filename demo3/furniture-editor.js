// furniture-editor.js — Furniture Editor Core (Prompt 2/7)
// Spawn GLB items, gumball edit, sessionStorage cache

import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// Shared loader (same pattern as hotspot-manager.js)
const _gltfLoader = new GLTFLoader();
const _dracoLoader = new DRACOLoader();
_dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
_gltfLoader.setDRACOLoader(_dracoLoader);
_gltfLoader.setMeshoptDecoder(MeshoptDecoder);

export class FurnitureEditor {
    /**
     * @param {THREE.Scene} threeScene
     * @param {THREE.Camera} camera
     * @param {THREE.WebGLRenderer} renderer
     * @param {import('three/addons/controls/OrbitControls.js').OrbitControls} orbitControls
     * @param {number} sceneIndex — for sessionStorage key
     */
    constructor(threeScene, camera, renderer, orbitControls, sceneIndex = 0) {
        this.scene = threeScene;
        this.camera = camera;
        this.renderer = renderer;
        this.orbitControls = orbitControls;
        this.sceneIndex = sceneIndex;

        this._items = [];       // placed items
        this._selected = null;  // currently selected placed item
        this._gizmoDragging = false;
        this._active = false;
        this._cacheLoaded = false;

        /** External callback: called after spawn/delete/move completes. */
        this.onChange = null;

        this._setupTransformControls();
    }

    // ---- PUBLIC API ----

    /** Spawn a library item at given world position. Returns the placed item. */
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
        this.scene.add(root);

        const placed = {
            id: libraryItem.id,
            url: libraryItem.url,
            name: libraryItem.name,
            threeObject: root,
            get position() { return { x: root.position.x, y: root.position.y, z: root.position.z }; },
            get rotation() { return { x: root.rotation.x, y: root.rotation.y, z: root.rotation.z }; },
            get scale() { return { x: root.scale.x, y: root.scale.y, z: root.scale.z }; }
        };

        this._items.push(placed);
        this.selectItem(placed);
        this.saveToCache();
        this._notifyChange();
        return placed;
    }

    /** Select a placed item and attach the gumball. */
    selectItem(placed) {
        if (!placed) { this.deselectItem(); return; }
        this._selected = placed;
        this._transformControls.attach(placed.threeObject);
        this._transformControls.visible = true;
        this._transformControls.enabled = true;
    }

    /** Deselect current item (detach gumball). */
    deselectItem() {
        this._selected = null;
        this._transformControls.detach();
        this._transformControls.visible = false;
        this._transformControls.enabled = false;
    }

    /** Delete the currently selected item. */
    deleteSelected() {
        if (!this._selected) return;
        const obj = this._selected.threeObject;
        this._transformControls.detach();
        this._transformControls.visible = false;
        this._transformControls.enabled = false;
        this.scene.remove(obj);
        obj.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) { const mats = Array.isArray(c.material) ? c.material : [c.material]; mats.forEach(m => m.dispose()); } });
        this._items = this._items.filter(i => i !== this._selected);
        this._selected = null;
        this.saveToCache();
        this._notifyChange();
    }

    /** All placed items. */
    get placedItems() { return this._items; }

    /** Currently selected placed item (or null). */
    get selected() { return this._selected; }

    /** Whether the gumball is being dragged. */
    get isDragging() { return this._gizmoDragging; }

    /** Set gumball mode: 'translate', 'rotate', 'scale'. */
    setMode(mode) {
        this._transformControls.setMode(mode);
    }

    /** Activate the editor (disable orbit, show gumball if selected). */
    activate() {
        this._active = true;
        if (this.orbitControls) this.orbitControls.enabled = false;
        this._transformControls.camera = this.camera;
        if (this._selected) {
            this._transformControls.visible = true;
            this._transformControls.enabled = true;
        }
    }

    /** Deactivate the editor (re-enable orbit, hide gumball). */
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

    get _cacheKey() { return `vea-furniture-${this.sceneIndex}`; }

    saveToCache() {
        const data = this._items.map(i => ({
            id: i.id,
            url: i.url,
            name: i.name,
            pos: i.position,
            rot: i.rotation,
            scale: i.scale
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

        const promises = data.map(async (entry) => {
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
            this.scene.add(root);

            const placed = {
                id: entry.id,
                url: entry.url,
                name: entry.name,
                threeObject: root,
                get position() { return { x: root.position.x, y: root.position.y, z: root.position.z }; },
                get rotation() { return { x: root.rotation.x, y: root.rotation.y, z: root.rotation.z }; },
                get scale() { return { x: root.scale.x, y: root.scale.y, z: root.scale.z }; }
            };
            this._items.push(placed);
        });

        await Promise.all(promises);
        this._notifyChange();
    }

    /** Find a placed item by its threeObject (for raycasting). */
    findByObject(obj) {
        let target = obj;
        while (target) {
            const found = this._items.find(i => i.threeObject === target);
            if (found) return found;
            target = target.parent;
        }
        return null;
    }

    /** Called each frame (for TransformControls updates). */
    update() {
        if (this._active && this._selected && this._gizmoDragging) {
            this.saveToCache();
        }
    }

    /** Clean up everything. */
    dispose() {
        this._transformControls.detach();
        this._transformControls.dispose();
        this.scene.remove(this._transformControls);
        for (const item of this._items) {
            this.scene.remove(item.threeObject);
            item.threeObject.traverse(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) {
                    const mats = Array.isArray(c.material) ? c.material : [c.material];
                    mats.forEach(m => m.dispose());
                }
            });
        }
        this._items = [];
        this._selected = null;
    }

    /** Remove a specific placed item (by reference). */
    removeItem(placed) {
        if (!placed) return;
        if (this._selected === placed) this.deselectItem();
        this.scene.remove(placed.threeObject);
        placed.threeObject.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) { const mats = Array.isArray(c.material) ? c.material : [c.material]; mats.forEach(m => m.dispose()); } });
        this._items = this._items.filter(i => i !== placed);
        this.saveToCache();
        this._notifyChange();
    }

    /** Get placed item count. */
    get itemCount() { return this._items.length; }

    _notifyChange() {
        if (this.onChange) this.onChange();
    }

    // ---- INTERNAL ----

    _setupTransformControls() {
        this._transformControls = new TransformControls(this.camera, this.renderer.domElement);
        this._transformControls.visible = false;
        this._transformControls.enabled = false;
        this._transformControls.setMode('translate');
        this._transformControls.size = 1.5;

        this._transformControls.addEventListener('dragging-changed', (e) => {
            this._gizmoDragging = e.value;
            if (this.orbitControls) this.orbitControls.enabled = !e.value && !this._active;
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
}
