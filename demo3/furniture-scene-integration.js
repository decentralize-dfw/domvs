// furniture-scene-integration.js — wires FurnitureEditor + FurniturePanel into the cameras scene
// Owns: edit/view modes, right-panel UI, drag-drop, spinner, popup, keyboard, badge, ghost preview

import * as THREE from 'three';
import { FurnitureEditor } from './furniture-editor.js';
import { FurniturePanel } from './furniture-panel.js';
import { getAllItems } from './furniture-library.js';
import { FURNITURE_CONFIG as C } from './furniture-config.js';
import { el, clear, cleanName, toast } from './furniture-ui-helpers.js';

export class FurnitureSceneIntegration {
    /**
     * @param {Object} deps
     * @param {THREE.Scene} deps.scene
     * @param {THREE.WebGLRenderer} deps.renderer
     * @param {any} deps.orbitControls
     * @param {HTMLElement} deps.leftPanel
     * @param {HTMLElement} deps.rightPanel
     * @param {HTMLElement} deps.descriptionEl
     * @param {HTMLElement[]} deps.toggleButtons
     * @param {Object} deps.sceneCfg              — Excel scene config (for button action lookup)
     * @param {number} deps.sceneIndex
     * @param {() => THREE.Camera} deps.getCamera — reads current live camera
     * @param {() => any} [deps.getHotspotMgr]    — read current hotspotMgr (may be null before init)
     * @param {any} deps.clipMgr                  — ClipModeManager instance
     * @param {(buttonIndex: number) => void} deps.switchToPlanView — delegates to clipMgr
     */
    constructor(deps) {
        this.scene = deps.scene;
        this.renderer = deps.renderer;
        this.orbitControls = deps.orbitControls;
        this.leftPanel = deps.leftPanel;
        this.rightPanel = deps.rightPanel;
        this.descriptionEl = deps.descriptionEl;
        this.toggleButtons = deps.toggleButtons;
        this.sceneCfg = deps.sceneCfg;
        this.sceneIndex = deps.sceneIndex;
        this._getCamera = deps.getCamera;
        this._getHotspotMgr = deps.getHotspotMgr || (() => null);
        this.clipMgr = deps.clipMgr;
        this.switchToPlanView = deps.switchToPlanView;

        this.editor = null;
        this.panel = null;
        this._activeGizmoMode = 'translate';
        this._dragGhost = null;
        this._dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this._dragHit = new THREE.Vector3();
        this._furnSpinner = null;
        this._furnPopupEl = null;
        this._furnRC = new THREE.Raycaster();
        this._furnMouse = new THREE.Vector2();

        // Bound handlers (so we can remove them in dispose)
        this._onPointerMove = null;
        this._onCanvasClick = null;
        this._onDragEnter = null;
        this._onDragOver = null;
        this._onDragLeave = null;
        this._onDrop = null;
        this._onKeyDown = null;
    }

    /** Call after orbit/clip are ready. Creates editor + panel, starts cache load. */
    init() {
        this.editor = new FurnitureEditor(
            this.scene, this._getCamera(), this.renderer, this.orbitControls, this.sceneIndex
        );
        this.editor.cacheKey = C.sharedCacheKey;
        this.editor.onChange = () => {
            this._updateBadge();
            if (this._activeMode === 'toggle-3') this._updateSelectionInfo();
            if (this._activeMode === 'toggle-3-view') this._renderPlacedItemsList();
        };
        this.editor.onError = (err) => {
            const type = err.type === 'quota' ? 'warn' : 'error';
            toast(err.message, type, 5000);
        };

        this.panel = new FurniturePanel(
            this.leftPanel,
            (item) => this._onSpawnItemClick(item),
            (preset, isLoading) => this._onPresetToggle(preset, isLoading)
        );
        this.panel.setEditor(this.editor);

        // Start cache load (non-blocking)
        this.editor.loadFromCache().catch(() => {});

        this._wireEvents();
    }

    /** Live editor reference */
    get furnitureEditor() { return this.editor; }
    get furniturePanel() { return this.panel; }

    enterEdit(buttonIndex) {
        this._activeMode = 'toggle-3';
        this.switchToPlanView(buttonIndex);

        if (this.editor) {
            this.editor.camera = this._getCamera();
            this.editor._transformControls.camera = this._getCamera();
            this.editor.activate();
        }

        if (this.panel) {
            this.panel.build();
            this.panel.show();
        }

        clear(this.rightPanel);
        this.rightPanel.appendChild(el('div', {
            class: 'vea-furniture-info',
            children: [el('p', { text: 'Bir mobilya seçin' })]
        }));
        this.rightPanel.style.display = 'block';

        const hm = this._getHotspotMgr();
        if (hm) hm.suspended = true;
        this.descriptionEl.textContent = 'Mobilya Editörü';
        this.descriptionEl.style.display = 'block';
        this._updateBadge();
    }

    enterView(buttonIndex) {
        this._activeMode = 'toggle-3-view';
        this.switchToPlanView(buttonIndex);

        if (this.editor && this.editor.placedItems.length === 0) {
            this.editor.loadFromCache().catch(() => {});
        }

        this._renderPlacedItemsList();
        this.leftPanel.style.display = 'block';
        this.rightPanel.style.display = 'none';

        const hm = this._getHotspotMgr();
        if (hm) hm.suspended = true;
        this.descriptionEl.textContent = 'Mobilya Görünüm';
        this.descriptionEl.style.display = 'block';
        this._updateBadge();
    }

    exit() {
        if (this.editor) this.editor.deactivate();
        if (this.panel) this.panel.hide();
        const hm = this._getHotspotMgr();
        if (hm) hm.suspended = false;
        this._activeMode = null;
    }

    /** Set by parent scene to inform integration about current mode (for click handlers) */
    setActiveMode(mode) { this._activeMode = mode; }

    /** Called by scene when user clicks canvas — returns true if handled */
    handleCanvasClick() {
        if (!this.editor) return false;
        const camera = this._getCamera();

        // Furniture selection in edit mode
        if (this._activeMode === 'toggle-3') {
            if (this.editor.isDragging || this.editor.wasRecentlyDragging) return true;
            this._furnRC.setFromCamera(this._furnMouse, camera);
            const furnObjs = this.editor.placedItems.map(i => i.threeObject);
            if (furnObjs.length > 0) {
                const hits = this._furnRC.intersectObjects(furnObjs, true);
                if (hits.length > 0) {
                    const placed = this.editor.findByObject(hits[0].object);
                    if (placed) { this.editor.selectItem(placed); this._updateSelectionInfo(); }
                } else {
                    this.editor.deselectItem();
                    this._updateSelectionInfo();
                }
            }
            return true;
        }

        // Furniture click popup in room camera mode
        if (this._activeMode === 'toggle-1' && this.editor.placedItems.length > 0) {
            this._furnRC.setFromCamera(this._furnMouse, camera);
            const furnObjs = this.editor.placedItems.map(i => i.threeObject);
            const hits = this._furnRC.intersectObjects(furnObjs, true);
            if (hits.length > 0) {
                const placed = this.editor.findByObject(hits[0].object);
                if (placed) { this._showFurniturePopup(placed, hits[0].point); return true; }
            }
        }

        return false;
    }

    dispose() {
        const dom = this.renderer.domElement;
        if (this._onPointerMove) dom.removeEventListener('pointermove', this._onPointerMove);
        if (this._onDragEnter) dom.removeEventListener('dragenter', this._onDragEnter);
        if (this._onDragOver) dom.removeEventListener('dragover', this._onDragOver);
        if (this._onDragLeave) dom.removeEventListener('dragleave', this._onDragLeave);
        if (this._onDrop) dom.removeEventListener('drop', this._onDrop);
        if (this._onKeyDown) window.removeEventListener('keydown', this._onKeyDown);
        this._hideDragGhost();
        this._hideFurnSpinner();
        this._closeFurniturePopup();
        if (this.editor) this.editor.dispose();
        if (this.panel) this.panel.dispose();
    }

    // ---- INTERNAL: event wiring ----

    _wireEvents() {
        const dom = this.renderer.domElement;

        this._onPointerMove = (e) => {
            this._furnMouse.set(
                (e.clientX / innerWidth) * 2 - 1,
                -(e.clientY / innerHeight) * 2 + 1
            );
        };
        dom.addEventListener('pointermove', this._onPointerMove);

        this._onDragEnter = (e) => {
            if (this._activeMode !== 'toggle-3') return;
            e.preventDefault();
        };
        this._onDragOver = (e) => {
            if (this._activeMode !== 'toggle-3') return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            const hit = this._projectToGround(e.clientX, e.clientY);
            this._showDragGhost(hit);
        };
        this._onDragLeave = () => this._hideDragGhost();
        this._onDrop = (e) => {
            this._hideDragGhost();
            if (this._activeMode !== 'toggle-3' || !this.editor) return;
            e.preventDefault();
            const itemId = e.dataTransfer.getData('application/x-furniture-id');
            if (!itemId) return;
            const libItem = getAllItems().find(i => i.id === itemId);
            if (!libItem) return;
            const hit = this._projectToGround(e.clientX, e.clientY);
            this._showFurnSpinner();
            this.editor.spawnItem(libItem, { x: hit.x, y: 0, z: hit.z })
                .then(() => { this._hideFurnSpinner(); this._updateSelectionInfo(); })
                .catch(() => this._hideFurnSpinner());
        };
        dom.addEventListener('dragenter', this._onDragEnter);
        dom.addEventListener('dragover', this._onDragOver);
        dom.addEventListener('dragleave', this._onDragLeave);
        dom.addEventListener('drop', this._onDrop);

        this._onKeyDown = (e) => this._handleKey(e);
        window.addEventListener('keydown', this._onKeyDown);
    }

    _handleKey(e) {
        if (this._activeMode !== 'toggle-3' || !this.editor || !this.editor.active) return;
        // Undo
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            this.editor.undo().then(() => this._updateSelectionInfo());
            return;
        }
        // Redo
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey) || e.key === 'Z')) {
            e.preventDefault();
            this.editor.redo().then(() => this._updateSelectionInfo());
            return;
        }
        if (e.key === 'r' || e.key === 'R') { this._setGizmoMode('rotate'); }
        if (e.key === 't' || e.key === 'T') { this._setGizmoMode('translate'); }
        if (e.key === 's' || e.key === 'S') { this._setGizmoMode('scale'); }
        if (e.key === 'Delete' || e.key === 'Backspace') {
            this.editor.deleteSelected();
            this._updateSelectionInfo();
        }
    }

    _setGizmoMode(mode) {
        this._activeGizmoMode = mode;
        this.editor.setMode(mode);
        this._updateSelectionInfo();
    }

    _onSpawnItemClick(item) {
        if (!this.editor) return;
        this._showFurnSpinner();
        const target = this.orbitControls.target;
        this.editor.spawnItem(item, { x: target.x, y: 0, z: target.z })
            .then(() => { this._hideFurnSpinner(); this._updateSelectionInfo(); })
            .catch(() => this._hideFurnSpinner());
    }

    _onPresetToggle(preset, isLoading) {
        if (!this.editor) return;
        if (isLoading) {
            this._showFurnSpinner();
            this.editor.loadPreset(preset)
                .then(() => { this._hideFurnSpinner(); this.panel.refresh(); this._updateSelectionInfo(); })
                .catch(() => this._hideFurnSpinner());
        } else {
            this.editor.removePreset(preset.id);
            this.panel.refresh();
            this._updateSelectionInfo();
        }
    }

    // ---- INTERNAL: drag & drop ----

    _projectToGround(clientX, clientY) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        const mx = ((clientX - rect.left) / rect.width) * 2 - 1;
        const my = -((clientY - rect.top) / rect.height) * 2 + 1;
        this._furnRC.setFromCamera(new THREE.Vector2(mx, my), this._getCamera());
        this._furnRC.ray.intersectPlane(this._dragPlane, this._dragHit);
        return this._dragHit;
    }

    _showDragGhost(pos) {
        if (!this._dragGhost) {
            const geo = new THREE.BoxGeometry(C.dragGhostSize, C.dragGhostSize, C.dragGhostSize);
            const mat = new THREE.MeshBasicMaterial({
                color: C.dragGhostColor, transparent: true,
                opacity: C.dragGhostOpacity, depthWrite: false
            });
            this._dragGhost = new THREE.Mesh(geo, mat);
            this._dragGhost.userData._isDragGhost = true;
            this.scene.add(this._dragGhost);
        }
        this._dragGhost.position.set(pos.x, C.dragGhostHeight, pos.z);
        this._dragGhost.visible = true;
    }

    _hideDragGhost() {
        if (this._dragGhost) {
            this.scene.remove(this._dragGhost);
            this._dragGhost.geometry.dispose();
            this._dragGhost.material.dispose();
            this._dragGhost = null;
        }
    }

    // ---- INTERNAL: spinner ----

    _showFurnSpinner() {
        if (this._furnSpinner) return;
        this._furnSpinner = document.createElement('div');
        this._furnSpinner.className = 'vea-furniture-loading';
        this._furnSpinner.textContent = 'Yükleniyor…';
        document.body.appendChild(this._furnSpinner);
    }

    _hideFurnSpinner() {
        if (this._furnSpinner) { this._furnSpinner.remove(); this._furnSpinner = null; }
    }

    // ---- INTERNAL: popup (toggle-1 mode) ----

    _showFurniturePopup(placed, worldPoint) {
        this._closeFurniturePopup();
        const close = () => this._closeFurniturePopup();
        this._furnPopupEl = el('div', {
            class: 'vea-furniture-popup',
            on: { click: close },
            children: [
                el('strong', { text: cleanName(placed.name) }),
                document.createElement('br'),
                el('span', {
                    text: placed.id,
                    style: { fontSize: '11px', opacity: '0.6' }
                })
            ]
        });
        document.body.appendChild(this._furnPopupEl);
        const v = worldPoint.clone().project(this._getCamera());
        const x = (v.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
        this._furnPopupEl.style.left = x + 'px';
        this._furnPopupEl.style.top = (y - 60) + 'px';
        setTimeout(close, C.popupAutoCloseMs);
    }

    _closeFurniturePopup() {
        if (this._furnPopupEl) { this._furnPopupEl.remove(); this._furnPopupEl = null; }
    }

    // ---- INTERNAL: badge ----

    _updateBadge() {
        const count = this.editor ? this.editor.itemCount : 0;
        this.toggleButtons.forEach(btn => {
            const cfg = this.sceneCfg.buttons.find(b => b.id === btn.dataset.id);
            if (!cfg) return;
            const action = (cfg.action || '').trim();
            if (action === 'FURNITURE_EDIT' || action === 'FURNITURE_VIEW') {
                let badge = btn.querySelector('.vea-furniture-badge');
                if (count > 0) {
                    if (!badge) {
                        badge = document.createElement('span');
                        badge.className = 'vea-furniture-badge';
                        btn.appendChild(badge);
                    }
                    badge.textContent = count;
                } else if (badge) {
                    badge.remove();
                }
            }
        });
    }

    // ---- INTERNAL: right-panel selection info (toggle-3 mode) ----

    _updateSelectionInfo() {
        if (this._activeMode !== 'toggle-3') return;
        const sel = this.editor?.selected;
        const items = this.editor?.placedItems || [];
        const presets = this.editor?.loadedPresets || [];
        const m = this._activeGizmoMode;

        clear(this.rightPanel);
        const root = el('div', { class: 'vea-furniture-info' });

        // --- Selected item block ---
        if (sel) {
            const p = sel.position;
            root.appendChild(el('h3', { text: cleanName(sel.name) }));
            root.appendChild(el('p', { text: `X: ${p.x.toFixed(2)}   Z: ${p.z.toFixed(2)}` }));

            const modeBar = el('div', { class: 'vea-furniture-mode-bar' });
            for (const [mode, label] of [['translate', 'Taşı'], ['rotate', 'Döndür'], ['scale', 'Boyut']]) {
                modeBar.appendChild(el('button', {
                    class: `vea-furniture-mode-btn${m === mode ? ' active' : ''}`,
                    text: label,
                    data: { mode },
                    on: { click: () => this._setGizmoMode(mode) }
                }));
            }
            root.appendChild(modeBar);

            root.appendChild(el('button', {
                class: 'vea-furniture-delete-btn',
                text: 'Sil',
                on: { click: () => { this.editor.deleteSelected(); this._updateSelectionInfo(); } }
            }));
            root.appendChild(this._hr());
        }

        // --- Placed items list ---
        root.appendChild(el('h3', {
            text: `Yerleştirilen (${items.length})`,
            style: { fontSize: '12px', margin: '0 0 6px' }
        }));
        if (items.length > 0) {
            for (let idx = 0; idx < items.length; idx++) {
                const it = items[idx];
                const ip = it.position, ir = it.rotation, is_ = it.scale;
                const isSel = sel && sel === it;
                const card = el('div', {
                    class: `vea-furniture-placed-item${isSel ? ' active' : ''}`,
                    data: { idx: String(idx) },
                    on: {
                        click: () => {
                            const item = this.editor?.placedItems[idx];
                            if (item) { this.editor.selectItem(item); this._updateSelectionInfo(); }
                        }
                    },
                    children: [
                        el('div', { text: cleanName(it.name), style: { fontSize: '11px', color: '#fff' } }),
                        el('div', {
                            text: `P: ${ip.x.toFixed(1)}, ${ip.z.toFixed(1)} · R: ${(ir.y * 180 / Math.PI).toFixed(0)}° · S: ${is_.x.toFixed(2)}`,
                            style: { fontSize: '9px', color: 'rgba(255,255,255,0.4)' }
                        })
                    ]
                });
                root.appendChild(card);
            }
            root.appendChild(el('button', {
                class: 'vea-furniture-clear-btn',
                text: 'Sahneyi Temizle',
                on: { click: () => { this.editor.clearAll(); this._updateSelectionInfo(); } }
            }));
        } else {
            root.appendChild(el('p', {
                text: 'Henüz mobilya yok',
                style: { fontSize: '11px', color: 'rgba(255,255,255,0.35)' }
            }));
        }

        // --- Loaded presets section ---
        if (presets.length > 0) {
            root.appendChild(this._hr());
            root.appendChild(el('h3', {
                text: "Yüklü Preset'ler",
                style: { fontSize: '12px', margin: '0 0 6px' }
            }));
            presets.forEach((preset) => {
                const row = el('div', {
                    class: 'vea-furniture-placed-item',
                    style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
                    children: [
                        el('span', { text: preset.name, style: { fontSize: '11px', color: '#fff' } }),
                        el('button', {
                            class: 'vea-furniture-preset-remove-btn',
                            text: 'Kaldır',
                            on: {
                                click: (e) => {
                                    e.stopPropagation();
                                    this.editor.removePreset(preset.id);
                                    this.panel?.refresh();
                                    this._updateSelectionInfo();
                                }
                            }
                        })
                    ]
                });
                root.appendChild(row);
            });
        }

        this.rightPanel.appendChild(root);
    }

    _hr() {
        return el('hr', {
            style: { border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '10px 0' }
        });
    }

    // ---- INTERNAL: left-panel placed items list (toggle-3-view mode) ----

    _renderPlacedItemsList() {
        clear(this.leftPanel);
        if (!this.editor) return;
        const items = this.editor.placedItems;
        if (items.length === 0) {
            this.leftPanel.appendChild(el('p', {
                class: 'vea-furniture-info',
                text: 'Henüz mobilya yerleştirilmedi',
                style: { color: 'rgba(255,255,255,0.5)' }
            }));
            return;
        }
        this.leftPanel.appendChild(el('h3', {
            text: `Yerleştirilen (${items.length})`,
            style: { margin: '0 0 8px', fontSize: '14px', color: '#fff' }
        }));
        items.forEach((item, idx) => {
            const p = item.position;
            const card = el('div', {
                class: 'vea-furniture-placed-item',
                data: { idx: String(idx) },
                on: { click: () => this._focusOnItem(idx) },
                children: [
                    el('div', { text: cleanName(item.name), style: { fontSize: '12px', color: '#fff' } }),
                    el('div', {
                        text: `X: ${p.x.toFixed(1)}  Z: ${p.z.toFixed(1)}`,
                        style: { fontSize: '10px', color: 'rgba(255,255,255,0.4)' }
                    })
                ]
            });
            this.leftPanel.appendChild(card);
        });
    }

    _focusOnItem(idx) {
        const item = this.editor?.placedItems[idx];
        if (item) {
            this.orbitControls.target.copy(item.threeObject.position);
            this.orbitControls.update();
        }
    }
}
