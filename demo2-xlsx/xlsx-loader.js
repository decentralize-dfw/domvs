/* =============================================================
   VEA DEMO 2 — XLSX CONFIG LOADER
   -------------------------------------------------------------
   Parses demo2-input_2.xlsx (Sheet: "VEA Config") into a
   structured JS object. Scenes read all of their data from the
   returned object so the xlsx can be edited without touching
   HTML/JS.

   The actual xlsx URL is NOT hardcoded in scene files. Instead
   it lives in a single central file, link.txt, whose URL is the
   constant LINK_TXT_URL below. Update link.txt to point at a
   different xlsx and every scene automatically picks it up.

   Requires SheetJS (XLSX) global — include in the HTML before
   importing this module:
       <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
   ============================================================= */

// --- Central reference file that holds the xlsx URL ---
export const LINK_TXT_URL = 'https://mergvs.com/demo2-xlsx/link.txt';

// --- Section start rows (1-indexed, matching Excel) ---
const SCENE_START_ROWS = {
    0: 33,
    1: 105,
    2: 240,
    3: 346,
    4: 418,
    5: 644
};

/**
 * Fetch link.txt and return the first non-empty, non-comment line.
 * That line is the URL to the xlsx config file.
 */
export async function resolveXlsxUrl(linkTxtUrl = LINK_TXT_URL) {
    const resp = await fetch(linkTxtUrl, { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`link.txt fetch failed: ${resp.status}`);
    const text = await resp.text();
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line) continue;
        if (line.startsWith('#') || line.startsWith('//')) continue;
        return line;
    }
    throw new Error('link.txt contains no usable URL');
}

/**
 * Load the VEA config.
 *   - No arg: resolves xlsx URL from link.txt (the production path)
 *   - String arg: use that URL directly (handy for local overrides)
 */
export async function loadVeaConfig(xlsxPath) {
    const url = xlsxPath || await resolveXlsxUrl();
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`xlsx fetch failed: ${resp.status}`);
    const buf = await resp.arrayBuffer();

    if (typeof XLSX === 'undefined') {
        throw new Error('XLSX (SheetJS) global not found — include xlsx CDN before this module');
    }

    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets['VEA Config'];
    if (!ws) throw new Error('Sheet "VEA Config" not found in workbook');

    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: true });

    const assets = parseGlobalAssets(rows);
    const scenes = {};
    for (const idx in SCENE_START_ROWS) {
        scenes[idx] = parseScene(rows, SCENE_START_ROWS[idx]);
    }

    return {
        assets,
        scenes,
        bgImageUrl: findAssetByType(assets, 'JPEG')?.url || null,
        hdriUrl:    findAssetByType(assets, 'HDRI')?.url || null
    };
}

/**
 * Parse the "▌ SAHNE N  —  Title  ·  Subtitle" header row into parts.
 */
function parseSceneHeader(headerText) {
    if (!headerText) return { title: '', subtitle: '' };
    // Strip leading "▌ SAHNE N  —  "
    const clean = String(headerText).replace(/^▌\s*SAHNE\s*\d+\s*—\s*/u, '').trim();
    const parts = clean.split(/\s*·\s*/);
    return {
        title:    parts[0] || clean,
        subtitle: parts.slice(1).join(' · ')
    };
}

/* ---------- Value coercion helpers ---------- */
export function yes(v) {
    if (v === null || v === undefined) return false;
    return /^yes$/i.test(String(v).trim());
}
export function num(v) {
    if (v === null || v === undefined) return 0;
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
}

/* ---------- Asset lookup ---------- */
function findAssetByType(assets, type) {
    const typeU = type.toUpperCase();
    for (const key in assets) {
        if (String(assets[key].type || '').toUpperCase() === typeU) return assets[key];
    }
    return null;
}

/**
 * Resolve a model entry from a scene to its actual asset URL.
 * modelEntry.assetRow refers to an Excel row number in Global Assets.
 */
export function assetUrlFor(config, modelEntry) {
    if (!modelEntry || !modelEntry.assetRow) return null;
    const asset = config.assets[modelEntry.assetRow];
    return asset ? asset.url : null;
}

/* ---------- Global Assets ---------- */
function parseGlobalAssets(rows) {
    const assets = {};
    // Excel rows 9..29 cover the main assets + empty slots.
    for (let excelRow = 9; excelRow <= 29; excelRow++) {
        const row = rows[excelRow - 1];
        if (!row) continue;
        const name = row[1];  // col B
        const url  = row[2];  // col C
        if (!name || !url) continue;
        const nameStr = String(name).trim().toLowerCase();
        if (nameStr.startsWith('slot') || nameStr === 'null') continue;
        assets[excelRow] = {
            rowNum:   excelRow,
            name:     String(name),
            url:      String(url),
            type:     row[3] ? String(row[3]) : '',
            scenes:   row[4] ? String(row[4]) : '',
            visible:  yes(row[5]),
            collider: yes(row[6]),
            pos:   { x: num(row[7]),  y: num(row[8]),  z: num(row[9])  },
            scale: { x: num(row[10]), y: num(row[11]), z: num(row[12]) },
            autoRot: yes(row[13]),
            notes:   row[14] ? String(row[14]) : ''
        };
    }
    return assets;
}

/* ---------- Scene block ---------- */
function parseScene(rows, sceneStartRowExcel) {
    const sceneIdx = sceneStartRowExcel - 1;
    let sceneEnd = rows.length - 1;
    for (let i = sceneIdx + 1; i < rows.length; i++) {
        const a = rows[i]?.[0];
        if (a && String(a).includes('▌ SAHNE')) {
            sceneEnd = i - 1;
            break;
        }
    }

    const header = parseSceneHeader(rows[sceneIdx]?.[0]);

    return {
        title:    header.title,
        subtitle: header.subtitle,
        camera:   parseCameraSection(rows, sceneIdx, sceneEnd),
        models:   parseModelsSection(rows, sceneIdx, sceneEnd),
        buttons:  parseButtonsSection(rows, sceneIdx, sceneEnd),
        panels:   parsePanelsSection(rows, sceneIdx, sceneEnd)
    };
}

function findMarker(rows, startIdx, endIdx, substring) {
    for (let i = startIdx; i <= endIdx; i++) {
        if (!rows[i]) continue;
        const a = rows[i][0];
        if (a && String(a).includes(substring)) return i;
    }
    return -1;
}

/* ---------- Camera section ---------- */
function parseCameraSection(rows, sceneIdx, sceneEnd) {
    const cam = {};
    const m = findMarker(rows, sceneIdx, sceneEnd, '1 · KAMERA');
    if (m < 0) return cam;
    // Skip the "Parametre | Değer" header row (m+1). Params start at m+2.
    for (let i = m + 2; i <= sceneEnd && i < m + 10; i++) {
        const row = rows[i];
        if (!row) continue;
        const first = row[0];
        if (first === null || first === undefined) break;
        const firstStr = String(first);
        if (firstStr.includes('·')) break; // Next section marker
        // 5 (key, value) pairs: (A,B), (D,E), (G,H), (J,K), (M,N)
        const pairs = [[0, 1], [3, 4], [6, 7], [9, 10], [12, 13]];
        for (const [kc, vc] of pairs) {
            const k = row[kc];
            const v = row[vc];
            if (k && v !== null && v !== undefined) {
                cam[String(k).trim()] = v;
            }
        }
    }
    return cam;
}

/* ---------- Models section ---------- */
function parseModelsSection(rows, sceneIdx, sceneEnd) {
    const models = [];
    const m = findMarker(rows, sceneIdx, sceneEnd, '2 · KULLANILAN MODELLER');
    if (m < 0) return models;

    // Header row is m+1, data starts m+2
    for (let i = m + 2; i <= sceneEnd; i++) {
        const row = rows[i];
        if (!row) continue;
        const a = row[0];
        if (a === null || a === undefined) continue;
        const aStr = String(a).trim();
        if (aStr.startsWith('↓')) break;
        if (aStr.toLowerCase().startsWith('slot')) break;
        if (aStr.includes('·')) break;
        if (!/^\d+$/.test(aStr)) continue;

        // Parse "Asset satır 9" → 9
        const assetRowCell = row[2];
        let assetRow = null;
        if (assetRowCell) {
            const mm = String(assetRowCell).match(/(\d+)/);
            if (mm) assetRow = parseInt(mm[1], 10);
        }

        // Extract model ID from notes column O (index 14): "m1  |  Option 1"
        const notes = String(row[14] ?? '');
        const idMatch = notes.match(/^([a-zA-Z0-9_]+)/);
        let modelId = idMatch ? idMatch[1] : null;
        if (modelId && /^modelurls$/i.test(modelId)) modelId = null;

        models.push({
            assetRow,
            visible: yes(row[3]),
            pos:   { x: num(row[4]),  y: num(row[5]),  z: num(row[6])  },
            rot:   { x: num(row[7]),  y: num(row[8]),  z: num(row[9])  },
            scale: { x: num(row[10]), y: num(row[11]), z: num(row[12]) },
            autoRot: yes(row[13]),
            id: modelId,
            notes
        });
    }
    return models;
}

/* ---------- Buttons section ---------- */
function parseButtonsSection(rows, sceneIdx, sceneEnd) {
    const buttons = [];
    const m = findMarker(rows, sceneIdx, sceneEnd, '3 · TOGGLE BUTONLARI');
    if (m < 0) return buttons;

    for (let i = m + 1; i <= sceneEnd; i++) {
        const row = rows[i];
        if (!row) continue;
        const a = row[0];
        if (a === null || a === undefined) continue;
        const aStr = String(a).trim();
        if (aStr.startsWith('↓')) break;
        if (aStr.toLowerCase().startsWith('slot')) break;
        if (aStr.includes('·')) break;
        if (aStr.toLowerCase().includes('bu sahnede')) continue;
        if (!/^\d+$/.test(aStr)) continue;

        buttons.push({
            name:   row[1] ? String(row[1]).trim() : '',
            id:     row[2] ? String(row[2]).trim() : '',
            action: row[3] ? String(row[3]).trim() : ''
        });
    }
    return buttons;
}

/* ---------- Panels section ---------- */
function parsePanelsSection(rows, sceneIdx, sceneEnd) {
    const panels = {};
    const m = findMarker(rows, sceneIdx, sceneEnd, '4 · BİLGİ PANELLERİ');
    if (m < 0) return panels;

    for (let i = m + 1; i <= sceneEnd; i++) {
        const row = rows[i];
        if (!row) continue;
        const a = String(row[0] ?? '');
        const idMatch = a.match(/Panel ID:\s*([a-zA-Z0-9_]+)/);
        if (!idMatch) continue;
        const panelId = idMatch[1];
        // Content row is at i+2 (skip the "Başlık | İçerik" header at i+1)
        const contentRow = rows[i + 2];
        if (!contentRow) continue;

        let title = String(contentRow[0] ?? '').trim();
        title = title.replace(/\s*\[Buton:[^\]]*\]\s*$/, '').trim();
        const content = String(contentRow[1] ?? '').trim();

        panels[panelId] = { title, content };
    }
    return panels;
}

/* ---------- Rendering helpers ---------- */
export function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Render a panel object ({ title, content }) into HTML for the
 * left/right side panels. Content lines split on \n become <p>s.
 */
export function renderPanelHtml(panel) {
    if (!panel) return '';
    let html = '';
    if (panel.title) {
        html += `<h3>${escapeHtml(panel.title)}</h3>`;
    }
    if (panel.content) {
        const lines = panel.content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
            html += `<p>${escapeHtml(line)}</p>`;
        }
    }
    return html;
}
