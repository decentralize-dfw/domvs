// furniture-panel.js — Thumbnail Grid UI (Prompt 3/7)
// Category tabs + 3-column lazy-load thumbnail grid with click & drag-to-spawn

import { getCategories, getItemsByCategory, getAllItems } from './furniture-library.js';

const CATEGORY_LABELS = {
    des_sculpture: 'Sculpture',
    des_automobile: 'Automobile',
    des_chair: 'Chair',
    des_sofa: 'Sofa',
    des_table: 'Table',
    des_music: 'Music',
    des_carpet: 'Carpet'
};

export class FurniturePanel {
    /**
     * @param {HTMLElement} containerEl — the panel element to render into (e.g. leftHtmlPanel)
     * @param {Function} onSpawn — callback(libraryItem) when user clicks a thumbnail
     */
    constructor(containerEl, onSpawn) {
        this.container = containerEl;
        this.onSpawn = onSpawn || (() => {});
        this._activeCat = null; // null = show all
        this._root = null;
        this._gridEl = null;
        this._observer = null; // IntersectionObserver for lazy-load
    }

    /** Build the full UI into the container. */
    build() {
        this.container.innerHTML = '';

        // Root wrapper
        this._root = document.createElement('div');
        this._root.className = 'vea-furniture-panel';

        // Tab bar
        const tabBar = document.createElement('div');
        tabBar.className = 'vea-furniture-tabs';

        // "All" tab
        const allTab = this._createTab('Tümü', null);
        allTab.classList.add('active');
        tabBar.appendChild(allTab);

        // Category tabs
        for (const cat of getCategories()) {
            tabBar.appendChild(this._createTab(CATEGORY_LABELS[cat] || cat, cat));
        }

        this._root.appendChild(tabBar);

        // Grid container
        this._gridEl = document.createElement('div');
        this._gridEl.className = 'vea-furniture-grid';
        this._root.appendChild(this._gridEl);

        this.container.appendChild(this._root);

        // Setup lazy-load observer
        this._setupLazyLoad();

        // Render initial grid (all items)
        this._renderGrid(getAllItems());
    }

    /** Filter grid by category key (null = all). */
    filterByCategory(cat) {
        this._activeCat = cat;
        const items = cat ? getItemsByCategory(cat) : getAllItems();
        this._renderGrid(items);

        // Update active tab
        const tabs = this._root.querySelectorAll('.vea-furniture-tab');
        tabs.forEach(t => {
            t.classList.toggle('active', t.dataset.cat === (cat || ''));
        });
    }

    /** Show the panel. */
    show() {
        this.container.style.display = 'block';
        this.container.classList.add('vea-furniture-wide');
    }

    /** Hide the panel. */
    hide() {
        this.container.style.display = 'none';
        this.container.classList.remove('vea-furniture-wide');
    }

    /** Whether the panel is currently visible. */
    get visible() {
        return this.container.style.display !== 'none';
    }

    // ---- INTERNAL ----

    _createTab(label, catKey) {
        const tab = document.createElement('button');
        tab.className = 'vea-furniture-tab';
        tab.textContent = label;
        tab.dataset.cat = catKey || '';
        tab.addEventListener('click', () => this.filterByCategory(catKey));
        return tab;
    }

    _renderGrid(items) {
        this._gridEl.innerHTML = '';
        for (const item of items) {
            this._gridEl.appendChild(this._createThumbCard(item));
        }
        // Re-observe new images for lazy-load
        if (this._observer) {
            this._gridEl.querySelectorAll('img[data-src]').forEach(img => {
                this._observer.observe(img);
            });
        }
    }

    _createThumbCard(item) {
        const card = document.createElement('div');
        card.className = 'vea-furniture-thumb';
        card.draggable = true;

        // Thumbnail image (lazy-load)
        const img = document.createElement('img');
        img.dataset.src = item.thumbnailUrl;
        img.alt = item.name;
        img.loading = 'lazy';
        // Placeholder: transparent 1x1
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        card.appendChild(img);

        // Label
        const label = document.createElement('span');
        label.className = 'vea-furniture-thumb-label';
        // Clean name: remove .glb extension, replace underscores
        label.textContent = item.name.replace(/\.glb$/i, '').replace(/_/g, ' ');
        card.appendChild(label);

        // Click → spawn
        card.addEventListener('click', () => this.onSpawn(item));

        // Drag start → set item id for canvas drop
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('application/x-furniture-id', item.id);
            e.dataTransfer.setData('text/plain', item.id);
            e.dataTransfer.effectAllowed = 'copy';
            // Use thumbnail as drag image
            if (img.naturalWidth) {
                e.dataTransfer.setDragImage(img, img.naturalWidth / 2, img.naturalHeight / 2);
            }
        });

        return card;
    }

    _setupLazyLoad() {
        if (this._observer) this._observer.disconnect();
        this._observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        delete img.dataset.src;
                    }
                    this._observer.unobserve(img);
                }
            }
        }, { root: this._gridEl, rootMargin: '100px' });
    }

    /** Clean up. */
    dispose() {
        if (this._observer) this._observer.disconnect();
        this.container.innerHTML = '';
    }
}
