// furniture-config.js — central configuration for all furniture-related modules
// All magic numbers, keys, and constants live here.
// Import and override only at startup if needed.

export const FURNITURE_CONFIG = {
    // ---- Editor / gumball ----
    gumballSize: 1.5,          // TransformControls size
    scaleMin: 0.05,            // uniform scale minimum (5%)
    undoHistoryMax: 50,        // undo/redo stack limit
    recentlyDraggedMs: 150,    // prevents click-deselect after gumball release
    saveToCacheDebounceMs: 50, // post-drag save delay (smooths rapid moves)

    // ---- Clip mode ----
    clipPercentDefault: 0.40,  // default plan-view cut height (0-1)
    clipPercentMin: 10,        // slider min %
    clipPercentMax: 90,        // slider max %
    clipFrustumSize: 12,       // ortho camera frustum width (ish)
    planViewDist: 20,          // ortho camera distance from scene center
    bloomStrengthInPlan: 0.1,  // dim bloom when in plan view

    // ---- Session cache ----
    sharedCacheKey: 'vea-furniture-interior', // shared across scenes 4/5/6

    // ---- UI ----
    panelWidthFurniture: 280,  // px — left panel width when furniture panel visible
    popupAutoCloseMs: 3000,    // furniture info popup auto-close

    // ---- Drag ghost preview ----
    dragGhostSize: 0.4,
    dragGhostOpacity: 0.35,
    dragGhostColor: 0xc9a96e,
    dragGhostHeight: 0.2,      // Y offset of ghost box

    // ---- Tagging (userData keys that mark non-clipping objects) ----
    clippingSkipFlags: [
        '_isFurniture',
        '_isDragGhost',
        '_isCamHelper',
        'isHotspotSprite'
    ],
};
