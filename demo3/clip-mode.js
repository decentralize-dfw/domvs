// clip-mode.js — Plan view clipping + ortho camera + "Dikey Kesit Yüksekliği" slider
// Extracted from demo3-scene.html initCamerasMode()

import * as THREE from 'three';
import { FURNITURE_CONFIG as C } from './furniture-config.js';

export class ClipModeManager {
    /**
     * @param {Object} deps
     * @param {THREE.Scene} deps.scene
     * @param {THREE.WebGLRenderer} deps.renderer
     * @param {any} deps.composer              — EffectComposer (accesses passes[0].camera)
     * @param {any} deps.orbitControls
     * @param {THREE.OrthographicCamera} deps.orthoCamera
     * @param {THREE.PerspectiveCamera} deps.perspCamera
     * @param {number} [deps.clipFrustum=12]
     * @param {number} [deps.clipPercentDefault=0.40]
     * @param {(newCamera: THREE.Camera) => void} deps.onCameraSwitch
     *        — called whenever ortho <-> persp switch happens, so caller
     *        can update hotspotMgr.camera, furnitureEditor.camera, etc.
     * @param {() => void} [deps.onEnterPlan]
     *        — optional: called after plan view activated (dim nav dots, exempt gumballs)
     */
    constructor(deps) {
        this.scene = deps.scene;
        this.renderer = deps.renderer;
        this.composer = deps.composer;
        this.orbitControls = deps.orbitControls;
        this.orthoCamera = deps.orthoCamera;
        this.perspCamera = deps.perspCamera;
        this.clipFrustum = deps.clipFrustum ?? C.clipFrustumSize;
        this._clipPercent = deps.clipPercentDefault ?? C.clipPercentDefault;
        this._onCameraSwitch = deps.onCameraSwitch || (() => {});
        this._onEnterPlan = deps.onEnterPlan || (() => {});

        this._cachedBBox = null;
        this._sceneBBox = null;
        this._clippingPlane = null;
        this._clippedMeshes = [];
        this._sliderEl = null;
    }

    // ---- BBox (computed once) ----

    /** Compute scene bounding box once from loaded models (skips helpers, furniture, gizmos) */
    computeAndCacheBBox() {
        this.scene.updateMatrixWorld(true);
        this._cachedBBox = new THREE.Box3();
        this.scene.traverse(c => {
            if (!c.isMesh) return;
            if (C.clippingSkipFlags.some(f => c.userData[f])) return;
            if (c.type === 'TransformControlsPlane' || c.type === 'TransformControlsGizmo') return;
            // Skip children of TransformControls
            let p = c.parent;
            while (p) {
                if (p.isTransformControls || p.type === 'TransformControlsGizmo') return;
                p = p.parent;
            }
            if (!c.geometry) return;
            if (!c.geometry.boundingBox) c.geometry.computeBoundingBox();
            if (!c.geometry.boundingBox) return;
            const size = new THREE.Vector3();
            c.geometry.boundingBox.getSize(size);
            if (size.x > 500 || size.y > 500 || size.z > 500) return;
            const worldBB = c.geometry.boundingBox.clone();
            worldBB.applyMatrix4(c.matrixWorld);
            this._cachedBBox.union(worldBB);
        });
        if (this._cachedBBox.isEmpty()) {
            this._cachedBBox.set(new THREE.Vector3(-10, -1, -10), new THREE.Vector3(10, 10, 10));
        }
        this._sceneBBox = this._cachedBBox.clone();
    }

    get cachedBBox() { return this._cachedBBox; }
    get clippingPlane() { return this._clippingPlane; }
    get clipPercent() { return this._clipPercent; }
    set clipPercent(v) {
        this._clipPercent = v;
        this._updateSliderLabel();
        this.updateClipPlane();
    }

    // ---- Plan view (ortho + clipping) ----

    /** Enter plan view: switch to ortho camera, apply clipping plane, show slider */
    switchToPlanView(buttonIndex, toggleButtons) {
        if (toggleButtons) {
            toggleButtons.forEach((btn, i) => btn.classList.toggle('selected', i === buttonIndex));
        }
        // Use cached bbox copy
        this._sceneBBox = this._cachedBBox
            ? this._cachedBBox.clone()
            : new THREE.Box3(new THREE.Vector3(-10, -1, -10), new THREE.Vector3(10, 10, 10));

        const center = new THREE.Vector3();
        this._sceneBBox.getCenter(center);
        const dist = C.planViewDist;
        this.orthoCamera.position.set(
            center.x + dist * Math.cos(Math.PI / 4),
            center.y + dist * Math.sin(Math.PI / 4),
            center.z + dist * Math.cos(Math.PI / 4)
        );
        this.orthoCamera.lookAt(center);
        const a = window.innerWidth / window.innerHeight;
        this.orthoCamera.left = -this.clipFrustum * a / 2;
        this.orthoCamera.right = this.clipFrustum * a / 2;
        this.orthoCamera.top = this.clipFrustum / 2;
        this.orthoCamera.bottom = -this.clipFrustum / 2;
        this.orthoCamera.updateProjectionMatrix();

        // Switch composer + orbit to ortho
        this.composer.passes[0].camera = this.orthoCamera;
        this.orbitControls.object = this.orthoCamera;
        this.orbitControls.target.copy(center);
        this.orbitControls.enablePan = true;
        this.orbitControls.enableZoom = true;
        this.orbitControls.enableRotate = true;
        this.orbitControls.minDistance = 0;
        this.orbitControls.maxDistance = Infinity;
        this.orbitControls.update();

        // Build clipping plane
        const height = this._sceneBBox.max.y - this._sceneBBox.min.y;
        this._clippingPlane = new THREE.Plane(
            new THREE.Vector3(0, -1, 0),
            this._sceneBBox.min.y + this._clipPercent * height
        );

        // Clone materials → apply clip plane (skips furniture/hotspots/cam helpers)
        this._clippedMeshes = [];
        this.scene.traverse(c => {
            if (!c.isMesh) return;
            if (C.clippingSkipFlags.some(f => c.userData[f])) return;
            const orig = c.material;
            const clone = orig.clone();
            clone.clippingPlanes = [this._clippingPlane];
            clone.clipShadows = false;
            clone.needsUpdate = true;
            c.material = clone;
            this._clippedMeshes.push({ mesh: c, origMaterial: orig });
        });
        this.renderer.localClippingEnabled = true;

        // Reduce bloom in plan view (save original if not already saved)
        const bloomPass = this.composer.passes.find(p => p.strength !== undefined);
        if (bloomPass && bloomPass._origStrength === undefined) {
            bloomPass._origStrength = bloomPass.strength;
            bloomPass.strength = C.bloomStrengthInPlan;
        }

        // Notify caller — they update hotspotMgr.camera, etc.
        this._onCameraSwitch(this.orthoCamera);
        this._onEnterPlan();
        this.showSlider();
    }

    /** Exit plan view: restore materials, switch to persp camera */
    switchToPerspView() {
        this.hideSlider();

        for (const entry of this._clippedMeshes) {
            const cloned = entry.mesh.material;
            entry.mesh.material = entry.origMaterial;
            cloned.dispose();
        }
        this._clippedMeshes = [];
        this.renderer.localClippingEnabled = false;
        this._clippingPlane = null;

        const bloomPass = this.composer.passes.find(p => p._origStrength !== undefined);
        if (bloomPass) {
            bloomPass.strength = bloomPass._origStrength;
            delete bloomPass._origStrength;
        }

        this.composer.passes[0].camera = this.perspCamera;
        this.orbitControls.object = this.perspCamera;
        this.orbitControls.enablePan = false;
        this.orbitControls.minDistance = 0.001;
        this.orbitControls.maxDistance = 0.02;
        this.orbitControls.update();

        this._onCameraSwitch(this.perspCamera);
    }

    /** Live-update clip plane constant (called by slider) */
    updateClipPlane() {
        if (!this._clippingPlane || !this._sceneBBox) return;
        const height = this._sceneBBox.max.y - this._sceneBBox.min.y;
        this._clippingPlane.constant = this._sceneBBox.min.y + this._clipPercent * height;
    }

    // ---- Slider UI ----

    showSlider() {
        if (this._sliderEl) { this._sliderEl.style.display = 'flex'; return; }
        this._sliderEl = document.createElement('div');
        this._sliderEl.className = 'vea-clip-slider-wrap';
        const pct = Math.round(this._clipPercent * 100);
        this._sliderEl.innerHTML = `
            <label class="vea-clip-slider-label">Dikey Kesit Yüksekliği</label>
            <input type="range" class="vea-clip-slider" min="${C.clipPercentMin}" max="${C.clipPercentMax}" value="${pct}" step="1">
            <span class="vea-clip-slider-value">${pct}%</span>
        `;
        document.body.appendChild(this._sliderEl);
        const slider = this._sliderEl.querySelector('.vea-clip-slider');
        const valLabel = this._sliderEl.querySelector('.vea-clip-slider-value');
        slider.addEventListener('input', () => {
            this._clipPercent = parseInt(slider.value) / 100;
            valLabel.textContent = slider.value + '%';
            this.updateClipPlane();
        });
    }

    hideSlider() {
        if (this._sliderEl) this._sliderEl.style.display = 'none';
    }

    _updateSliderLabel() {
        if (!this._sliderEl) return;
        const pct = Math.round(this._clipPercent * 100);
        const slider = this._sliderEl.querySelector('.vea-clip-slider');
        const valLabel = this._sliderEl.querySelector('.vea-clip-slider-value');
        if (slider) slider.value = pct;
        if (valLabel) valLabel.textContent = pct + '%';
    }

    /** Clean up (remove slider from DOM) */
    dispose() {
        if (this._sliderEl) {
            this._sliderEl.remove();
            this._sliderEl = null;
        }
    }
}
