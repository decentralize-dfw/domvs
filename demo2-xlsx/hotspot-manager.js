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
            if (!tk) {
                // toggleKod boş → her zaman görünür
                obj.group.visible = true;
            } else {
                // toggleKod dolu → sadece eşleşen toggle'da görünür
                obj.group.visible = (tk === toggleKod);
            }
        }
        this._closeAllPopups();
    }

    update() {
        for (const obj of this.objects) {
            if (obj.label) {
                // Compute bounding box top of the hotspot group
                const box = new THREE.Box3().setFromObject(obj.group);
                const topY = box.max.y;
                const center = new THREE.Vector3();
                box.getCenter(center);
                // Place label just above the top of bounding box
                obj.label.position.set(center.x, topY + 0.3, center.z);
                obj.label.visible = obj.group.visible;
                // Fixed world-space size (won't change with hotspot scale)
                obj.label.scale.set(4.5, 1.2, 1);
            }
            if (obj.popupOpen) this._updatePopupPosition(obj);
        }
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

        // Floating name label — added to SCENE (not group) so it
        // doesn't scale with the hotspot. Position updated in update().
        const label = this._makeLabelSprite(data.name);
        this.scene.add(label);

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
        // Project bounding box top to screen
        const box = new THREE.Box3().setFromObject(obj.group);
        const worldPos = new THREE.Vector3();
        box.getCenter(worldPos);
        worldPos.y = box.max.y + 0.8; // above bounding box top
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

            const nameEl = document.createElement('span');
            nameEl.className = 'vea-hs-list-name';
            nameEl.textContent = obj.data.name;
            nameEl.addEventListener('click', (e) => {
                e.stopPropagation();
                this._selectObject(obj);
            });
            row.appendChild(nameEl);

            // Editable fields grid
            const grid = document.createElement('div');
            grid.className = 'vea-hs-list-grid';
            const fields = [
                { label: 'X', get: () => obj.group.position.x, set: v => { obj.group.position.x = v; } },
                { label: 'Y', get: () => obj.group.position.y, set: v => { obj.group.position.y = v; } },
                { label: 'Z', get: () => obj.group.position.z, set: v => { obj.group.position.z = v; } },
                { label: 'RX', get: () => obj.group.rotation.x, set: v => { obj.group.rotation.x = v; } },
                { label: 'RY', get: () => obj.group.rotation.y, set: v => { obj.group.rotation.y = v; } },
                { label: 'RZ', get: () => obj.group.rotation.z, set: v => { obj.group.rotation.z = v; } },
                { label: 'S', get: () => obj.group.scale.x, set: v => { obj.group.scale.set(v, v, v); } },
            ];

            for (const f of fields) {
                const cell = document.createElement('div');
                cell.className = 'vea-hs-field';

                const lbl = document.createElement('span');
                lbl.className = 'vea-hs-field-label';
                lbl.textContent = f.label;
                cell.appendChild(lbl);

                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'vea-hs-field-input';
                input.dataset.objIdx = i;
                input.dataset.fieldLabel = f.label;
                input.value = f.get().toFixed(2);
                input._fieldRef = f;

                // Commit on Enter or blur
                const commit = () => {
                    const val = parseFloat(input.value.replace(',', '.'));
                    if (!isNaN(val)) {
                        f.set(val);
                        input.value = f.get().toFixed(2);
                    } else {
                        input.value = f.get().toFixed(2);
                    }
                };
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commit(); input.blur(); }
                    e.stopPropagation(); // prevent scene shortcuts (WASD etc.)
                });
                input.addEventListener('blur', commit);
                input.addEventListener('focus', () => input.select());
                input.addEventListener('click', (e) => e.stopPropagation());
                input.addEventListener('mousedown', (e) => e.stopPropagation());
                input.addEventListener('pointerdown', (e) => e.stopPropagation());

                cell.appendChild(input);
                grid.appendChild(cell);
            }

            row.appendChild(grid);
            body.appendChild(row);
        });
    }

    _refreshList() {
        if (!this._editListPanel) return;
        // Only update inputs that are NOT focused (don't overwrite while user types)
        this.objects.forEach((obj, i) => {
            const inputs = this._editListPanel.querySelectorAll(`.vea-hs-field-input[data-obj-idx="${i}"]`);
            inputs.forEach(input => {
                if (document.activeElement === input) return; // skip focused
                const f = input._fieldRef;
                if (f) input.value = f.get().toFixed(2);
            });
        });
        // Toolbar info
        if (this.selectedObject) {
            const g = this.selectedObject.group;
            const p = g.position;
            const info = this._editToolbar.querySelector('.vea-edit-info');
            if (info) info.textContent = `${this.selectedObject.data.name}  P(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`;
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
            if (o.label) {
                this.scene.remove(o.label);
                o.label.material.map?.dispose();
                o.label.material.dispose();
            }
            o.sprite?.material?.map?.dispose();
            o.sprite?.material?.dispose();
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
.vea-hs-list-name{display:block;font-size:12px;font-weight:600;margin-bottom:5px;cursor:pointer;color:#c9a96e}
.vea-hs-list-name:hover{text-decoration:underline}
.vea-hs-list-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:3px}
.vea-hs-field{display:flex;align-items:center;gap:2px}
.vea-hs-field-label{font-size:8px;color:rgba(255,255,255,0.35);font-weight:700;min-width:14px;text-align:right}
.vea-hs-field-input{width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#ddd;font-size:10px;font-family:monospace;padding:2px 4px;border-radius:4px;outline:none;text-align:right}
.vea-hs-field-input:focus{border-color:#c9a96e;background:rgba(201,169,110,0.1);color:#fff}

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

/* =============================================================
   CAMERA EDITOR — Shift+C toggle
   Editable camera positions for scenes with toggle cameras.
   Shows a list panel with Pos/LookAt/FOV fields, arrow helpers
   in 3D, and clipboard export in Excel format.
   ============================================================= */

export class CameraEditor {
    constructor(threeScene, camera, renderer, config, sceneIndex, orbitControls, sceneCfg) {
        this.scene = threeScene;
        this.camera = camera;
        this.renderer = renderer;
        this.config = config;
        this.sceneIndex = sceneIndex;
        this.orbitControls = orbitControls;
        this.sceneCfg = sceneCfg;
        this.active = false;
        this._panel = null;
        this._cameras = [];
        this._helpers = []; // {posSprite, lookSprite, line, camData}
        this._transformControls = null;
        this._selectedHelper = null;
        this._dragMode = 'pos'; // 'pos' or 'look'
        this._gizmoDragging = false;

        // Save original camera state for restore
        this._origCamPos = camera.position.clone();
        this._origCamTarget = orbitControls ? orbitControls.target.clone() : new THREE.Vector3();

        this._parseFromButtons();
        this._setupTransformControls();
        this._setupDOM();
        this._setupEvents();
    }

    _parseFromButtons() {
        if (!this.sceneCfg?.buttons) return;
        for (const btn of this.sceneCfg.buttons) {
            const action = btn.action || '';
            const m = action.match(
                /Pos\(([^)]+)\)\s*(?:→|->)?\s*LookAt\(([^)]+)\)(?:\s*·\s*FOV\s*(\d+(?:\.\d+)?))?/
            );
            if (m) {
                const p = m[1].split(',').map(s => parseFloat(s.trim()));
                const l = m[2].split(',').map(s => parseFloat(s.trim()));
                this._cameras.push({
                    name: btn.name,
                    kod: btn.kod || btn.id,
                    pos: { x: p[0]||0, y: p[1]||0, z: p[2]||0 },
                    lookAt: { x: l[0]||0, y: l[1]||0, z: l[2]||0 },
                    fov: m[3] ? parseFloat(m[3]) : 80
                });
            }
        }
    }

    _setupTransformControls() {
        this._transformControls = new TransformControls(this.camera, this.renderer.domElement);
        this._transformControls.visible = false;
        this._transformControls.enabled = false;
        this._transformControls.setMode('translate');
        this._transformControls.addEventListener('dragging-changed', e => {
            this._gizmoDragging = e.value;
            if (this.orbitControls) this.orbitControls.enabled = !e.value;
        });
        this._transformControls.addEventListener('change', () => this._syncFromHelpers());
        this._transformControls.addEventListener('mouseDown', () => { this._gizmoDragging = true; });
        this._transformControls.addEventListener('mouseUp', () => {
            setTimeout(() => { this._gizmoDragging = false; }, 50);
        });
        this.scene.add(this._transformControls);
    }

    _toggle() {
        this.active = !this.active;
        if (this.active) this._enterEditMode();
        else this._exitEditMode();
    }

    _enterEditMode() {
        this._panel.style.display = 'block';

        // Save current camera
        this._origCamPos.copy(this.camera.position);
        if (this.orbitControls) this._origCamTarget.copy(this.orbitControls.target);

        // Move camera to ISO 45° overview
        this.camera.position.set(15, 20, 15);
        if (this.camera.fov) { this.camera.fov = 60; this.camera.updateProjectionMatrix(); }
        if (this.orbitControls) {
            this.orbitControls.target.set(0, 1, 0);
            this.orbitControls.enabled = true;
            this.orbitControls.update();
        }

        // Dim models %40
        this.scene.traverse(c => {
            if (c.isMesh && !c.userData._isCamHelper) {
                c._origOp = c.material.opacity;
                c._origTr = c.material.transparent;
                c.material.transparent = true;
                c.material.opacity = 0.4;
            }
        });

        // Hide panels
        document.querySelectorAll('#leftHtmlPanel,#rightHtmlPanel,#description').forEach(el => el.style.display = 'none');

        // Create 3D helpers for each camera
        this._createHelpers();
        this._transformControls.visible = true;
        this._transformControls.enabled = true;
        this._buildList();
    }

    _exitEditMode() {
        this._panel.style.display = 'none';

        // Restore camera
        this.camera.position.copy(this._origCamPos);
        if (this.orbitControls) {
            this.orbitControls.target.copy(this._origCamTarget);
            this.orbitControls.update();
        }

        // Restore models
        this.scene.traverse(c => {
            if (c.isMesh && c._origOp !== undefined) {
                c.material.opacity = c._origOp;
                c.material.transparent = c._origTr;
                delete c._origOp; delete c._origTr;
            }
        });

        document.querySelectorAll('#leftHtmlPanel,#rightHtmlPanel').forEach(el => el.style.display = 'block');

        // Remove helpers
        this._removeHelpers();
        this._transformControls.detach();
        this._transformControls.visible = false;
        this._transformControls.enabled = false;
        if (this.orbitControls) this.orbitControls.enabled = true;
    }

    // ---- 3D HELPERS: camera icon + eye icon + dashed line ----

    _createHelpers() {
        this._removeHelpers();
        const colors = [0x4488ff, 0xff8844, 0x44ff88, 0xff44aa, 0xaaff44, 0x44aaff];

        this._cameras.forEach((cam, i) => {
            const color = colors[i % colors.length];

            // Camera position → blue sphere
            const posGeo = new THREE.SphereGeometry(0.15, 16, 16);
            const posMat = new THREE.MeshBasicMaterial({ color, depthTest: true });
            const posMesh = new THREE.Mesh(posGeo, posMat);
            posMesh.position.set(cam.pos.x, cam.pos.y, cam.pos.z);
            posMesh.userData._isCamHelper = true;
            posMesh.userData._camIdx = i;
            posMesh.userData._type = 'pos';
            this.scene.add(posMesh);

            // LookAt position → smaller sphere (eye)
            const lookGeo = new THREE.SphereGeometry(0.1, 12, 12);
            const lookMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: true });
            const lookMesh = new THREE.Mesh(lookGeo, lookMat);
            lookMesh.position.set(cam.lookAt.x, cam.lookAt.y, cam.lookAt.z);
            lookMesh.userData._isCamHelper = true;
            lookMesh.userData._camIdx = i;
            lookMesh.userData._type = 'look';
            this.scene.add(lookMesh);

            // Dashed line between pos and lookAt
            const lineGeo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(cam.pos.x, cam.pos.y, cam.pos.z),
                new THREE.Vector3(cam.lookAt.x, cam.lookAt.y, cam.lookAt.z)
            ]);
            const lineMat = new THREE.LineDashedMaterial({
                color, dashSize: 0.15, gapSize: 0.1, depthTest: true
            });
            const line = new THREE.Line(lineGeo, lineMat);
            line.computeLineDistances();
            line.userData._isCamHelper = true;
            this.scene.add(line);

            // Label
            const lc = document.createElement('canvas');
            lc.width = 256; lc.height = 64;
            const lx = lc.getContext('2d');
            lx.fillStyle = 'rgba(0,0,0,0.6)';
            lx.beginPath(); lx.roundRect(2, 2, 252, 60, 10); lx.fill();
            lx.fillStyle = '#fff'; lx.font = 'bold 24px Arial';
            lx.textAlign = 'center'; lx.textBaseline = 'middle';
            lx.fillText(`📷 ${cam.name}`, 128, 32);
            const labelMat = new THREE.SpriteMaterial({
                map: new THREE.CanvasTexture(lc), depthTest: true, sizeAttenuation: true
            });
            const label = new THREE.Sprite(labelMat);
            label.scale.set(1.5, 0.4, 1);
            label.position.set(cam.pos.x, cam.pos.y + 0.4, cam.pos.z);
            label.userData._isCamHelper = true;
            this.scene.add(label);

            this._helpers.push({ posMesh, lookMesh, line, label, camData: cam, color });
        });
    }

    _removeHelpers() {
        for (const h of this._helpers) {
            this.scene.remove(h.posMesh); h.posMesh.geometry.dispose(); h.posMesh.material.dispose();
            this.scene.remove(h.lookMesh); h.lookMesh.geometry.dispose(); h.lookMesh.material.dispose();
            this.scene.remove(h.line); h.line.geometry.dispose(); h.line.material.dispose();
            this.scene.remove(h.label); h.label.material.map?.dispose(); h.label.material.dispose();
        }
        this._helpers = [];
    }

    _syncFromHelpers() {
        // Sync 3D mesh positions back to camera data + update line
        for (const h of this._helpers) {
            h.camData.pos.x = h.posMesh.position.x;
            h.camData.pos.y = h.posMesh.position.y;
            h.camData.pos.z = h.posMesh.position.z;
            h.camData.lookAt.x = h.lookMesh.position.x;
            h.camData.lookAt.y = h.lookMesh.position.y;
            h.camData.lookAt.z = h.lookMesh.position.z;
            // Update line
            const pts = h.line.geometry.attributes.position;
            pts.setXYZ(0, h.posMesh.position.x, h.posMesh.position.y, h.posMesh.position.z);
            pts.setXYZ(1, h.lookMesh.position.x, h.lookMesh.position.y, h.lookMesh.position.z);
            pts.needsUpdate = true;
            h.line.computeLineDistances();
            // Update label
            h.label.position.set(h.posMesh.position.x, h.posMesh.position.y + 0.4, h.posMesh.position.z);
        }
        this._refreshInputs();
    }

    _selectHelper(helperObj, type) {
        this._selectedHelper = helperObj;
        this._dragMode = type;
        const target = type === 'pos' ? helperObj.posMesh : helperObj.lookMesh;
        this._transformControls.attach(target);

        // Highlight in list
        this._panel.querySelectorAll('.vea-cam-row').forEach((row, i) => {
            row.classList.toggle('selected', i === this._helpers.indexOf(helperObj));
        });
    }

    // ---- LIST PANEL ----

    _buildList() {
        const body = this._panel.querySelector('.vea-cam-list-body');
        body.innerHTML = '';
        this._cameras.forEach((cam, i) => {
            const h = this._helpers[i];
            const row = document.createElement('div');
            row.className = 'vea-cam-row';

            const title = document.createElement('div');
            title.className = 'vea-cam-row-title';
            title.textContent = `📷 ${cam.name}`;
            title.style.borderLeft = `3px solid #${(h?.color || 0x4488ff).toString(16).padStart(6,'0')}`;
            title.style.paddingLeft = '8px';
            row.appendChild(title);

            const grid = document.createElement('div');
            grid.className = 'vea-hs-list-grid';

            const fields = [
                { label: 'PX', get: () => cam.pos.x, set: v => { cam.pos.x = v; if(h) h.posMesh.position.x = v; } },
                { label: 'PY', get: () => cam.pos.y, set: v => { cam.pos.y = v; if(h) h.posMesh.position.y = v; } },
                { label: 'PZ', get: () => cam.pos.z, set: v => { cam.pos.z = v; if(h) h.posMesh.position.z = v; } },
                { label: 'LX', get: () => cam.lookAt.x, set: v => { cam.lookAt.x = v; if(h) h.lookMesh.position.x = v; } },
                { label: 'LY', get: () => cam.lookAt.y, set: v => { cam.lookAt.y = v; if(h) h.lookMesh.position.y = v; } },
                { label: 'LZ', get: () => cam.lookAt.z, set: v => { cam.lookAt.z = v; if(h) h.lookMesh.position.z = v; } },
                { label: 'FOV', get: () => cam.fov, set: v => { cam.fov = v; } },
            ];

            for (const f of fields) {
                const cell = document.createElement('div');
                cell.className = 'vea-hs-field';
                const lbl = document.createElement('span');
                lbl.className = 'vea-hs-field-label';
                lbl.textContent = f.label;
                cell.appendChild(lbl);
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'vea-hs-field-input';
                input.value = f.get().toFixed(2);
                input._fieldRef = f;
                const commit = () => {
                    const val = parseFloat(input.value.replace(',','.'));
                    if (!isNaN(val)) { f.set(val); input.value = f.get().toFixed(2); this._syncFromHelpers(); }
                    else input.value = f.get().toFixed(2);
                };
                input.addEventListener('keydown', e => { if(e.key==='Enter'){e.preventDefault();commit();input.blur();} e.stopPropagation(); });
                input.addEventListener('blur', commit);
                input.addEventListener('focus', () => input.select());
                input.addEventListener('click', e => e.stopPropagation());
                input.addEventListener('mousedown', e => e.stopPropagation());
                input.addEventListener('pointerdown', e => e.stopPropagation());
                cell.appendChild(input);
                grid.appendChild(cell);
            }

            // Select Pos / Select LookAt buttons
            const btnRow = document.createElement('div');
            btnRow.style.cssText = 'display:flex;gap:4px;grid-column:span 4;margin-top:2px';
            const posBtn = document.createElement('button');
            posBtn.className = 'vea-cam-go';
            posBtn.textContent = '⊕ Pos';
            posBtn.addEventListener('click', e => { e.stopPropagation(); if(h) this._selectHelper(h, 'pos'); });
            const lookBtn = document.createElement('button');
            lookBtn.className = 'vea-cam-go';
            lookBtn.textContent = '◉ LookAt';
            lookBtn.addEventListener('click', e => { e.stopPropagation(); if(h) this._selectHelper(h, 'look'); });
            const goBtn = document.createElement('button');
            goBtn.className = 'vea-cam-go';
            goBtn.textContent = '▶ Git';
            goBtn.addEventListener('click', e => { e.stopPropagation(); this._goToCamera(i); });
            btnRow.appendChild(posBtn);
            btnRow.appendChild(lookBtn);
            btnRow.appendChild(goBtn);
            grid.appendChild(btnRow);

            row.appendChild(grid);
            body.appendChild(row);
        });
    }

    _refreshInputs() {
        const inputs = this._panel.querySelectorAll('.vea-hs-field-input');
        inputs.forEach(inp => {
            if (document.activeElement === inp) return;
            const f = inp._fieldRef;
            if (f) inp.value = f.get().toFixed(2);
        });
    }

    _goToCamera(index) {
        const cam = this._cameras[index];
        if (!cam) return;
        // Temporarily exit edit view, apply camera, then re-enter
        this.camera.position.set(cam.pos.x, cam.pos.y, cam.pos.z);
        this.camera.lookAt(cam.lookAt.x, cam.lookAt.y, cam.lookAt.z);
        if (this.camera.fov !== undefined) {
            this.camera.fov = cam.fov;
            this.camera.updateProjectionMatrix();
        }
        if (this.orbitControls) {
            this.orbitControls.target.set(cam.lookAt.x, cam.lookAt.y, cam.lookAt.z);
            this.orbitControls.update();
        }
    }

    _copyToClipboard() {
        const fmtNum = n => n.toFixed(3).replace('.', ',');
        const rows = this._cameras.map((cam, i) => {
            return [
                i + 1, cam.name, cam.kod,
                `Pos(${fmtNum(cam.pos.x)}, ${fmtNum(cam.pos.y)}, ${fmtNum(cam.pos.z)})   → LookAt(${fmtNum(cam.lookAt.x)}, ${fmtNum(cam.lookAt.y)}, ${fmtNum(cam.lookAt.z)})   · FOV ${cam.fov.toFixed(0)}`
            ].join('\t');
        });
        navigator.clipboard.writeText(rows.join('\n')).then(() => {
            const btn = this._panel.querySelector('.vea-cam-copy');
            if (btn) { btn.textContent = '✓ Copied!'; setTimeout(() => btn.textContent = '📋 Copy', 2000); }
        });
    }

    // ---- DOM ----

    _setupDOM() {
        this._panel = document.createElement('div');
        this._panel.className = 'vea-cam-panel';
        this._panel.style.display = 'none';
        this._panel.innerHTML = `
            <div class="vea-cam-header">
                <span class="vea-cam-title">📷 KAMERA EDİTÖRÜ (Shift+C)</span>
                <button class="vea-cam-copy">📋 Copy</button>
                <button class="vea-cam-close">✕</button>
            </div>
            <div class="vea-cam-list-body"></div>`;
        document.body.appendChild(this._panel);

        this._panel.querySelector('.vea-cam-copy').addEventListener('click', e => { e.stopPropagation(); this._copyToClipboard(); });
        this._panel.querySelector('.vea-cam-close').addEventListener('click', e => { e.stopPropagation(); this._toggle(); });
        this._panel.addEventListener('mousedown', e => e.stopPropagation());
        this._panel.addEventListener('pointerdown', e => e.stopPropagation());

        if (!document.getElementById('vea-cam-css')) {
            const st = document.createElement('style');
            st.id = 'vea-cam-css';
            st.textContent = `
.vea-cam-panel{position:fixed;right:10px;top:60px;bottom:20px;width:290px;background:rgba(0,0,0,0.92);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.1);border-radius:12px;z-index:200;overflow-y:auto;font-family:'Raleway',sans-serif;color:#fff}
.vea-cam-header{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.08)}
.vea-cam-title{flex:1;font-size:11px;font-weight:700;letter-spacing:.12em;color:#c9a96e}
.vea-cam-copy,.vea-cam-close{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#fff;padding:4px 10px;border-radius:6px;font-size:10px;cursor:pointer;font-family:inherit}
.vea-cam-copy:hover{background:rgba(201,169,110,0.2);color:#c9a96e}
.vea-cam-close{color:#ff6666;border-color:rgba(255,80,80,0.3)}
.vea-cam-close:hover{background:rgba(255,50,50,0.2)}
.vea-cam-list-body{padding:8px}
.vea-cam-row{padding:8px;border:1px solid rgba(255,255,255,0.06);border-radius:8px;margin-bottom:6px;background:rgba(255,255,255,0.02)}
.vea-cam-row.selected{border-color:rgba(201,169,110,0.5);background:rgba(201,169,110,0.08)}
.vea-cam-row-title{font-size:12px;font-weight:600;color:#c9a96e;margin-bottom:5px;cursor:pointer}
.vea-cam-row-title:hover{text-decoration:underline}
.vea-cam-go{background:rgba(201,169,110,0.15);border:1px solid rgba(201,169,110,0.4);color:#c9a96e;padding:3px 10px;border-radius:5px;font-size:9px;cursor:pointer;font-family:inherit;flex:1;text-align:center}
.vea-cam-go:hover{background:rgba(201,169,110,0.3)}
`;
            document.head.appendChild(st);
        }
    }

    _setupEvents() {
        document.addEventListener('keydown', e => {
            if (e.shiftKey && e.code === 'KeyC') {
                e.preventDefault();
                this._toggle();
            }
        });

        // Click on 3D helper spheres
        this.renderer.domElement.addEventListener('click', e => {
            if (!this.active || this._gizmoDragging) return;
            const mouse = new THREE.Vector2(
                (e.clientX / innerWidth) * 2 - 1,
                -(e.clientY / innerHeight) * 2 + 1
            );
            const rc = new THREE.Raycaster();
            rc.setFromCamera(mouse, this.camera);
            const meshes = [];
            for (const h of this._helpers) { meshes.push(h.posMesh); meshes.push(h.lookMesh); }
            const hits = rc.intersectObjects(meshes);
            if (hits.length > 0) {
                const hit = hits[0].object;
                const idx = hit.userData._camIdx;
                const type = hit.userData._type;
                const helper = this._helpers[idx];
                if (helper) this._selectHelper(helper, type);
            }
        });
    }
}
