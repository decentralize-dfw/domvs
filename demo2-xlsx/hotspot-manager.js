/* =============================================================
   VEA DEMO 2 — HOTSPOT MANAGER
   -------------------------------------------------------------
   3D hotspot rendering, popup management, and edit mode with
   gizmo controls. Imported by each scene HTML file.

   Usage:
     import { HotspotManager } from 'https://mergvs.com/demo2-xlsx/hotspot-manager.js';
     const hm = new HotspotManager(scene, camera, renderer, config, SCENE_INDEX);
     hm.loadHotspots();          // on scene load
     hm.setToggle('toggle-2');   // on toggle change (null = show all)
     // edit mode toggled via Shift+E
   ============================================================= */

import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class HotspotManager {
    constructor(threeScene, camera, renderer, config, sceneIndex, orbitControls) {
        this.scene = threeScene;
        this.camera = camera;
        this.renderer = renderer;
        this.config = config;
        this.sceneIndex = sceneIndex;
        this.orbitControls = orbitControls;

        this.hotspots = [];        // parsed data
        this.objects = [];         // { data, group, sprite, label, popup }
        this.editMode = false;
        this.selectedObject = null;
        this.transformControls = null;
        this.gizmoMode = 'translate'; // translate / rotate / scale

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this._popupContainer = null;
        this._editOverlay = null;
        this._editToolbar = null;

        this._setupDOM();
        this._setupEvents();
    }

    // ---- PUBLIC API ----

    loadHotspots(activeToggle = null) {
        const sceneData = this.config?.scenes?.[this.sceneIndex];
        if (!sceneData || !sceneData.hotspots) return;

        this.hotspots = sceneData.hotspots;
        this._clearObjects();

        for (const hs of this.hotspots) {
            this._createHotspot(hs);
        }
        this.setToggle(activeToggle);
    }

    setToggle(toggleKod) {
        for (const obj of this.objects) {
            const tk = obj.data.toggleKod;
            obj.group.visible = !tk || tk === toggleKod || toggleKod === null;
        }
        // Hide popups when toggle changes
        this._closeAllPopups();
    }

    update() {
        if (!this.objects.length) return;
        // Make sprites face camera
        for (const obj of this.objects) {
            if (obj.label) {
                obj.label.lookAt(this.camera.position);
            }
        }
    }

    // ---- HOTSPOT CREATION ----

    _createHotspot(data) {
        const group = new THREE.Group();
        group.position.set(data.pos.x, data.pos.y, data.pos.z);
        group.rotation.set(data.rot.x, data.rot.y, data.rot.z);
        const s = data.scale || 1;
        group.scale.set(s, s, s);
        group.userData.hotspotData = data;

        // Marker sprite (simple colored circle)
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        // Outer ring
        ctx.beginPath();
        ctx.arc(32, 32, 28, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(201, 169, 110, 0.85)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 3;
        ctx.stroke();
        // Inner dot
        ctx.beginPath();
        ctx.arc(32, 32, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();

        const spriteMat = new THREE.SpriteMaterial({
            map: new THREE.CanvasTexture(canvas),
            depthTest: false,
            sizeAttenuation: true
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(0.5, 0.5, 0.5);
        sprite.userData.isHotspot = true;
        sprite.userData.hotspotData = data;
        group.add(sprite);

        // Floating label (name above the marker)
        const labelCanvas = this._makeLabel(data.name);
        const labelMat = new THREE.SpriteMaterial({
            map: new THREE.CanvasTexture(labelCanvas),
            depthTest: false,
            sizeAttenuation: true
        });
        const label = new THREE.Sprite(labelMat);
        label.scale.set(1.5, 0.4, 1);
        label.position.set(0, 0.6, 0);
        group.add(label);

        this.scene.add(group);
        this.objects.push({ data, group, sprite, label, popupOpen: false });
    }

    _makeLabel(text) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 512, 128);
        // Background pill
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.beginPath();
        ctx.roundRect(10, 20, 492, 88, 20);
        ctx.fill();
        ctx.strokeStyle = 'rgba(201,169,110,0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text || '', 256, 64);
        return canvas;
    }

    // ---- POPUP ----

    _showPopup(obj) {
        if (obj.popupOpen) {
            this._closePopup(obj);
            return;
        }

        const data = obj.data;
        const popup = document.createElement('div');
        popup.className = 'vea-hotspot-popup';

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'vea-hotspot-popup-close';
        closeBtn.textContent = '✕';
        closeBtn.onclick = (e) => { e.stopPropagation(); this._closePopup(obj); };
        popup.appendChild(closeBtn);

        // Title
        const title = document.createElement('div');
        title.className = 'vea-hotspot-popup-title';
        title.textContent = data.name;
        popup.appendChild(title);

        // Content — render based on popupTip
        const content = document.createElement('div');
        content.className = 'vea-hotspot-popup-content';
        content.innerHTML = this._renderPopupContent(data);
        popup.appendChild(content);

        this._popupContainer.appendChild(popup);
        obj.popupEl = popup;
        obj.popupOpen = true;

        // Position popup near the 3D object on screen
        this._updatePopupPosition(obj);
    }

    _renderPopupContent(data) {
        const tip = (data.popupTip || 'text').toLowerCase();
        const raw = data.popupContent || '';
        if (!raw) return '<p style="color:#888">İçerik yok</p>';

        switch (tip) {
            case 'text': {
                const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                return lines.map(l => `<p>${this._escHtml(l)}</p>`).join('');
            }
            case 'html':
                return raw;
            case 'image':
                return `<img src="${this._escAttr(raw)}" style="width:100%;border-radius:6px;">`;
            case 'video':
                return `<video src="${this._escAttr(raw)}" controls playsinline style="width:100%;border-radius:6px;"></video>`;
            case 'youtube': {
                const id = raw.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
                const src = id ? `https://www.youtube.com/embed/${id[1]}` : raw;
                return `<iframe src="${this._escAttr(src)}" style="width:100%;height:200px;border:none;border-radius:6px;" allowfullscreen></iframe>`;
            }
            case 'link':
                return `<a href="${this._escAttr(raw)}" target="_blank" rel="noopener" style="color:#c9a96e;">${this._escHtml(raw)}</a>`;
            case 'iframe':
                return `<iframe src="${this._escAttr(raw)}" style="width:100%;height:250px;border:none;border-radius:6px;"></iframe>`;
            case 'pdf':
                return `<iframe src="${this._escAttr(raw)}" style="width:100%;height:300px;border:none;border-radius:6px;"></iframe>`;
            default:
                return `<p>${this._escHtml(raw)}</p>`;
        }
    }

    _updatePopupPosition(obj) {
        if (!obj.popupEl || !obj.popupOpen) return;
        const pos = obj.group.position.clone();
        pos.y += 1.2;
        pos.project(this.camera);
        const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-pos.y * 0.5 + 0.5) * window.innerHeight;
        obj.popupEl.style.left = `${Math.max(10, Math.min(x - 150, window.innerWidth - 320))}px`;
        obj.popupEl.style.top = `${Math.max(10, Math.min(y - 200, window.innerHeight - 100))}px`;
    }

    _closePopup(obj) {
        if (obj.popupEl) {
            obj.popupEl.remove();
            obj.popupEl = null;
        }
        obj.popupOpen = false;
    }

    _closeAllPopups() {
        for (const obj of this.objects) this._closePopup(obj);
    }

    // ---- EDIT MODE ----

    _toggleEditMode() {
        this.editMode = !this.editMode;

        if (this.editMode) {
            this._enterEditMode();
        } else {
            this._exitEditMode();
        }
    }

    _enterEditMode() {
        // Overlay
        this._editOverlay.style.display = 'block';
        // Dim models
        this.scene.traverse((child) => {
            if (child.isMesh && !child.userData.isHotspot) {
                child._origOpacity = child.material.opacity;
                child._origTransparent = child.material.transparent;
                child.material.transparent = true;
                child.material.opacity = 0.4;
            }
        });
        // Hide panels
        document.querySelectorAll('#leftHtmlPanel, #rightHtmlPanel, #description').forEach(el => {
            el.style.display = 'none';
        });
        // Show toolbar
        this._editToolbar.style.display = 'flex';
        // Setup transform controls
        if (!this.transformControls) {
            this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
            this.transformControls.addEventListener('dragging-changed', (e) => {
                if (this.orbitControls) this.orbitControls.enabled = !e.value;
            });
            this.transformControls.addEventListener('change', () => {
                this._updateEditInfo();
            });
            this.scene.add(this.transformControls);
        }
        this.transformControls.setMode(this.gizmoMode);
        this.transformControls.visible = true;
    }

    _exitEditMode() {
        this._editOverlay.style.display = 'none';
        this._editToolbar.style.display = 'none';
        // Restore models
        this.scene.traverse((child) => {
            if (child.isMesh && child._origOpacity !== undefined) {
                child.material.opacity = child._origOpacity;
                child.material.transparent = child._origTransparent;
                delete child._origOpacity;
                delete child._origTransparent;
            }
        });
        // Show panels back
        document.querySelectorAll('#leftHtmlPanel, #rightHtmlPanel').forEach(el => {
            el.style.display = 'block';
        });
        // Detach gizmo
        if (this.transformControls) {
            this.transformControls.detach();
            this.transformControls.visible = false;
        }
        this.selectedObject = null;
        if (this.orbitControls) this.orbitControls.enabled = true;
    }

    _selectObject(obj) {
        this.selectedObject = obj;
        if (this.transformControls) {
            this.transformControls.attach(obj.group);
            this.transformControls.setMode(this.gizmoMode);
        }
        this._updateEditInfo();
    }

    _updateEditInfo() {
        if (!this.selectedObject) return;
        const g = this.selectedObject.group;
        const info = this._editToolbar.querySelector('.vea-edit-info');
        if (info) {
            const p = g.position;
            const r = g.rotation;
            const s = g.scale.x;
            info.textContent = `${this.selectedObject.data.name}  ·  P(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})  R(${r.x.toFixed(2)}, ${r.y.toFixed(2)}, ${r.z.toFixed(2)})  S(${s.toFixed(2)})`;
        }
    }

    _copyToClipboard() {
        // Build Excel-pasteable TSV for all hotspots in current scene
        const rows = [];
        for (const obj of this.objects) {
            const d = obj.data;
            const g = obj.group;
            const p = g.position;
            const rot = g.rotation;
            const s = g.scale.x;
            // Excel format: # | Ad | Tip | Link | Popup Tip | Popup İçerik | PosX | PosY | PosZ | RotX | RotY | RotZ | Scale | Toggle Kod
            rows.push([
                obj.data.order || rows.length + 1,
                d.name,
                d.hotspotTip,
                d.hotspotUrl,
                d.popupTip,
                d.popupContent,
                p.x.toFixed(3),
                p.y.toFixed(3),
                p.z.toFixed(3),
                rot.x.toFixed(3),
                rot.y.toFixed(3),
                rot.z.toFixed(3),
                s.toFixed(3),
                d.toggleKod || 'null'
            ].join('\t'));
        }
        const tsv = rows.join('\n');
        navigator.clipboard.writeText(tsv).then(() => {
            const btn = this._editToolbar.querySelector('.vea-edit-copy');
            if (btn) {
                btn.textContent = '✓ Kopyalandı!';
                setTimeout(() => { btn.textContent = '📋 Copy'; }, 2000);
            }
        });
    }

    // ---- DOM SETUP ----

    _setupDOM() {
        // Popup container
        this._popupContainer = document.createElement('div');
        this._popupContainer.id = 'vea-hotspot-popups';
        document.body.appendChild(this._popupContainer);

        // Edit mode overlay (white bg)
        this._editOverlay = document.createElement('div');
        this._editOverlay.className = 'vea-edit-overlay';
        this._editOverlay.style.display = 'none';
        document.body.appendChild(this._editOverlay);

        // Edit toolbar
        this._editToolbar = document.createElement('div');
        this._editToolbar.className = 'vea-edit-toolbar';
        this._editToolbar.style.display = 'none';
        this._editToolbar.innerHTML = `
            <span class="vea-edit-badge">EDIT MODE</span>
            <button class="vea-edit-btn active" data-mode="translate">Move</button>
            <button class="vea-edit-btn" data-mode="rotate">Rotate</button>
            <button class="vea-edit-btn" data-mode="scale">Scale</button>
            <span class="vea-edit-info"></span>
            <button class="vea-edit-copy">📋 Copy</button>
            <button class="vea-edit-exit">✕ Exit</button>
        `;
        document.body.appendChild(this._editToolbar);

        // Toolbar events
        this._editToolbar.querySelectorAll('.vea-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.gizmoMode = btn.dataset.mode;
                if (this.transformControls) this.transformControls.setMode(this.gizmoMode);
                this._editToolbar.querySelectorAll('.vea-edit-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        this._editToolbar.querySelector('.vea-edit-copy').addEventListener('click', (e) => {
            e.stopPropagation();
            this._copyToClipboard();
        });
        this._editToolbar.querySelector('.vea-edit-exit').addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleEditMode();
        });

        // Inject CSS
        if (!document.getElementById('vea-hotspot-css')) {
            const style = document.createElement('style');
            style.id = 'vea-hotspot-css';
            style.textContent = `
                .vea-edit-overlay {
                    position: fixed; inset: 0; background: rgba(255,255,255,0.15);
                    z-index: 5; pointer-events: none;
                }
                .vea-edit-toolbar {
                    position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
                    z-index: 100; display: flex; align-items: center; gap: 8px;
                    background: rgba(0,0,0,0.85); padding: 8px 16px;
                    border-radius: 12px; border: 1px solid rgba(255,255,255,0.15);
                    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                    font-family: 'Raleway', sans-serif; user-select: none;
                }
                .vea-edit-badge {
                    color: #ff4444; font-size: 10px; font-weight: 700;
                    letter-spacing: 0.2em; text-transform: uppercase;
                }
                .vea-edit-btn, .vea-edit-copy, .vea-edit-exit {
                    background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
                    color: #fff; padding: 5px 12px; border-radius: 6px;
                    font-size: 11px; cursor: pointer; font-family: inherit;
                    transition: background 0.15s, border-color 0.15s;
                }
                .vea-edit-btn:hover, .vea-edit-copy:hover { background: rgba(201,169,110,0.2); }
                .vea-edit-btn.active { background: rgba(201,169,110,0.35); border-color: #c9a96e; color: #c9a96e; }
                .vea-edit-exit { color: #ff6666; border-color: rgba(255,100,100,0.3); }
                .vea-edit-exit:hover { background: rgba(255,50,50,0.2); }
                .vea-edit-info {
                    color: rgba(255,255,255,0.6); font-size: 10px;
                    letter-spacing: 0.05em; min-width: 200px;
                }
                .vea-edit-copy { color: #c9a96e; }

                #vea-hotspot-popups { position: fixed; inset: 0; pointer-events: none; z-index: 30; }
                .vea-hotspot-popup {
                    position: absolute; width: 300px; max-height: 350px;
                    background: rgba(0,0,0,0.88); backdrop-filter: blur(12px);
                    border: 1px solid rgba(255,255,255,0.12); border-radius: 12px;
                    padding: 14px; color: #fff; font-family: 'Raleway', sans-serif;
                    font-size: 13px; pointer-events: all; overflow-y: auto;
                    box-shadow: 0 8px 30px rgba(0,0,0,0.6);
                }
                .vea-hotspot-popup-close {
                    position: absolute; top: 8px; right: 10px;
                    background: none; border: none; color: #888; font-size: 16px;
                    cursor: pointer; padding: 2px 6px;
                }
                .vea-hotspot-popup-close:hover { color: #fff; }
                .vea-hotspot-popup-title {
                    font-size: 14px; font-weight: 700; color: #c9a96e;
                    margin-bottom: 8px; padding-right: 20px;
                }
                .vea-hotspot-popup-content p { margin: 4px 0; line-height: 1.5; }
                .vea-hotspot-popup-content img,
                .vea-hotspot-popup-content video,
                .vea-hotspot-popup-content iframe { margin-top: 8px; }
                .vea-hotspot-popup::-webkit-scrollbar { width: 3px; }
                .vea-hotspot-popup::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 3px; }
            `;
            document.head.appendChild(style);
        }
    }

    _setupEvents() {
        // Shift+E → toggle edit mode
        document.addEventListener('keydown', (e) => {
            if (e.shiftKey && e.code === 'KeyE') {
                e.preventDefault();
                this._toggleEditMode();
            }
        });

        // Click → select hotspot or show popup
        this.renderer.domElement.addEventListener('click', (e) => {
            this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            this.raycaster.setFromCamera(this.mouse, this.camera);

            const sprites = this.objects
                .filter(o => o.group.visible)
                .map(o => o.sprite);
            const intersects = this.raycaster.intersectObjects(sprites);

            if (intersects.length > 0) {
                const hit = intersects[0].object;
                const obj = this.objects.find(o => o.sprite === hit);
                if (!obj) return;

                if (this.editMode) {
                    this._selectObject(obj);
                } else {
                    this._showPopup(obj);
                }
            }
        });
    }

    _clearObjects() {
        for (const obj of this.objects) {
            this._closePopup(obj);
            this.scene.remove(obj.group);
            obj.sprite.material.map?.dispose();
            obj.sprite.material.dispose();
            obj.label?.material.map?.dispose();
            obj.label?.material.dispose();
        }
        this.objects = [];
    }

    _escHtml(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
    _escAttr(s) {
        return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }
}
