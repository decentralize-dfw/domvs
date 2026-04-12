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
        hotspots: parseHotspots(rows),
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

        // Resolve whatever is in column C to an actual URL AND, when
        // possible, remember which Global Assets entry it came from so
        // consumers can access metadata like the asset type.
        let url = null;
        let assetRef = null;
        if (/^https?:\/\//i.test(cStr)) {
            url = cStr;
            // Reverse-lookup: does any Global Assets row advertise this
            // URL? If so, carry its metadata along.
            for (const key in assets) {
                const a = assets[key];
                if (a && String(a.url || '').trim() === url) {
                    assetRef = a;
                    break;
                }
            }
        } else {
            // Treat the cell as a name lookup into Global Assets.
            // Covers the Google Sheets case where C holds =B9 and
            // renders as "City Model v2" after export.
            const needle = cStr.toLowerCase();
            for (const key in assets) {
                const a = assets[key];
                if (a && String(a.name || '').trim().toLowerCase() === needle) {
                    url = a.url;
                    assetRef = a;
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
            assetType: assetRef ? String(assetRef.type || '') : '',
            assetName: assetRef ? String(assetRef.name || '') : '',
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
            action: row[3] ? String(row[3]).trim() : '',
            kod:    row[4] ? String(row[4]).trim() : ''
        });
    }
    return buttons;
}

/* ---------- Panels section ----------
 *
 * A panel is a stack of media items. The top "title" row and the ten
 * slot rows below it all share one schema:
 *     A: slot / heading label  (on the title row this is the h3 text)
 *     B: Tip                   (text | html | image | video | youtube |
 *                               drive | iframe | link | glb)
 *     C: İçerik / URL          (plain text or an http/https URL)
 *     D: Genişlik              ("300px", "100%", "auto", "" = default)
 *     E: Yükseklik             (same)
 *     F: Caption               (optional — used as the tab label too)
 *     G: Extra                 (optional CSS class / raw attrs)
 *
 * A panel's items[] is built from the title row (first item) + any
 * filled slot rows. Panels with one item render inline; panels with
 * two or more items render as small tabs at the top of the panel.
 *
 * Backward compat: older panel data had plain-text content in column
 * B and nothing in C. If column B isn't a recognised Tip token we
 * fall back to treating the whole row as a text item.
 */
const KNOWN_TIPS = new Set([
    'text', 'html', 'image', 'video',
    'youtube', 'drive', 'iframe', 'link', 'glb'
]);

/* ---------- Single-item reader (shared by both panel formats) ---------- */
function readPanelItem(r) {
    if (!r) return null;
    const rawB = (r[1] !== null && r[1] !== undefined) ? String(r[1]).trim() : '';
    const rawC = (r[2] !== null && r[2] !== undefined) ? String(r[2]).trim() : '';
    const bEmpty = !rawB || rawB.toLowerCase() === 'null';
    const cEmpty = !rawC || rawC.toLowerCase() === 'null';
    if (bEmpty && cEmpty) return null;

    let tip, content;
    if (!bEmpty && KNOWN_TIPS.has(rawB.toLowerCase())) {
        tip = rawB.toLowerCase();
        content = cEmpty ? '' : rawC;
    } else if (!bEmpty) {
        tip = 'text';
        content = rawB;
    } else {
        return null;
    }
    if (!content) return null;

    const read = (idx) => {
        const v = r[idx];
        if (v === null || v === undefined) return '';
                const s = String(v).trim();
                return (!s || s.toLowerCase() === 'null') ? '' : s;
            };

    return {
        tip, content,
        width:   read(3),
        height:  read(4),
        caption: read(5),
        extra:   read(6),
        kod:     read(7)
    };
}

function parsePanelsSection(rows, sceneIdx, sceneEnd) {
    const panels = {};
    const m = findMarker(rows, sceneIdx, sceneEnd, '4 · BİLGİ PANELLERİ');
    if (m < 0) return panels;

    // Detect format: "Panel ID:" rows → old per-panel blocks.
    // No "Panel ID:" → flat list with Kod tags in col H.
    let hasOldFormat = false;
    for (let i = m + 1; i <= sceneEnd; i++) {
        const a = String(rows[i]?.[0] ?? '');
        if (a.includes('Panel ID:')) { hasOldFormat = true; break; }
        if (/^\s*\d+\s*·/.test(a)) break;
    }

    if (hasOldFormat) {
        // --- OLD FORMAT: separate Panel ID blocks ---
        for (let i = m + 1; i <= sceneEnd; i++) {
            const row = rows[i];
            if (!row) continue;
            const a = String(row[0] ?? '');
            const idMatch = a.match(/Panel ID:\s*([a-zA-Z0-9_]+)/);
            if (!idMatch) continue;
            const panelId = idMatch[1];
            const titleRow = rows[i + 2];
            if (!titleRow) continue;

            let heading = String(titleRow[0] ?? '').trim();
            heading = heading.replace(/\s*\[[^\]]*\]\s*$/, '').trim();

            const items = [];
            const firstItem = readPanelItem(titleRow);
            if (firstItem) items.push(firstItem);
            for (let j = i + 4; j <= sceneEnd; j++) {
                const slotRow = rows[j];
                if (!slotRow) continue;
                const slotA = String(slotRow[0] ?? '').trim();
                if (slotA.includes('Panel ID:')) break;
                if (/^\s*\d+\s*·/.test(slotA)) break;
                const it = readPanelItem(slotRow);
                if (it) items.push(it);
            }
            panels[panelId] = { title: heading, items };
        }
    } else {
        // --- FLAT FORMAT: single list with Kod tags in col H ---
        // Items are grouped by Kod. The first item in each group
        // donates its col-A value as the group heading.
        for (let i = m + 2; i <= sceneEnd; i++) {
            const row = rows[i];
            if (!row) continue;
            const kod = (row[7] !== null && row[7] !== undefined)
                ? String(row[7]).trim() : '';
            if (!kod || kod.toLowerCase() === 'null') continue;

            const it = readPanelItem(row);
            if (!it) continue;

            if (!panels[kod]) {
                let heading = String(row[0] ?? '').trim();
                heading = heading.replace(/\s*\[[^\]]*\]\s*$/, '').trim();
                panels[kod] = { title: heading, items: [] };
            }
            panels[kod].items.push(it);
        }
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
 * Return true if the given model entry refers to a collider-type
 * asset. Used by Scene 5 to distinguish the visible model from the
 * invisible physics collider. parseModelsSection stamps assetType
 * onto every entry during parse, so we just check that.
 */
export function isColliderEntry(_config, entry) {
    if (!entry) return false;
    return /collider/i.test(String(entry.assetType || ''));
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

/* ---------- Attribute-safe escape + size normaliser ---------- */

function escapeAttr(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function normalizeSize(s) {
    const str = String(s || '').trim().toLowerCase();
    if (!str || str === 'null')  return '';
    if (str === 'auto')          return 'auto';
    if (/^\d+(\.\d+)?(px|%|em|rem|vw|vh)$/.test(str)) return str;
    if (/^\d+(\.\d+)?$/.test(str)) return str + 'px';
    return str;
}

function sizeStyleAttr(item) {
    const parts = [];
    const w = normalizeSize(item.width);
    const h = normalizeSize(item.height);
    if (w) parts.push(`width:${w}`);
    if (h) parts.push(`height:${h}`);
    return parts.length ? ` style="${parts.join(';')}"` : '';
}

function extractYouTubeId(url) {
    const m = String(url || '').match(
        /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/
    );
    return m ? m[1] : null;
}

function extractDriveId(url) {
    const m = String(url || '').match(
        /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]{6,})/
    );
    return m ? m[1] : null;
}

/* ---------- Single item renderer ---------- */

function renderItem(item) {
    const tip    = String(item.tip || 'text').toLowerCase();
    const raw    = item.content || '';
    const styleA = sizeStyleAttr(item);
    const cls    = item.extra ? escapeAttr(item.extra) : '';
    const cap    = item.caption
        ? `<div class="vea-item-caption">${escapeHtml(item.caption)}</div>`
        : '';

    switch (tip) {
        case 'text': {
            const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            const body  = lines.map(l => `<p>${mdInline(escapeHtml(l))}</p>`).join('');
            return `<div class="vea-item vea-item-text ${cls}"${styleA}>${body}</div>${cap}`;
        }
        case 'html':
            return `<div class="vea-item vea-item-html ${cls}"${styleA}>${raw}</div>${cap}`;

        case 'image':
            return `<img class="vea-item vea-item-image ${cls}" src="${escapeAttr(raw)}" alt="${escapeAttr(item.caption || '')}"${styleA}>${cap}`;

        case 'video':
            return `<video class="vea-item vea-item-video ${cls}" src="${escapeAttr(raw)}" controls playsinline${styleA}></video>${cap}`;

        case 'youtube': {
            const id  = extractYouTubeId(raw);
            const src = id ? `https://www.youtube.com/embed/${id}` : raw;
            return `<iframe class="vea-item vea-item-iframe ${cls}" src="${escapeAttr(src)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen${styleA}></iframe>${cap}`;
        }
        case 'drive': {
            const id  = extractDriveId(raw);
            const src = id ? `https://drive.google.com/file/d/${id}/preview` : raw;
            return `<iframe class="vea-item vea-item-iframe ${cls}" src="${escapeAttr(src)}" frameborder="0" allowfullscreen${styleA}></iframe>${cap}`;
        }
        case 'iframe':
            return `<iframe class="vea-item vea-item-iframe ${cls}" src="${escapeAttr(raw)}" frameborder="0" allowfullscreen${styleA}></iframe>${cap}`;

        case 'link': {
            const label = item.caption || raw;
            return `<a class="vea-item vea-item-link ${cls}" href="${escapeAttr(raw)}" target="_blank" rel="noopener"${styleA}>${escapeHtml(label)}</a>`;
        }
        case 'glb': {
            const label = item.caption || 'GLB Model';
            return `<a class="vea-item vea-item-glb ${cls}" href="${escapeAttr(raw)}" target="_blank" rel="noopener"${styleA}>📦 ${escapeHtml(label)}</a>`;
        }
        default:
            return `<div class="vea-item vea-item-text"${styleA}>${mdInline(escapeHtml(raw))}</div>${cap}`;
    }
}

/**
 * Render a panel object ({ title, items }) into the HTML string that
 * should be dropped into a side-panel container. Multiple items are
 * rendered as small tabs at the top of the panel; tab switching is
 * wired up globally via a document-level click delegate installed
 * at the bottom of this module.
 *
 * Backward-compat: legacy `{ title, content }` shape is also accepted
 * (rendered as a single text item).
 */
export function renderPanelHtml(panel) {
    if (!panel) return '';

    // Normalise to an items[] array
    let items = Array.isArray(panel.items) ? panel.items.slice() : null;
    if (!items && panel.content) {
        items = [{
            tip: 'text', content: panel.content,
            width: '', height: '', caption: '', extra: ''
        }];
    }
    items = items || [];

    const headingHtml = panel.title
        ? `<h3 class="vea-panel-heading">${mdInline(escapeHtml(panel.title))}</h3>`
        : '';

    if (items.length === 0) {
        return `<div class="vea-panel-root">${headingHtml}</div>`;
    }

    if (items.length === 1) {
        return `<div class="vea-panel-root">${headingHtml}${renderItem(items[0])}</div>`;
    }

    // 2+ items → tab bar on top + switchable tab bodies
    const tabButtons = items.map((it, idx) => {
        const label = it.caption || String(idx + 1);
        return `<button class="vea-tab${idx === 0 ? ' active' : ''}" data-idx="${idx}" type="button">${escapeHtml(label)}</button>`;
    }).join('');

    const tabBodies = items.map((it, idx) =>
        `<div class="vea-tab-panel${idx === 0 ? ' active' : ''}" data-idx="${idx}">${renderItem(it)}</div>`
    ).join('');

    return `<div class="vea-panel-root">`
         + headingHtml
         + `<div class="vea-tabs">${tabButtons}</div>`
         + `<div class="vea-tab-body">${tabBodies}</div>`
         + `</div>`;
}

/* ---------- Hotspot parser ----------
 *
 * Global section "▌ BÖLÜM 2 — HOTSPOT SLOTLARI" lives at the
 * bottom of the sheet (after all scenes). Each row describes a 3D
 * marker (GLB or PNG sprite) with position/rotation/scale, a popup
 * content (text/image/video/…), the scene it belongs to, and an
 * optional toggle-kod for conditional visibility.
 *
 * Column layout:
 *   A: #   B: Ad   C: Hotspot Tip   D: Hotspot Link
 *   E: Popup Tip   F: Popup İçerik/Link
 *   G-I: Pos X/Y/Z   J-L: Rot X/Y/Z   M: Scale
 *   N: Toggle Kod (empty = always visible)
 *   O: Sahne (0-5)
 */
function parseHotspots(rows) {
    // Find the "▌ BÖLÜM 2" marker
    let m = -1;
    for (let i = 0; i < rows.length; i++) {
        const a = rows[i]?.[0];
        if (a && String(a).includes('HOTSPOT SLOT')) { m = i; break; }
    }
    if (m < 0) return [];

    const all = [];
    // Data starts at m+2 (m+1 is the column header row)
    for (let i = m + 2; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        const name = row[1];
        if (!name || String(name).trim().toLowerCase() === 'null') continue;

        const read  = (idx) => {
            const v = row[idx];
            if (v === null || v === undefined) return '';
            const s = String(v).trim();
            return (s.toLowerCase() === 'null') ? '' : s;
        };
        const readN = (idx) => {
            const v = row[idx];
            if (v === null || v === undefined) return 0;
            const n = parseFloat(v);
            return isNaN(n) ? 0 : n;
        };

        all.push({
            order:      readN(0),
            name:       String(name).trim(),
            hotspotTip: read(2).toLowerCase() || 'png',
            hotspotUrl: read(3),
            popupTip:   read(4).toLowerCase() || 'text',
            popupContent: read(5),
            pos:   { x: readN(6),  y: readN(7),  z: readN(8) },
            rot:   { x: readN(9),  y: readN(10), z: readN(11) },
            scale: readN(12) || 1,
            toggleKod: read(13),
            scene: read(14)
        });
    }
    return all;
}

/**
 * Filter hotspots for a specific scene (and optionally a toggle).
 *   getHotspotsForScene(config, 2)         → all scene-2 hotspots
 *   getHotspotsForScene(config, 2, 'toggle-1') → only toggle-1 + always-visible
 */
export function getHotspotsForScene(config, sceneIndex, activeToggleKod) {
    if (!config || !config.hotspots) return [];
    const si = String(sceneIndex);
    return config.hotspots.filter(h => {
        if (h.scene !== si && h.scene !== '') return false;
        if (!activeToggleKod) return true;
        // Show if no toggle restriction OR matches active toggle
        return !h.toggleKod || h.toggleKod === activeToggleKod;
    });
}

/* ---------- Document-level tab click delegate ----------
 * Installed once per page, on first import of this module. Because
 * the handler uses event delegation, panels that are re-rendered
 * (e.g. when scene 2 switches between Klasik / Metal options) keep
 * working without needing to be re-wired.
 */
if (typeof document !== 'undefined' && !document.__veaTabHandlerInstalled) {
    document.__veaTabHandlerInstalled = true;
    document.addEventListener('click', (e) => {
        const tab = e.target && e.target.closest
            ? e.target.closest('.vea-tab')
            : null;
        if (!tab) return;
        const root = tab.closest('.vea-panel-root');
        if (!root) return;
        e.stopPropagation();
        const idx = tab.dataset.idx;
        root.querySelectorAll('.vea-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.idx === idx);
        });
        root.querySelectorAll('.vea-tab-body > .vea-tab-panel').forEach(p => {
            p.classList.toggle('active', p.dataset.idx === idx);
        });
    });
}
