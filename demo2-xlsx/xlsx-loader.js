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

    const rows = sheetToRowArray(ws);

    const assets = parseGlobalAssets(rows);
    const scenes = {};
    for (const idx in SCENE_START_ROWS) {
        scenes[idx] = parseScene(rows, SCENE_START_ROWS[idx], assets);
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

/**
 * Build a rows[][] array where rows[N] ALWAYS corresponds to Excel
 * row (N+1), regardless of the worksheet's !ref dimension.
 *
 * SheetJS's XLSX.utils.sheet_to_json({ header: 1 }) derives its
 * output from the sheet's !ref range, so a sheet whose dimension
 * starts at A2 will have rows[0] point at Excel row 2 — an off-by-
 * one trap. Reading cells directly by their encoded address sidesteps
 * this completely: r=0 → row 1, r=8 → row 9, etc.
 */
function sheetToRowArray(ws) {
    if (!ws || !ws['!ref']) return [];
    const range = XLSX.utils.decode_range(ws['!ref']);
    // Always start from (0,0) so that rows[excelRow - 1] is correct.
    const maxR = Math.max(range.e.r, 0);
    const maxC = Math.max(range.e.c, 14); // scan at least A..O (15 cols)
    const rows = [];
    for (let r = 0; r <= maxR; r++) {
        const row = [];
        for (let c = 0; c <= maxC; c++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            const cell = ws[addr];
            row.push(cell ? (cell.v !== undefined ? cell.v : null) : null);
        }
        rows.push(row);
    }
    return rows;
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
 * Return the model entry's resolved URL. The URL is already baked
 * into the entry at parse time (parseModelsSection reads column C
 * of the scene block and, if the cell references the Global Assets
 * table, walks the reference right then and there).
 */
export function assetUrlFor(_config, modelEntry) {
    return modelEntry?.url || null;
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
function parseScene(rows, sceneStartRowExcel, assets) {
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
        models:   parseModelsSection(rows, sceneIdx, sceneEnd, assets),
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

/* ---------- Models section ----------
 *
 * Reads the URL for each model straight out of the scene block. No
 * Global Assets hardcoding: the loop starts one row below the
 * "2 · KULLANILAN MODELLER" header and walks down until it hits the
 * next "N · ..." section marker. Every row in between is considered,
 * including the slotXX rows, and any row whose column C is empty
 * or "null" is skipped.
 *
 * Column C may hold:
 *   · A direct http(s) URL                 → used as-is
 *   · A hyperlink (openpyxl/SheetJS)       → the link target is used
 *   · Anything else (e.g. "City Model v2"  → treated as a lookup key
 *     coming from a Google Sheets =B9         into the Global Assets
 *     formula resolved to plain text)         table's B column (same
 *                                              row's C is the real URL)
 */
function parseModelsSection(rows, sceneIdx, sceneEnd, assets) {
    const models = [];
    const m = findMarker(rows, sceneIdx, sceneEnd, '2 · KULLANILAN MODELLER');
    if (m < 0) return models;

    // Stop before the next "N · ..." section marker in column A.
    let stopIdx = sceneEnd;
    for (let i = m + 1; i <= sceneEnd; i++) {
        const a = rows[i]?.[0];
        if (!a) continue;
        if (/^\s*\d+\s*·/.test(String(a))) {
            stopIdx = i - 1;
            break;
        }
    }

    for (let i = m + 2; i <= stopIdx; i++) {
        const row = rows[i];
        if (!row) continue;

        const cCell = row[2]; // column C
        if (cCell === null || cCell === undefined) continue;
        const cStr = String(cCell).trim();
        if (!cStr || cStr.toLowerCase() === 'null') continue;

        // Resolve whatever is in column C to an actual URL.
        let url = null;
        if (/^https?:\/\//i.test(cStr)) {
            url = cStr;
        } else {
            // Anything else is treated as a name to look up in the
            // Global Assets table (column B → column C). This covers
            // the Google Sheets case where C43 holds =B9 and renders
            // as "City Model v2" after export.
            const needle = cStr.toLowerCase();
            for (const key in assets) {
                const a = assets[key];
                if (a && String(a.name || '').trim().toLowerCase() === needle) {
                    url = a.url;
                    break;
                }
            }
        }
        if (!url) continue;

        // Extract model ID from notes column O (index 14): "m1  |  Option 1"
        const notes = String(row[14] ?? '');
        const idMatch = notes.match(/^([a-zA-Z0-9_]+)/);
        let modelId = idMatch ? idMatch[1] : null;
        if (modelId && /^modelurls$/i.test(modelId)) modelId = null;

        models.push({
            url,
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

    // Stop before the next "N · ..." section marker (same approach
    // used by parseModelsSection) so floats / section headers can't
    // be mistaken for button rows.
    let stopIdx = sceneEnd;
    for (let i = m + 1; i <= sceneEnd; i++) {
        const a = rows[i]?.[0];
        if (!a) continue;
        if (/^\s*\d+\s*·/.test(String(a))) {
            stopIdx = i - 1;
            break;
        }
    }

    for (let i = m + 1; i <= stopIdx; i++) {
        const row = rows[i];
        if (!row) continue;
        // A button row has a non-empty label in column B and a
        // non-empty id in column C. Column A is a # that may come
        // through from Google Sheets as a float ("1.0"), an int,
        // or a slot label — we don't care as long as B+C carry data.
        const name = row[1];
        const id   = row[2];
        if (!name || !id) continue;
        const nameStr = String(name).trim();
        const idStr   = String(id).trim();
        if (!nameStr || !idStr) continue;
        if (nameStr.toLowerCase() === 'null' || idStr.toLowerCase() === 'null') continue;
        // Skip the header row ("Buton Etiketi" / "Buton ID")
        if (/^buton\s+(etiketi|id)$/i.test(nameStr)) continue;
        if (/^buton\s+id$/i.test(idStr)) continue;

        buttons.push({
            name:   nameStr,
            id:     idStr,
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
 * Parse a scene-4 camera action string like:
 *   "Pos(1, 1.6, 1.6)   → LookAt(1, 1.6, 1.5)   · FOV 80"
 * into { pos, lookAt, fov }. Returns null if the string cannot be parsed.
 */
export function parseCameraPositionAction(action) {
    if (!action) return null;
    const m = String(action).match(
        /Pos\(([^)]+)\)\s*(?:→|->)?\s*LookAt\(([^)]+)\)(?:\s*·\s*FOV\s*(\d+(?:\.\d+)?))?/
    );
    if (!m) return null;
    const p = m[1].split(',').map(s => parseFloat(s.trim()));
    const l = m[2].split(',').map(s => parseFloat(s.trim()));
    return {
        pos:    { x: p[0] || 0, y: p[1] || 0, z: p[2] || 0 },
        lookAt: { x: l[0] || 0, y: l[1] || 0, z: l[2] || 0 },
        fov:    m[3] ? parseFloat(m[3]) : 80
    };
}

/**
 * Return true if the given asset row entry refers to a collider-type
 * asset (type contains "Collider"). Used by Scene 5 to distinguish
 * the visible model from the invisible physics collider.
 */
export function isColliderEntry(config, entry) {
    if (!entry || !entry.assetRow) return false;
    const asset = config.assets[entry.assetRow];
    if (!asset) return false;
    return /collider/i.test(String(asset.type || ''));
}

/**
 * Convert tiny markdown-ish markup inside an already-escaped string.
 * Currently supported:
 *   **text** → <strong>text</strong>
 * Input MUST already be HTML-escaped; `*` is not touched by escapeHtml
 * so the pattern survives escape and we get correct HTML out.
 */
function mdInline(escaped) {
    return String(escaped).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

/**
 * Render a panel object ({ title, content }) into HTML for the
 * left/right side panels. Content lines split on \n become <p>s.
 * Titles and content support **bold** markdown.
 */
export function renderPanelHtml(panel) {
    if (!panel) return '';
    let html = '';
    if (panel.title) {
        html += `<h3>${mdInline(escapeHtml(panel.title))}</h3>`;
    }
    if (panel.content) {
        const lines = panel.content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
            html += `<p>${mdInline(escapeHtml(line))}</p>`;
        }
    }
    return html;
}
