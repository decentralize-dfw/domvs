// furniture-ui-helpers.js — safe DOM builders + toast notifications
// Used instead of innerHTML to prevent XSS and centralize styling.

/**
 * Create an element with optional class, text, and children.
 * All text goes through textContent (XSS-safe).
 *
 * @param {string} tag
 * @param {Object} [opts]
 * @param {string} [opts.class]
 * @param {string} [opts.text]
 * @param {Object} [opts.attrs]   — attributes
 * @param {Object} [opts.data]    — data-* attributes
 * @param {Object} [opts.style]   — CSSStyleDeclaration properties
 * @param {Array<HTMLElement|null>} [opts.children]
 * @param {Object} [opts.on]      — event listeners { click: fn, ... }
 */
export function el(tag, opts = {}) {
    const node = document.createElement(tag);
    if (opts.class) node.className = opts.class;
    if (opts.text != null) node.textContent = String(opts.text);
    if (opts.attrs) for (const k in opts.attrs) node.setAttribute(k, opts.attrs[k]);
    if (opts.data) for (const k in opts.data) node.dataset[k] = opts.data[k];
    if (opts.style) Object.assign(node.style, opts.style);
    if (opts.on) for (const k in opts.on) node.addEventListener(k, opts.on[k]);
    if (opts.children) {
        for (const c of opts.children) if (c) node.appendChild(c);
    }
    return node;
}

/** Clear all children from an element */
export function clear(element) {
    while (element.firstChild) element.removeChild(element.firstChild);
}

/** Pretty-print a GLB item name (strip .glb, replace underscores) */
export function cleanName(raw) {
    return String(raw).replace(/\.glb$/i, '').replace(/_/g, ' ');
}

// ---- Toast notifications ----

let _toastContainer = null;

function _ensureToastContainer() {
    if (_toastContainer) return _toastContainer;
    _toastContainer = document.createElement('div');
    _toastContainer.className = 'vea-toast-container';
    document.body.appendChild(_toastContainer);
    return _toastContainer;
}

/**
 * Show a toast message. Returns the toast element.
 * @param {string} message
 * @param {'info'|'warn'|'error'} [type='info']
 * @param {number} [durationMs=4000]
 */
export function toast(message, type = 'info', durationMs = 4000) {
    const container = _ensureToastContainer();
    const node = el('div', {
        class: `vea-toast vea-toast-${type}`,
        text: message,
        on: { click: () => node.remove() }
    });
    container.appendChild(node);
    setTimeout(() => node.remove(), durationMs);
    return node;
}
