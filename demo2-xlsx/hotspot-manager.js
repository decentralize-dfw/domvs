/* =============================================================
   VEA DEMO 2 — HOTSPOT MANAGER
   3D hotspot rendering, popup, edit mode with gizmo + list panel.
   ============================================================= */

import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const _gltfLoader = new GLTFLoader();
const _dracoLoader = new DRACOLoader();
_dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
_gltfLoader.setDRACOLoader(_dracoLoader);
_gltfLoader.setMeshoptDecoder(MeshoptDecoder);

export class HotspotManager {
    constructor(threeScene, camera, renderer, config, sceneIndex, orbitControls) {
        this.scene = threeScene;
        this.camera = camera;
        this.renderer = renderer;
        this.config = config;
        this.sceneIndex = sceneIndex;
        this.orbitControls = orbitControls;

        this.hotspots = [];
        this.objects = [];
        this.editMode = false;
        this.selectedObject = null;
        this.transformControls = null;
        this.gizmoMode = 'translate';
        this._gizmoDragging = false;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this._popupContainer = null;
        this._editOverlay = null;
        this._editToolbar = null;
        this._editListPanel = null;

        this._injectCSS();
        this._setupDOM();
        this._setupTransformControls();
        this._setupEvents();
    }

    // ---- PUBLIC ----

    loadHotspots(activeToggle = null) {
        const sd = this.config?.scenes?.[this.sceneIndex];
        if (!sd || !sd.hotspots) return;
        this.hotspots = sd.hotspots;
        this._clearObjects();
        for (const hs of this.hotspots) this._createHotspot(hs);
        this.setToggle(activeToggle);
    }

    setToggle(toggleKod) {
        for (const obj of this.objects) {
            const tk = obj.data.toggleKod;
            obj.group.visible = !tk || tk === toggleKod || toggleKod === null;
        }
        this._closeAllPopups();
    }

    update() {
        // Labels face camera
        for (const obj of this.objects) {
            if (obj.label) obj.label.lookAt(this.camera.position);
        }
        // Update popup screen positions
        for (const obj of this.objects) {
            if (obj.popupOpen) this._updatePopupPosition(obj);
        }
        // Update list values if edit mode
        if (this.editMode) this._refreshList();
    }

    // ---- HOTSPOT CREATION ----

    _createHotspot(data) {
        const group = new THREE.Group();
        group.position.set(data.pos.x, data.pos.y, data.pos.z);
        group.rotation.set(data.rot.x, data.rot.y, data.rot.z);
        const s = data.scale || 1;
        group.scale.set(s, s, s);
        group.userData.hotspotData = data;

        const tip = (data.hotspotTip || 'png').toLowerCase();
        const url = data.hotspotUrl || '';
        let clickTarget = null; // the object raycasted for clicks

        if (tip === 'glb' && url) {
            // ---- GLB MODEL ----
            // Load async, add to group when ready. GLB does NOT rotate
            // with camera (stays fixed in world space).
            const placeholder = this._makeGoldDot();
            placeholder.userData.isHotspotSprite = true;
            group.add(placeholder);
            clickTarget = placeholder;

            _gltfLoader.load(url, (gltf) => {
                const model = gltf.scene;
                model.traverse(c => {
                    if (c.isMesh) {
                        c.userData.isHotspotSprite = true;
                        c.castShadow = false;
                        c.receiveShadow = false;
                    }
                });
                group.add(model);
                // Remove placeholder dot once GLB is loaded
                group.remove(placeholder);
                placeholder.material.map?.dispose();
                placeholder.material.dispose();
                // Use the GLB's first mesh as click target
                const firstMesh = [];
                model.traverse(c => { if (c.isMesh) firstMesh.push(c); });
                if (firstMesh.length) {
                    const obj = this.objects.find(o => o.group === group);
                    if (obj) obj.sprite = firstMesh[0];
                }
            }, undefined, (err) => {
                console.warn('Hotspot GLB load failed:', url, err);
            });
        } else if (tip === 'png' && url) {
            // ---- PNG SPRITE (always faces camera) ----
            const tex = new THREE.TextureLoader().load(url);
            tex.colorSpace = THREE.SRGBColorSpace;
            const mat = new THREE.SpriteMaterial({
                map: tex, depthTest: true, sizeAttenuation: true,
                transparent: true
            });
            const sprite = new THREE.Sprite(mat);
            sprite.scale.set(1, 1, 1);
            sprite.userData.isHotspotSprite = true;
            group.add(sprite);
            clickTarget = sprite;
        } else {
            // ---- FALLBACK: gold dot ----
            const dot = this._makeGoldDot();
            dot.userData.isHotspotSprite = true;
            group.add(dot);
            clickTarget = dot;
        }

        // Floating name label (always faces camera, sits above marker)
        const label = this._makeLabelSprite(data.name);
        label.position.set(0, 0.8, 0);
        group.add(label);

        this.scene.add(group);
        this.objects.push({
            data, group, sprite: clickTarget, label,
            popupOpen: false, popupEl: null
        });
    }

    _makeGoldDot() {
        const c = document.createElement('canvas');
        c.width = 64; c.height = 64;
        const x = c.getContext('2d');
        x.beginPath(); x.arc(32, 32, 28, 0, Math.PI * 2);
        x.fillStyle = 'rgba(201,169,110,0.85)'; x.fill();
        x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 3; x.stroke();
        x.beginPath(); x.arc(32, 32, 8, 0, Math.PI * 2);
        x.fillStyle = '#fff'; x.fill();
        const mat = new THREE.SpriteMaterial({
            map: new THREE.CanvasTexture(c), depthTest: true, sizeAttenuation: true
        });
        const s = new THREE.Sprite(mat);
        s.scale.set(0.5, 0.5, 0.5);
        return s;
    }

    _makeLabelSprite(text) {
        const c = document.createElement('canvas');
        c.width = 512; c.height = 128;
        const x = c.getContext('2d');
        x.clearRect(0, 0, 512, 128);
        x.fillStyle = 'rgba(0,0,0,0.7)';
        x.beginPath(); x.roundRect(10, 20, 492, 88, 20); x.fill();
        x.strokeStyle = 'rgba(201,169,110,0.6)'; x.lineWidth = 2; x.stroke();
        x.fillStyle = '#fff'; x.font = 'bold 36px Arial';
        x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(text || '', 256, 64);
        const mat = new THREE.SpriteMaterial({
            map: new THREE.CanvasTexture(c), depthTest: true, sizeAttenuation: true
        });
        const s = new THREE.Sprite(mat);
        s.scale.set(1.5, 0.4, 1);
        return s;
    }

    // ---- POPUP ----

    _showPopup(obj) {
        if (obj.popupOpen) { this._closePopup(obj); return; }
        const d = obj.data;
        const popup = document.createElement('div');
        popup.className = 'vea-hs-popup';
        popup.innerHTML = `
            <button class="vea-hs-popup-x" onclick="this.parentElement.remove()">✕</button>
            <div class="vea-hs-popup-title">${this._esc(d.name)}</div>
            <div class="vea-hs-popup-body">${this._renderContent(d.popupTip, d.popupContent)}</div>`;
        popup.querySelector('.vea-hs-popup-x').addEventListener('click', () => this._closePopup(obj));
        this._popupContainer.appendChild(popup);
        obj.popupEl = popup; obj.popupOpen = true;
        this._updatePopupPosition(obj);
    }

    _renderContent(tip, raw) {
        if (!raw) return '<p style="color:#666">—</p>';
        tip = (tip || 'text').toLowerCase();
        switch (tip) {
            case 'text': return raw.split(/\n/).map(l => `<p>${this._esc(l)}</p>`).join('');
            case 'html': return raw;
            case 'image': return `<img src="${this._attr(raw)}" style="width:100%;border-radius:6px">`;
            case 'video': return `<video src="${this._attr(raw)}" controls playsinline style="width:100%;border-radius:6px"></video>`;
            case 'youtube': {
                const id = raw.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
                return `<iframe src="https://www.youtube.com/embed/${id?.[1]||raw}" style="width:100%;height:200px;border:none;border-radius:6px" allowfullscreen></iframe>`;
            }
            case 'link': return `<a href="${this._attr(raw)}" target="_blank" style="color:#c9a96e">${this._esc(raw)}</a>`;
            case 'iframe': case 'pdf': return `<iframe src="${this._attr(raw)}" style="width:100%;height:260px;border:none;border-radius:6px"></iframe>`;
            default: return `<p>${this._esc(raw)}</p>`;
        }
    }

    _updatePopupPosition(obj) {
        if (!obj.popupEl) return;
        // Project hotspot 3D position to screen coordinates
        const worldPos = obj.group.position.clone();
        worldPos.y += 1.5; // offset above the marker
        worldPos.project(this.camera);
        const screenX = (worldPos.x * 0.5 + 0.5) * window.innerWidth;
        const screenY = (-worldPos.y * 0.5 + 0.5) * window.innerHeight;
        // Center popup horizontally on the hotspot, place ABOVE it
        const popupW = 300;
        const popupH = obj.popupEl.offsetHeight || 200;
        let left = screenX - popupW / 2;
        let top = screenY - popupH - 20; // 20px gap above the marker
        // Clamp to viewport
        left = Math.max(10, Math.min(left, window.innerWidth - popupW - 10));
        top = Math.max(10, Math.min(top, window.innerHeight - 50));
        // If popup would go above viewport, place it below instead
        if (top < 10) top = screenY + 30;
        obj.popupEl.style.left = left + 'px';
        obj.popupEl.style.top = top + 'px';
    }

    _closePopup(obj) { if (obj.popupEl) { obj.popupEl.remove(); obj.popupEl = null; } obj.popupOpen = false; }
    _closeAllPopups() { for (const o of this.objects) this._closePopup(o); }

    // ---- TRANSFORM CONTROLS (created ONCE, reused) ----

    _setupTransformControls() {
        this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
        this.transformControls.visible = false;
        this.transformControls.enabled = false;

        // CRITICAL: stop orbit when gizmo is being dragged
        this.transformControls.addEventListener('dragging-changed', (e) => {
            this._gizmoDragging = e.value;
            if (this.orbitControls) this.orbitControls.enabled = !e.value;
        });

        this.transformControls.addEventListener('change', () => {
            this._refreshList();
        });

        // Prevent click-through: when gizmo is active, mousedown on it
        // should NOT propagate to the scene click handler
        this.transformControls.addEventListener('mouseDown', () => {
            this._gizmoDragging = true;
        });
        this.transformControls.addEventListener('mouseUp', () => {
            setTimeout(() => { this._gizmoDragging = false; }, 50);
        });

        this.scene.add(this.transformControls);
    }

    // ---- EDIT MODE ----

    _toggleEditMode() {
        this.editMode = !this.editMode;
        this.editMode ? this._enterEditMode() : this._exitEditMode();
    }

    _enterEditMode() {
        this._editOverlay.style.display = 'block';
        this._editToolbar.style.display = 'flex';
        this._editListPanel.style.display = 'block';

        // Dim scene models
        this.scene.traverse(c => {
            if (c.isMesh && !c.userData.isHotspotSprite) {
                c._origOp = c.material.opacity;
                c._origTr = c.material.transparent;
                c.material.transparent = true;
                c.material.opacity = 0.4;
            }
        });

        // Hide panels
        document.querySelectorAll('#leftHtmlPanel,#rightHtmlPanel,#description').forEach(el => el.style.display = 'none');

        // Enable gizmo
        this.transformControls.visible = true;
        this.transformControls.enabled = true;
        this.transformControls.setMode(this.gizmoMode);

        this._buildList();
    }

    _exitEditMode() {
        this._editOverlay.style.display = 'none';
        this._editToolbar.style.display = 'none';
        this._editListPanel.style.display = 'none';

        // Restore models
        this.scene.traverse(c => {
            if (c.isMesh && c._origOp !== undefined) {
                c.material.opacity = c._origOp;
                c.material.transparent = c._origTr;
                delete c._origOp; delete c._origTr;
            }
        });

        document.querySelectorAll('#leftHtmlPanel,#rightHtmlPanel').forEach(el => el.style.display = 'block');

        this.transformControls.detach();
        this.transformControls.visible = false;
        this.transformControls.enabled = false;
        this.selectedObject = null;
        if (this.orbitControls) this.orbitControls.enabled = true;
    }

    _selectObject(obj) {
        this.selectedObject = obj;
        this.transformControls.attach(obj.group);
        this.transformControls.setMode(this.gizmoMode);

        // Highlight in list
        this._editListPanel.querySelectorAll('.vea-hs-list-row').forEach(row => {
            row.classList.toggle('selected', row.dataset.idx === String(this.objects.indexOf(obj)));
        });
    }

    // ---- LIST PANEL ----

    _buildList() {
        const body = this._editListPanel.querySelector('.vea-hs-list-body');
        body.innerHTML = '';
        this.objects.forEach((obj, i) => {
            const row = document.createElement('div');
            row.className = 'vea-hs-list-row';
            row.dataset.idx = i;
            row.innerHTML = `<span class="vea-hs-list-name">${this._esc(obj.data.name)}</span>
                <span class="vea-hs-list-vals" data-idx="${i}"></span>`;
            row.addEventListener('click', (e) => {
                e.stopPropagation();
                this._selectObject(obj);
            });
            body.appendChild(row);
        });
        this._refreshList();
    }

    _refreshList() {
        if (!this._editListPanel) return;
        this.objects.forEach((obj, i) => {
            const el = this._editListPanel.querySelector(`.vea-hs-list-vals[data-idx="${i}"]`);
            if (!el) return;
            const p = obj.group.position;
            const r = obj.group.rotation;
            const s = obj.group.scale.x;
            el.textContent = `P(${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}) R(${r.x.toFixed(1)},${r.y.toFixed(1)},${r.z.toFixed(1)}) S(${s.toFixed(2)})`;
        });
        // Toolbar info
        if (this.selectedObject) {
            const g = this.selectedObject.group;
            const info = this._editToolbar.querySelector('.vea-edit-info');
            if (info) info.textContent = `${this.selectedObject.data.name}  P(${g.position.x.toFixed(2)}, ${g.position.y.toFixed(2)}, ${g.position.z.toFixed(2)})`;
        }
    }

    // ---- CLIPBOARD ----

    _copyToClipboard() {
        // Sayısal değerlerde noktayı virgüle çevir — Türkçe lokale
        // Google Sheets "10.169" noktayı binlik ayracı sanıp 10169 yapıyor.
        // Virgülle yazarsak "10,169" → 10.169 olarak doğru algılar.
        const fmtNum = (n) => n.toFixed(3).replace('.', ',');

        const rows = this.objects.map((obj, i) => {
            const d = obj.data, g = obj.group, p = g.position, rot = g.rotation;
            return [
                i + 1,
                d.name,
                d.hotspotTip,
                d.hotspotUrl,
                d.popupTip,
                d.popupContent,
                fmtNum(p.x), fmtNum(p.y), fmtNum(p.z),
                fmtNum(rot.x), fmtNum(rot.y), fmtNum(rot.z),
                fmtNum(g.scale.x),
                d.toggleKod || 'null'
            ].join('\t');
        });
        navigator.clipboard.writeText(rows.join('\n')).then(() => {
            const btn = this._editToolbar.querySelector('.vea-edit-copy');
            if (btn) { btn.textContent = '✓ Copied!'; setTimeout(() => btn.textContent = '📋 Copy', 2000); }
        });
    }

    // ---- DOM ----

    _setupDOM() {
        // Popup container
        this._popupContainer = document.createElement('div');
        this._popupContainer.id = 'vea-hs-popups';
        document.body.appendChild(this._popupContainer);

        // Edit overlay
        this._editOverlay = document.createElement('div');
        this._editOverlay.className = 'vea-edit-overlay';
        this._editOverlay.style.display = 'none';
        document.body.appendChild(this._editOverlay);

        // Toolbar
        this._editToolbar = document.createElement('div');
        this._editToolbar.className = 'vea-edit-toolbar';
        this._editToolbar.style.display = 'none';
        this._editToolbar.innerHTML = `
            <span class="vea-edit-badge">EDIT</span>
            <button class="vea-edit-btn active" data-mode="translate">Move</button>
            <button class="vea-edit-btn" data-mode="rotate">Rotate</button>
            <button class="vea-edit-btn" data-mode="scale">Scale</button>
            <span class="vea-edit-info"></span>
            <button class="vea-edit-copy">📋 Copy</button>
            <button class="vea-edit-exit">✕</button>`;
        document.body.appendChild(this._editToolbar);

        this._editToolbar.querySelectorAll('.vea-edit-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                this.gizmoMode = btn.dataset.mode;
                this.transformControls.setMode(this.gizmoMode);
                this._editToolbar.querySelectorAll('.vea-edit-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        this._editToolbar.querySelector('.vea-edit-copy').addEventListener('click', e => { e.stopPropagation(); this._copyToClipboard(); });
        this._editToolbar.querySelector('.vea-edit-exit').addEventListener('click', e => { e.stopPropagation(); this._toggleEditMode(); });

        // List panel (left side)
        this._editListPanel = document.createElement('div');
        this._editListPanel.className = 'vea-hs-list';
        this._editListPanel.style.display = 'none';
        this._editListPanel.innerHTML = `
            <div class="vea-hs-list-title">Hotspots</div>
            <div class="vea-hs-list-body"></div>`;
        document.body.appendChild(this._editListPanel);
    }

    _setupEvents() {
        // Shift+E toggle
        document.addEventListener('keydown', e => {
            if (e.shiftKey && e.code === 'KeyE') { e.preventDefault(); this._toggleEditMode(); }
        });

        // Click on scene → detect hotspot
        this.renderer.domElement.addEventListener('click', e => {
            // Skip if gizmo was just used
            if (this._gizmoDragging) return;

            this.mouse.x = (e.clientX / innerWidth) * 2 - 1;
            this.mouse.y = -(e.clientY / innerHeight) * 2 + 1;
            this.raycaster.setFromCamera(this.mouse, this.camera);

            // Collect all clickable targets (sprites for png, meshes for glb)
            const targets = [];
            const targetMap = new Map();
            for (const o of this.objects) {
                if (!o.group.visible) continue;
                if (o.sprite) {
                    targets.push(o.sprite);
                    targetMap.set(o.sprite, o);
                }
                // For GLB hotspots, also add all child meshes
                o.group.traverse(c => {
                    if (c.isMesh && c.userData.isHotspotSprite) {
                        targets.push(c);
                        targetMap.set(c, o);
                    }
                });
            }
            const hits = this.raycaster.intersectObjects(targets, false);
            if (hits.length === 0) return;

            const obj = targetMap.get(hits[0].object);
            if (!obj) return;

            if (this.editMode) {
                this._selectObject(obj);
            } else {
                this._showPopup(obj);
            }
        });

        // Prevent orbit when clicking on toolbar/list
        [this._editToolbar, this._editListPanel].forEach(el => {
            el.addEventListener('mousedown', e => e.stopPropagation());
            el.addEventListener('pointerdown', e => e.stopPropagation());
        });
    }

    _clearObjects() {
        for (const o of this.objects) {
            this._closePopup(o);
            this.scene.remove(o.group);
            o.sprite.material.map?.dispose(); o.sprite.material.dispose();
            o.label?.material.map?.dispose(); o.label?.material.dispose();
        }
        this.objects = [];
    }

    _esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    _attr(s) { return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;'); }

    // ---- CSS ----

    _injectCSS() {
        if (document.getElementById('vea-hs-css')) return;
        const st = document.createElement('style');
        st.id = 'vea-hs-css';
        st.textContent = `
.vea-edit-overlay{position:fixed;inset:0;background:rgba(255,255,255,0.12);z-index:5;pointer-events:none}
.vea-edit-toolbar{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:200;display:flex;align-items:center;gap:8px;background:rgba(0,0,0,0.9);padding:8px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.15);box-shadow:0 4px 24px rgba(0,0,0,0.6);font-family:'Raleway',sans-serif;user-select:none}
.vea-edit-badge{color:#ff4444;font-size:10px;font-weight:700;letter-spacing:.25em}
.vea-edit-btn,.vea-edit-copy,.vea-edit-exit{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:#fff;padding:5px 12px;border-radius:6px;font-size:11px;cursor:pointer;font-family:inherit;transition:all .15s}
.vea-edit-btn:hover,.vea-edit-copy:hover{background:rgba(201,169,110,0.2)}
.vea-edit-btn.active{background:rgba(201,169,110,0.35);border-color:#c9a96e;color:#c9a96e}
.vea-edit-exit{color:#ff6666;border-color:rgba(255,80,80,0.3)}
.vea-edit-exit:hover{background:rgba(255,50,50,0.2)}
.vea-edit-info{color:rgba(255,255,255,0.6);font-size:10px;letter-spacing:.04em;min-width:180px}
.vea-edit-copy{color:#c9a96e}

.vea-hs-list{position:fixed;left:10px;top:60px;bottom:20px;width:260px;background:rgba(0,0,0,0.92);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.1);border-radius:12px;z-index:200;overflow-y:auto;font-family:'Raleway',sans-serif;color:#fff}
.vea-hs-list-title{padding:12px 14px 8px;font-size:12px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#c9a96e;border-bottom:1px solid rgba(255,255,255,0.08)}
.vea-hs-list-body{padding:6px}
.vea-hs-list-row{padding:8px 10px;border-radius:8px;cursor:pointer;margin-bottom:4px;transition:background .12s;border:1px solid transparent}
.vea-hs-list-row:hover{background:rgba(255,255,255,0.06)}
.vea-hs-list-row.selected{background:rgba(201,169,110,0.15);border-color:rgba(201,169,110,0.4)}
.vea-hs-list-name{display:block;font-size:12px;font-weight:600;margin-bottom:3px}
.vea-hs-list-vals{display:block;font-size:9px;color:rgba(255,255,255,0.45);font-family:monospace;letter-spacing:.02em}

#vea-hs-popups{position:fixed;inset:0;pointer-events:none;z-index:30}
.vea-hs-popup{position:absolute;width:300px;max-height:350px;background:rgba(0,0,0,0.88);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:14px;color:#fff;font-family:'Raleway',sans-serif;font-size:13px;pointer-events:all;overflow-y:auto;box-shadow:0 8px 30px rgba(0,0,0,0.6)}
.vea-hs-popup-x{position:absolute;top:8px;right:10px;background:none;border:none;color:#888;font-size:16px;cursor:pointer;padding:2px 6px}
.vea-hs-popup-x:hover{color:#fff}
.vea-hs-popup-title{font-size:14px;font-weight:700;color:#c9a96e;margin-bottom:8px;padding-right:20px}
.vea-hs-popup-body p{margin:4px 0;line-height:1.5}
.vea-hs-popup-body img,.vea-hs-popup-body video,.vea-hs-popup-body iframe{margin-top:8px}
.vea-hs-popup::-webkit-scrollbar{width:3px}
.vea-hs-popup::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.3);border-radius:3px}
`;
        document.head.appendChild(st);
    }
}
