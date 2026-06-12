// furniture-panel.js — Furniture Panel UI
// Two main tabs: Presets (ready-made GLB sets) + Items (individual pieces)

import { getCategories, getItemsByCategory, getAllItems, getAllPresets } from './furniture-library.js';

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
     * @param {HTMLElement} containerEl — the panel element (e.g. leftHtmlPanel)
     * @param {Function} onSpawn — callback(libraryItem) for individual item spawn
     * @param {Function} onPresetToggle — callback(preset, isLoading) for preset load/remove
     */
    constructor(containerEl, onSpawn, onPresetToggle) {
        this.container = containerEl;
        this.onSpawn = onSpawn || (() => {});
        this.onPresetToggle = onPresetToggle || (() => {});
        this._activeCat = null;
        this._activeMainTab = 'presets'; // 'presets' or 'items'
        this._root = null;
        this._contentEl = null;
        this._gridEl = null;
        this._observer = null;
        this._resizeObs = null;
        this._editor = null; // set externally to check preset state
    }

    /** Set the furniture editor reference (for checking loaded presets) */
    setEditor(editor) { this._editor = editor; }

    /** Build the full UI into the container. */
    build() {
        this.container.innerHTML = '';

        this._root = document.createElement('div');
        this._root.className = 'vea-furniture-panel';

        // Main tab bar: Presets | Items
        const mainBar = document.createElement('div');
        mainBar.className = 'vea-furniture-main-tabs';

        const presetsTab = document.createElement('button');
        presetsTab.className = 'vea-furniture-main-tab active';
        presetsTab.textContent = 'Presets';
        presetsTab.addEventListener('click', () => this._switchMainTab('presets', presetsTab));
        mainBar.appendChild(presetsTab);

        const itemsTab = document.createElement('button');
        itemsTab.className = 'vea-furniture-main-tab';
        itemsTab.textContent = 'Items';
        itemsTab.addEventListener('click', () => this._switchMainTab('items', itemsTab));
        mainBar.appendChild(itemsTab);

        this._root.appendChild(mainBar);

        // Content area
        this._contentEl = document.createElement('div');
        this._contentEl.className = 'vea-furniture-content';
        this._root.appendChild(this._contentEl);

        this.container.appendChild(this._root);

        // Show presets by default
        this._renderPresets();
    }

    show() {
        this.container.style.display = 'block';
        this.container.classList.add('vea-furniture-wide');
    }

    hide() {
        this.container.style.display = 'none';
        this.container.classList.remove('vea-furniture-wide');
    }

    get visible() {
        return this.container.style.display !== 'none';
    }

    /** Refresh the current view (e.g. after preset load/remove) */
    refresh() {
        if (this._activeMainTab === 'presets') this._renderPresets();
    }

    // ---- MAIN TAB SWITCHING ----

    _switchMainTab(tab, btnEl) {
        this._activeMainTab = tab;
        this._root.querySelectorAll('.vea-furniture-main-tab').forEach(t => t.classList.remove('active'));
        btnEl.classList.add('active');
        if (tab === 'presets') this._renderPresets();
        else this._renderItemsView();
    }

    // ---- PRESETS VIEW ----

    _renderPresets() {
        this._contentEl.innerHTML = '';
        const presets = getAllPresets();

        for (const preset of presets) {
            const isLoaded = this._editor?.isPresetLoaded(preset.id);
            const card = document.createElement('div');
            card.className = 'vea-preset-card' + (isLoaded ? ' loaded' : '');

            card.innerHTML = `
                <div class="vea-preset-name">${preset.name}</div>
                <div class="vea-preset-tags">${preset.tags.map(t => `<span class="vea-preset-tag">${t}</span>`).join('')}</div>
                <div class="vea-preset-desc">${preset.description || ''}</div>
                <button class="vea-preset-btn ${isLoaded ? 'remove' : 'add'}">${isLoaded ? 'Kaldır' : 'Yükle'}</button>
            `;

            card.querySelector('.vea-preset-btn').addEventListener('click', () => {
                this.onPresetToggle(preset, !isLoaded);
            });

            this._contentEl.appendChild(card);
        }

        if (presets.length === 0) {
            this._contentEl.innerHTML = '<p style="color:rgba(255,255,255,0.4);font-size:12px;padding:10px;">Henüz preset yok</p>';
        }
    }

    // ---- ITEMS VIEW ----

    _renderItemsView() {
        this._contentEl.innerHTML = '';

        // Search box — filters by name and tags
        this._query = '';
        const searchWrap = document.createElement('div');
        searchWrap.className = 'vea-furniture-search';
        const searchInput = document.createElement('input');
        searchInput.type = 'search';
        searchInput.placeholder = 'Mobilya ara…';
        searchInput.addEventListener('input', () => {
            this._query = searchInput.value.trim().toLowerCase();
            this._applyFilter();
        });
        // Keep R/T/S/Del shortcuts from firing while typing
        searchInput.addEventListener('keydown', (e) => e.stopPropagation());
        searchWrap.appendChild(searchInput);
        this._contentEl.appendChild(searchWrap);

        // Category tab bar
        const tabBar = document.createElement('div');
        tabBar.className = 'vea-furniture-tabs';

        const allTab = this._createTab('Tümü', null);
        allTab.classList.add('active');
        tabBar.appendChild(allTab);

        for (const cat of getCategories()) {
            tabBar.appendChild(this._createTab(CATEGORY_LABELS[cat] || cat, cat));
        }
        this._contentEl.appendChild(tabBar);

        // Grid
        this._gridEl = document.createElement('div');
        this._gridEl.className = 'vea-furniture-grid';
        this._contentEl.appendChild(this._gridEl);

        this._setupLazyLoad();
        this._setupSquareObserver();
        this._applyFilter();
    }

    filterByCategory(cat) {
        this._activeCat = cat;
        this._applyFilter();

        const tabs = this._contentEl.querySelectorAll('.vea-furniture-tab');
        tabs.forEach(t => t.classList.toggle('active', t.dataset.cat === (cat || '')));
    }

    _applyFilter() {
        let items = this._activeCat ? getItemsByCategory(this._activeCat) : getAllItems();
        if (this._query) {
            const q = this._query;
            items = items.filter(i =>
                i.name.toLowerCase().includes(q) ||
                (i.tags || []).some(t => String(t).toLowerCase().includes(q)));
        }
        this._renderGrid(items);
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
        if (this._observer) {
            this._gridEl.querySelectorAll('img[data-src]').forEach(img => {
                this._observer.observe(img);
            });
        }
        requestAnimationFrame(() => this._enforceSquare());
    }

    _createThumbCard(item) {
        const card = document.createElement('div');
        card.className = 'vea-furniture-thumb';
        card.draggable = true;

        const imgWrap = document.createElement('div');
        imgWrap.className = 'vea-furniture-thumb-img';
        const img = document.createElement('img');
        img.dataset.src = item.thumbnailUrl;
        img.alt = item.name;
        img.loading = 'lazy';
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        imgWrap.appendChild(img);
        card.appendChild(imgWrap);

        const label = document.createElement('span');
        label.className = 'vea-furniture-thumb-label';
        label.textContent = item.name.replace(/\.glb$/i, '').replace(/_/g, ' ');
        card.appendChild(label);

        card.addEventListener('click', () => this.onSpawn(item));

        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('application/x-furniture-id', item.id);
            e.dataTransfer.setData('text/plain', item.id);
            e.dataTransfer.effectAllowed = 'copy';
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

    _setupSquareObserver() {
        if (this._resizeObs) this._resizeObs.disconnect();
        this._resizeObs = new ResizeObserver(() => this._enforceSquare());
        this._resizeObs.observe(this._gridEl);
    }

    _enforceSquare() {
        if (!this._gridEl) return;
        const cards = this._gridEl.querySelectorAll('.vea-furniture-thumb');
        if (cards.length === 0) return;
        const w = cards[0].offsetWidth;
        if (w <= 0) return;
        const h = w + 'px';
        for (const card of cards) card.style.height = h;
    }

    dispose() {
        if (this._observer) this._observer.disconnect();
        if (this._resizeObs) this._resizeObs.disconnect();
        this.container.innerHTML = '';
    }
}
