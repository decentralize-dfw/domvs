#!/usr/bin/env python3
"""
143 — Luxembourg kose apartmani, dis kabuk. TUM referanslardan cikan plan:

VAZIYET (hava fotolari):
  * Kose parseli: GUNEY cephe ana caddeye, DOGU cephe yan caddeye bakar.
  * BATI tarafinda arsa ici ARAC YOLU (komsuyla aramizda), giris kapisi
    bu bati cephesindedir (yakin cekim foto). 2 koyu arac burada park eder.
  * Kuzeyde pembe komsuya bitisik ARKA KANAT: DUZ catili (hava fotosu).
  * Guneydogu kosesinde teraslamali tas cicek tarhlari, simsir toplari.

CEPHELER:
  GUNEY (A):  rustik tas alt bant + 3 kat; akslar bati→dogu:
      dar aks (geri cekilmis planda) · GENIS ERKER pencere ×2 (bej tas kutu
      cerceve ~0.26 one tasar, koyu jaluzili cam) · koseye kadar sagir serit
  DOGU (B):   koseye yakin bej tas PORTAL icinde 3 kat balkon (koyu metal
      korkuluk, yerden tavana koyu dograma); portalin kuzeyinde sove'li aks;
      sokak kotunda koyu GARAJ kapisi + bej rampa
  BATI (C, giris): rustik tas zemin kat; guney ucunda KAPI + antrasit kanopi
      + "143"; kapi ustunde dar pencere kolonu; kuzeyinde sove'li akslar
  KUZEY:      bitisik/sagir, birkac kucuk pencere

CATI: guney kutle uzerinde arduvaz KIRMA cati (duz tepeli); kuzey kanat DUZ
  beyaz parapetli. Cinko dormer kutulari: guney yamacta genis kutu (A2 ustu),
  dogu yamacta genis kutu (portal ustu), bati yamacta kutu; arduvaz icinde
  isikliklar; mahyada uzun cinko baca; duz catida cikis kutusu + havalandirma.
1 birim = 1 m. Y yukari. Sokak koti y=0, bahce +0.95.
"""
import json
import math
from pathlib import Path

import numpy as np
import trimesh
from shapely.geometry import Polygon
from trimesh.transformations import rotation_matrix

OUT = Path(__file__).resolve().parent.parent

MATS = {
    "siva_beyaz":   ("#EFECE5", 0.0, 0.88),
    "siva_ic":      ("#DDD8CE", 0.0, 0.9),
    "sove_bej":     ("#D6C3A0", 0.0, 0.85),
    "tas_rustik":   ("#A79878", 0.0, 0.95),
    "derz":         ("#77684E", 0.0, 0.95),
    "tas_istinat":  ("#9A8D74", 0.0, 0.95),
    "harpusta":     ("#B3AA97", 0.0, 0.9),
    "cati_arduvaz": ("#363C43", 0.0, 0.82),
    "cati_duz":     ("#2E343A", 0.0, 0.8),
    "duz_teras":    ("#C9C6BE", 0.0, 0.9),
    "cinko":        ("#494F57", 0.3, 0.55),
    "saceg":        ("#ECE9E1", 0.0, 0.85),
    "dograma":      ("#2B3036", 0.15, 0.45),
    "cam":          ("#151A21", 0.0, 0.12),
    "panjur":       ("#333940", 0.0, 0.5),
    "korkuluk":     ("#22262C", 0.5, 0.4),
    "balkon_dosem": ("#E7E3DA", 0.0, 0.85),
    "kapi":         ("#202429", 0.2, 0.4),
    "kanopi":       ("#2E3339", 0.3, 0.45),
    "garaj":        ("#2A2F35", 0.2, 0.5),
    "oluk":         ("#8A9098", 0.7, 0.35),
    "avlu_tas":     ("#C6B79D", 0.0, 0.92),
    "yol_tasi":     ("#B7AFA1", 0.0, 0.93),
    "asfalt":       ("#3A3F45", 0.0, 0.96),
    "kaldirim":     ("#ADA89E", 0.0, 0.92),
    "bordur":       ("#8F8A80", 0.0, 0.9),
    "cim":          ("#5A7546", 0.0, 0.95),
    "cali":         ("#3F6130", 0.0, 0.95),
    "cali_acik":    ("#567F3B", 0.0, 0.95),
    "sus_otu":      ("#7D9457", 0.0, 0.95),
    "yaprak":       ("#4A7036", 0.0, 0.95),
    "govde":        ("#5B4A3C", 0.0, 0.9),
    "cit_metal":    ("#3A3F45", 0.5, 0.45),
    "arac_koyu":    ("#1E2228", 0.4, 0.25),
    "arac_gri":     ("#4A5058", 0.4, 0.28),
    "arac_cam":     ("#171B21", 0.1, 0.12),
    "lastik":       ("#141619", 0.0, 0.85),
    "kaide":        ("#2A2E33", 0.0, 0.85),
}


def hexf(h):
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]


class Builder:
    def __init__(self):
        self.parts = {}

    def add(self, mesh, mat, group="bina"):
        if mesh is not None:
            self.parts.setdefault((group, mat), []).append(mesh)

    def scene(self):
        sc = trimesh.Scene()
        tri = 0
        for (grp, mat), meshes in sorted(self.parts.items()):
            m = trimesh.util.concatenate(meshes)
            col, metal, rough = MATS[mat]
            m.visual = trimesh.visual.TextureVisuals(
                material=trimesh.visual.material.PBRMaterial(
                    name=mat, baseColorFactor=hexf(col) + [1.0],
                    metallicFactor=metal, roughnessFactor=rough, doubleSided=True))
            tri += len(m.faces)
            sc.add_geometry(m, geom_name=f"{grp}__{mat}", node_name=f"{grp}__{mat}")
        return sc, tri


B = Builder()


def bx(size, pos, ry=0.0, rx=0.0):
    m = trimesh.creation.box(extents=size)
    if rx:
        m.apply_transform(rotation_matrix(rx, [1, 0, 0]))
    if ry:
        m.apply_transform(rotation_matrix(ry, [0, 1, 0]))
    m.apply_translation(pos)
    return m


def cyl(r, h, pos, sections=12):
    m = trimesh.creation.cylinder(radius=r, height=h, sections=sections)
    m.apply_transform(rotation_matrix(math.pi / 2, [1, 0, 0]))
    m.apply_translation(pos)
    return m


def sph(r, pos, subdiv=2, scale=(1, 1, 1)):
    m = trimesh.creation.icosphere(subdivisions=subdiv, radius=r)
    m.apply_scale(scale)
    m.apply_translation(pos)
    return m


def prism(poly_xz, y0, y1):
    p = Polygon([(x, -z) for x, z in poly_xz])
    if not p.is_valid:
        p = p.buffer(0)
    m = trimesh.creation.extrude_polygon(p, y1 - y0)
    m.apply_transform(rotation_matrix(-math.pi / 2, [1, 0, 0]))
    m.apply_translation([0, y0, 0])
    return m


def _ccw(poly):
    a = 0.0
    n = len(poly)
    for i in range(n):
        x0, z0 = poly[i]
        x1, z1 = poly[(i + 1) % n]
        a += x0 * z1 - x1 * z0
    return list(poly) if a > 0 else list(reversed(poly))


def _edge_normals(poly):
    out = []
    n = len(poly)
    for i in range(n):
        x0, z0 = poly[i]
        x1, z1 = poly[(i + 1) % n]
        dx, dz = x1 - x0, z1 - z0
        L = math.hypot(dx, dz) or 1.0
        out.append((-dz / L, dx / L))
    return out


def ring_of(poly, inset):
    poly = _ccw(poly)
    nb = _edge_normals(poly)
    n = len(poly)
    out = []
    for i in range(n):
        n2, n1 = nb[i], nb[(i - 1) % n]
        k = 1.0 + n1[0] * n2[0] + n1[1] * n2[1]
        if k < 0.05:
            return None
        out.append((poly[i][0] + inset * (n1[0] + n2[0]) / k,
                    poly[i][1] + inset * (n1[1] + n2[1]) / k))
    return out


def band(outer, inner, y0, y1):
    o = _ccw(outer)
    V, F = [], []
    for k in range(len(o)):
        k2 = (k + 1) % len(o)
        base = len(V)
        V += [[o[k][0], y0, o[k][1]], [o[k2][0], y0, o[k2][1]],
              [inner[k2][0], y1, inner[k2][1]], [inner[k][0], y1, inner[k][1]]]
        F += [[base, base + 2, base + 1], [base, base + 3, base + 2]]
    return trimesh.Trimesh(vertices=np.array(V, dtype=np.float64),
                           faces=np.array(F), process=False), list(inner)


# ================================ OLCULER ================================
X0, X1 = -6.6, 6.6            # bati / dogu
Z0, Z1 = -6.2, 6.2            # kuzey / guney (guney = ana cadde)
SETB = 0.35
XSEAM = -3.95                 # guney cephede dar aksin sagindaki dikis
ZAS = Z1 - SETB               # geri cekilmis guney duzlem (bati ucu)

FOOT = [(X0, ZAS), (XSEAM, ZAS), (XSEAM, Z1), (X1, Z1), (X1, Z0), (X0, Z0)]

GARDEN = 0.95
GF0 = GARDEN
FH = 2.85
GFH = 2.7
LV = [GF0, GF0 + GFH, GF0 + GFH + FH]            # kat tabanlari
WCY = [lv + 1.62 for lv in LV]                   # pencere merkezleri
EAVE = GF0 + GFH + 2 * FH                        # 9.35
ROOF_Y0 = EAVE + 0.55                            # kalin beyaz kornis ustu
STONE_A = GARDEN + 1.0                           # guney cephede tas ust koti
STONE_C = GF0 + GFH + 0.15                       # bati cephede tas (tam zemin kat)

ZFLAT = -3.1                                     # kuzey duz catili kanat siniri
RM = 0.3
HIP = [(X0 - RM, ZFLAT), (X1 + RM, ZFLAT), (X1 + RM, Z1 + RM), (X0 - RM, Z1 + RM)]
ROOF_INSET = 3.3
ROOF_H = 3.5
SLOPE = math.atan2(ROOF_H, ROOF_INSET)

RY_S, RY_E, RY_W, RY_N = 0.0, math.pi / 2, -math.pi / 2, math.pi


# ============================== CEPHE OGELERI ==============================
def glazing(cx, y, cz, ry, w, h, grp="cephe", blind=0.45):
    nx, nz = math.sin(ry), math.cos(ry)
    B.add(bx((w, h, 0.05), (cx, y, cz), ry), "cam", grp)
    if blind > 0:
        bh = h * blind
        B.add(bx((w - 0.08, bh, 0.06), (cx + nx * 0.006, y + h / 2 - bh / 2 - 0.03,
                                        cz + nz * 0.006), ry), "panjur", grp)
    t = 0.07
    fx, fz = nx * 0.025, nz * 0.025
    for dy in (h / 2 + t / 2, -h / 2 - t / 2):
        B.add(bx((w + 2 * t, t, 0.08), (cx + fx, y + dy, cz + fz), ry), "dograma", grp)
    for s in (-1, 1):
        dx = math.cos(ry) * s * (w / 2 + t / 2)
        dz = -math.sin(ry) * s * (w / 2 + t / 2)
        B.add(bx((t, h + 2 * t, 0.08), (cx + dx + fx, y, cz + dz + fz), ry), "dograma", grp)


def bay_window(cx, cz, ry, y, w=2.6, h=1.8, grp="cephe"):
    """Bej tas KUTU cerceveli genis erker pencere (~0.26 one tasar)."""
    nx, nz = math.sin(ry), math.cos(ry)
    P, s = 0.26, 0.24
    fx, fz = cx + nx * P / 2, cz + nz * P / 2
    B.add(bx((w + 2 * s, 0.22, P + 0.10), (fx + nx * 0.02, y + h / 2 + 0.11, fz + nz * 0.02), ry), "sove_bej", grp)
    B.add(bx((w + 2 * s, 0.20, P + 0.16), (fx + nx * 0.04, y - h / 2 - 0.10, fz + nz * 0.04), ry), "sove_bej", grp)
    for sgn in (-1, 1):
        dx = math.cos(ry) * sgn * (w / 2 + s / 2)
        dz = -math.sin(ry) * sgn * (w / 2 + s / 2)
        B.add(bx((s, h + 0.42, P), (fx + dx, y, fz + dz), ry), "sove_bej", grp)
    glazing(cx + nx * (P - 0.07), y, cz + nz * (P - 0.07), ry, w, h, grp, blind=0.5)


def sove_window(cx, cz, ry, y, w=1.5, h=1.7, grp="cephe", blind=0.45):
    nx, nz = math.sin(ry), math.cos(ry)
    glazing(cx + nx * 0.08, y, cz + nz * 0.08, ry, w, h, grp, blind)
    s, p = 0.22, 0.12
    fx, fz = cx + nx * p / 2, cz + nz * p / 2
    for dy in (h / 2 + s / 2, -h / 2 - s / 2):
        B.add(bx((w + 2 * s, s, p), (fx, y + dy, fz), ry), "sove_bej", grp)
    for sgn in (-1, 1):
        dx = math.cos(ry) * sgn * (w / 2 + s / 2)
        dz = -math.sin(ry) * sgn * (w / 2 + s / 2)
        B.add(bx((s, h, p), (fx + dx, y, fz + dz), ry), "sove_bej", grp)


def railing(cx, y, cz, ry, w, h=1.02, grp="cephe"):
    B.add(bx((w, 0.075, 0.055), (cx, y + h, cz), ry), "korkuluk", grp)
    B.add(bx((w, 0.05, 0.045), (cx, y + 0.08, cz), ry), "korkuluk", grp)
    n = max(4, int(w / 0.115))
    for k in range(n):
        t = (k + 0.5) / n - 0.5
        dx, dz = math.cos(ry) * t * w, -math.sin(ry) * t * w
        B.add(bx((0.026, h, 0.026), (cx + dx, y + h / 2, cz + dz), ry), "korkuluk", grp)


# ================================= BINA =================================
def building():
    g = "govde"
    # govde + rustik tas bantlar
    B.add(prism(FOOT, GARDEN - 1.1, EAVE), "siva_beyaz", g)
    B.add(prism(ring_of(FOOT, -0.05), GARDEN - 1.1, STONE_A), "tas_rustik", g)   # cepe cevre alt bant
    # bati cephesinde tas tam zemin kati kaplar
    B.add(bx((0.10, STONE_C - (GARDEN - 1.1), Z1 - Z0 - 0.1),
             (X0 - 0.05, (STONE_C + GARDEN - 1.1) / 2, (Z0 + Z1) / 2)), "tas_rustik", g)
    # dogu cephesinde tas garaj/plint bandi (sokak kotundan bahceye)
    B.add(bx((0.10, 2.3, Z1 - Z0 - 0.1), (X1 + 0.05, 1.15, (Z0 + Z1) / 2)), "tas_rustik", g)
    # derz cizgileri (guney + bati)
    yy = GARDEN - 0.9
    while yy < STONE_C - 0.2:
        if yy < STONE_A - 0.15:
            B.add(bx((13.0, 0.035, 0.06), (0.0, yy, Z1 + 0.02)), "derz", g)
            B.add(bx((13.0, 0.035, 0.06), (0.0, yy, ZAS + 0.02)), "derz", g)
        B.add(bx((0.06, 0.035, Z1 - Z0), (X0 - 0.03, yy, 0.0)), "derz", g)
        yy += 0.38

    # kalin beyaz kornis (foto: derin duz bant) — kirma catili guney kutlede
    CFOOT = [(X0, ZAS), (XSEAM, ZAS), (XSEAM, Z1), (X1, Z1), (X1, ZFLAT), (X0, ZFLAT)]
    B.add(prism(ring_of(CFOOT, -0.38), EAVE - 0.12, ROOF_Y0), "saceg", g)

    # ---- kirma cati (guney kutle) ----
    m, inner = band(HIP, ring_of(HIP, ROOF_INSET), ROOF_Y0, ROOF_Y0 + ROOF_H)
    B.add(m, "cati_arduvaz", "cati")
    B.add(prism(inner, ROOF_Y0 + ROOF_H - 0.05, ROOF_Y0 + ROOF_H + 0.06), "cati_duz", "cati")
    B.add(prism(HIP, ROOF_Y0 - 0.13, ROOF_Y0 + 0.02), "saceg", "cati")

    # ---- kuzey duz catili kanat ----
    WING = [(X0, Z0), (X1, Z0), (X1, ZFLAT + 0.3), (X0, ZFLAT + 0.3)]
    B.add(prism(WING, EAVE - 0.05, EAVE + 0.45), "siva_beyaz", "cati")          # parapet
    B.add(prism(ring_of(WING, 0.18), EAVE + 0.28, EAVE + 0.34), "duz_teras", "cati")
    B.add(bx((2.0, 1.05, 1.5), (-1.4, EAVE + 0.95, -4.6)), "cinko", "cati")     # cikis kutusu
    B.add(bx((0.7, 0.5, 0.7), (2.4, EAVE + 0.6, -5.2)), "cinko", "cati")
    B.add(cyl(0.09, 0.8, (4.0, EAVE + 0.75, -4.4), 8), "oluk", "cati")

    # ================= GUNEY (A) =================
    for y in WCY:
        sove_window(-5.15, ZAS, RY_S, y, w=0.95, h=1.6)     # dar aks (geri planda)
        bay_window(-1.55, Z1, RY_S, y)                       # erker 1
        bay_window(1.95, Z1, RY_S, y)                        # erker 2

    # ================= DOGU (B): balkon portali + garaj =================
    PW, PP = 4.3, 0.30
    PZC = Z1 - 1.15 - PW / 2                                 # portal merkezi
    pz0, pz1 = PZC - PW / 2, PZC + PW / 2
    B.add(bx((PP + 0.1, EAVE - STONE_A, 0.55), (X1 + PP / 2, (EAVE + STONE_A) / 2, pz1 + 0.27)), "sove_bej", g)
    B.add(bx((PP + 0.1, EAVE - STONE_A, 0.55), (X1 + PP / 2, (EAVE + STONE_A) / 2, pz0 - 0.27)), "sove_bej", g)
    B.add(bx((PP, 0.42, PW + 0.68), (X1 + PP / 2, EAVE - 0.21, PZC)), "sove_bej", g)
    B.add(bx((0.06, EAVE - STONE_A, PW), (X1 + 0.03, (EAVE + STONE_A) / 2, PZC)), "siva_ic", g)
    for fi, y in enumerate(WCY):
        slab = LV[fi] + 0.06
        glazing(X1 + 0.10, y + 0.15, PZC - 1.02, RY_E, 1.8, 2.25, blind=0.5)
        glazing(X1 + 0.10, y + 0.15, PZC + 1.02, RY_E, 1.8, 2.25, blind=0.5)
        B.add(bx((1.35, 0.16, PW - 0.12), (X1 + PP + 0.36, slab, PZC)), "balkon_dosem", "cephe")
        railing(X1 + PP + 1.0, slab + 0.08, PZC, RY_E, PW - 0.16)
        railing(X1 + PP + 0.52, slab + 0.08, pz0 + 0.03, RY_S, 1.0)
        railing(X1 + PP + 0.52, slab + 0.08, pz1 - 0.03, RY_S, 1.0)
    for y in WCY:
        sove_window(X1, -2.6, RY_E, y, w=1.5)                # portalin kuzeyindeki aks
    # garaj kapisi (sokak kotunda, tas bandin icinde)
    B.add(bx((0.12, 2.05, 2.9), (X1 + 0.08, 1.05, 2.6)), "garaj", "cephe")

    # ================= BATI (C): giris =================
    DZ = 4.5                                                  # kapi aksi
    B.add(bx((0.22, 2.45, 2.15), (X0 - 0.02, GARDEN + 1.225, DZ)), "siva_ic", g)   # nis
    B.add(bx((0.10, 2.3, 1.1), (X0 - 0.10, GARDEN + 1.15, DZ - 0.35)), "kapi", "cephe")
    B.add(bx((0.10, 2.3, 0.6), (X0 - 0.10, GARDEN + 1.15, DZ + 0.55)), "cam", "cephe")
    B.add(bx((1.35, 0.10, 2.55), (X0 - 0.62, GARDEN + 2.58, DZ), 0, 0.05), "kanopi", "cephe")
    B.add(bx((0.05, 0.28, 0.22), (X0 - 0.03, GARDEN + 1.9, DZ + 1.25)), "siva_beyaz", "cephe")  # 143
    B.add(bx((0.06, 0.5, 0.35), (X0 - 0.04, GARDEN + 1.15, DZ - 1.25)), "kapi", "cephe")        # posta/diafon
    for y in WCY[1:]:
        sove_window(X0, DZ, RY_W, y, w=0.85, h=1.35)          # kapi ustu dar kolon
    for y in WCY:
        sove_window(X0, 1.4, RY_W, y, w=1.6)                  # ana aks
    for y in WCY[1:]:
        sove_window(X0, -2.2, RY_W, y, w=1.3)
        sove_window(X0, -4.8, RY_W, y, w=1.0)
    glazing(X0 - 0.06, GARDEN + 1.5, 1.4, RY_W, 1.4, 1.1, blind=0.35)   # tas icinde zemin penceresi

    # ================= KUZEY: sade =================
    for y in WCY[1:]:
        sove_window(-3.6, Z0, RY_N, y, w=1.3)
        sove_window(0.4, Z0, RY_N, y, w=1.3)

    # ================= CATI USTU =================
    def dormer(c1, c2, ry, w, depth=2.1, wins=2, h=2.3):
        nx, nz = math.sin(ry), math.cos(ry)
        y0 = ROOF_Y0 + 0.32
        B.add(bx((w, h, depth), (c1, y0 + h / 2, c2), ry), "cinko", "cati")
        B.add(bx((w + 0.2, 0.13, depth + 0.2), (c1, y0 + h + 0.05, c2), ry), "cinko", "cati")
        fx, fz = c1 + nx * depth / 2, c2 + nz * depth / 2
        for k in range(wins):
            t = (k + 0.5) / wins - 0.5
            glazing(fx + math.cos(ry) * t * w * 0.7 + nx * 0.03, y0 + h * 0.5,
                    fz - math.sin(ry) * t * w * 0.7 + nz * 0.03, ry,
                    min(1.4, w / wins - 0.5), h - 0.95, "cati", blind=0.35)

    dormer(-1.55, Z1 + RM - 1.35, RY_S, 3.2, wins=2)          # guney: erker-1 ustu
    dormer(X1 + RM - 1.35, PZC, RY_E, 4.2, wins=2)            # dogu: portal ustu
    dormer(X0 - RM + 1.35, 1.4, RY_W, 2.6, wins=1)            # bati: ana aks ustu
    for cx, cz, ry in ((1.95, Z1 + RM - 2.0, RY_S), (-4.4, Z1 + RM - 1.7, RY_S)):
        m2 = trimesh.creation.box(extents=(0.9, 0.08, 1.15))
        m2.apply_transform(rotation_matrix(-SLOPE, [1, 0, 0]))
        m2.apply_translation([cx, ROOF_Y0 + 1.15, cz])
        B.add(m2, "cam", "cati")
    # mahyada uzun cinko baca
    B.add(bx((0.8, 3.1, 1.2), (0.4, ROOF_Y0 + ROOF_H + 0.2, 1.3)), "cinko", "cati")
    B.add(bx((0.95, 0.15, 1.35), (0.4, ROOF_Y0 + ROOF_H + 1.82, 1.3)), "cati_duz", "cati")

    # yagmur inisleri
    for cx, cz in ((XSEAM + 0.06, Z1 + 0.08), (X1 - 0.06, Z1 + 0.08), (X0 - 0.08, ZAS - 0.5)):
        B.add(cyl(0.05, EAVE - GARDEN, (cx, (EAVE + GARDEN) / 2, cz), 8), "oluk", g)


# ================================= ARSA =================================
PX0, PX1 = -11.4, 9.6          # bati kenarda arac yolu dahil
PZ0, PZ1 = -8.6, 9.8


def plot():
    g = "arsa"
    PLOT = [(PX0, PZ0), (PX1, PZ0), (PX1, PZ1), (PX0, PZ1)]
    B.add(prism(PLOT, -1.3, 0.02), "kaide", g)

    # sokaklar + kaldirimlar + bordur
    B.add(bx((PX1 - PX0 + 16, 0.15, 3.1), ((PX0 + PX1) / 2 + 4, 0.075, PZ1 + 1.65)), "kaldirim", g)
    B.add(bx((PX1 - PX0 + 16, 0.06, 0.25), ((PX0 + PX1) / 2 + 4, 0.18, PZ1 + 0.14)), "bordur", g)
    B.add(bx((PX1 - PX0 + 16, 0.12, 6.4), ((PX0 + PX1) / 2 + 4, 0.06, PZ1 + 6.4)), "asfalt", g)
    B.add(bx((3.1, 0.15, PZ1 - PZ0 + 12), (PX1 + 1.65, 0.075, 1.2)), "kaldirim", g)
    B.add(bx((0.25, 0.06, PZ1 - PZ0 + 12), (PX1 + 0.14, 0.18, 1.2)), "bordur", g)
    B.add(bx((6.4, 0.12, PZ1 - PZ0 + 12), (PX1 + 6.4, 0.06, 1.2)), "asfalt", g)

    # ---- bati serit: arac yolu (giris + park) ----
    DRV = [(X0 - 4.4, -6.5), (X0 - 0.25, -6.5), (X0 - 0.25, PZ1 + 3.1), (X0 - 4.4, PZ1 + 3.1)]
    B.add(prism(DRV, 0.02, GARDEN - 0.02), "kaide", g)
    B.add(prism(DRV, GARDEN - 0.02, GARDEN + 0.04), "yol_tasi", g)
    # sokaga inen rampa
    ramp = trimesh.creation.box(extents=(4.15, 0.12, 3.2))
    ramp.apply_transform(rotation_matrix(-0.28, [1, 0, 0]))
    ramp.apply_translation([X0 - 2.3, GARDEN - 0.42, PZ1 + 1.55])
    B.add(ramp, "yol_tasi", g)
    # kapiya giden dar yol
    B.add(bx((1.35, 0.05, 1.6), (X0 - 0.9, GARDEN + 0.05, 4.5)), "avlu_tas", g)
    # bati parsel siniri: alcak tas duvar + koyu metal cit (fotodaki)
    B.add(bx((0.35, GARDEN + 0.5, PZ1 - PZ0), (X0 - 4.75, (GARDEN + 0.5) / 2, (PZ0 + PZ1) / 2)), "tas_istinat", g)
    B.add(bx((0.42, 0.08, PZ1 - PZ0), (X0 - 4.75, GARDEN + 0.54, (PZ0 + PZ1) / 2)), "harpusta", g)
    for k in range(9):
        z = PZ0 + 1.2 + k * 1.9
        B.add(bx((0.06, 0.85, 0.06), (X0 - 4.75, GARDEN + 1.0, z)), "cit_metal", g)
    B.add(bx((0.04, 0.05, PZ1 - PZ0 - 1.2), (X0 - 4.75, GARDEN + 1.38, (PZ0 + PZ1) / 2)), "cit_metal", g)
    B.add(bx((0.04, 0.05, PZ1 - PZ0 - 1.2), (X0 - 4.75, GARDEN + 0.95, (PZ0 + PZ1) / 2)), "cit_metal", g)

    # ---- dogu serit: garaj rampasi (bej) + bahce ----
    B.add(prism([(X1 + 0.25, 0.9), (PX1 - 0.4, 0.9), (PX1 - 0.4, 4.3), (X1 + 0.25, 4.3)],
                0.02, 0.5), "avlu_tas", g)
    B.add(prism([(X1 + 0.25, -6.5), (PX1 - 0.4, -6.5), (PX1 - 0.4, 0.9), (X1 + 0.25, 0.9)],
                0.02, GARDEN), "cim", g)
    B.add(prism([(X1 + 0.25, 4.3), (PX1 - 0.4, 4.3), (PX1 - 0.4, PZ1 - 0.4), (X1 + 0.25, PZ1 - 0.4)],
                0.02, GARDEN), "cim", g)

    # ---- guney + dogu cevre: teraslamali tas tarhlar ----
    def wallseg(p0, p1, h, w=0.35):
        L = math.hypot(p1[0] - p0[0], p1[1] - p0[1])
        ry = math.atan2(p1[0] - p0[0], p1[1] - p0[1])
        cx, cz = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
        B.add(bx((w, h, L), (cx, h / 2, cz), ry), "tas_istinat", g)
        B.add(bx((w + 0.09, 0.09, L), (cx, h + 0.04, cz), ry), "harpusta", g)

    wallseg((PX0, PZ1), (PX1, PZ1), GARDEN + 0.08)            # guney sokak duvari
    wallseg((PX1, PZ1), (PX1, PZ0), GARDEN + 0.08)            # dogu
    wallseg((PX0, PZ0), (PX1, PZ0), GARDEN + 0.08)
    wallseg((PX0, PZ0), (PX0, PZ1), GARDEN + 0.08)
    # ic teras duvari (fotodaki ikinci kademe)
    wallseg((X0 - 0.3, PZ1 - 1.5), (5.4, PZ1 - 1.5), GARDEN + 0.55, 0.3)
    wallseg((5.4, PZ1 - 1.5), (5.4, PZ1), GARDEN + 0.55, 0.3)

    # bahce zeminleri
    B.add(prism([(PX0 + 0.3, PZ0 + 0.3), (X0 - 4.55, PZ0 + 0.3), (X0 - 4.55, PZ1 - 0.3), (PX0 + 0.3, PZ1 - 0.3)],
                0.02, GARDEN - 0.05), "cim", g)
    B.add(prism([(X0 - 0.25, PZ1 - 1.45), (5.4, PZ1 - 1.45), (5.4, PZ1 - 0.3), (X0 - 0.25, PZ1 - 0.3)],
                0.02, GARDEN + 0.4), "cim", g)                # yuksek tarh
    B.add(prism([(5.4, PZ1 - 1.45), (PX1 - 0.3, PZ1 - 1.45), (PX1 - 0.3, PZ1 - 0.3), (5.4, PZ1 - 0.3)],
                0.02, GARDEN - 0.05), "cim", g)
    B.add(prism([(X0 - 0.25, Z1 + 0.3), (5.4, Z1 + 0.3), (5.4, PZ1 - 1.5), (X0 - 0.25, PZ1 - 1.5)],
                0.02, GARDEN), "cim", g)


def planting():
    g = "bitki"

    def ball(x, z, r, y=GARDEN, acik=False):
        B.add(sph(r, (x, y + r * 0.72, z), 2, (1.0, 0.84, 1.0)),
              "cali_acik" if acik else "cali", g)

    def grass(x, z, y=GARDEN):
        for k in range(5):
            a = k * 2.51
            B.add(bx((0.05, 0.55, 0.05),
                     (x + 0.1 * math.cos(a), y + 0.27, z + 0.1 * math.sin(a)), 0, 0.12 * math.cos(a)),
                  "sus_otu", g)

    # yuksek tarh (guney onunde) — fotodaki simsir toplari + otlar
    for x, r, a in ((-5.6, 0.55, 0), (-4.2, 0.42, 1), (-2.9, 0.62, 0), (-1.2, 0.45, 1),
                    (0.3, 0.68, 0), (2.0, 0.5, 1), (3.4, 0.6, 0), (4.7, 0.44, 1)):
        ball(x, PZ1 - 0.88, r, GARDEN + 0.4, acik=bool(a))
    for x in (-4.9, -2.0, 1.2, 4.0):
        grass(x, PZ1 - 1.1, GARDEN + 0.4)
    # alt kademe / kose
    for x, r in ((5.9, 0.5), (7.2, 0.62), (8.4, 0.45)):
        ball(x, PZ1 - 0.85, r)
    grass(6.6, PZ1 - 0.9)
    # dogu serit
    for z, r in ((6.6, 0.55), (5.2, 0.42), (-0.2, 0.5), (-2.4, 0.62), (-4.6, 0.45)):
        ball(PX1 - 0.85, z, r)
    grass(PX1 - 0.9, -1.4)
    # bati bahce (komsu tarafi)
    for z, r in ((7.6, 0.5), (4.4, 0.62), (0.8, 0.45), (-2.8, 0.55)):
        ball(PX0 + 0.85, z, r)
    ball(X0 - 2.4, -5.6, 0.7)
    # kapi yani
    ball(X0 - 1.5, 6.4, 0.45)
    grass(X0 - 1.4, 3.2)

    def tree(x, z, h, r):
        B.add(cyl(0.14, h * 0.5, (x, GARDEN + h * 0.25, z), 8), "govde", g)
        B.add(sph(r, (x, GARDEN + h * 0.7, z), 2, (1.0, 0.86, 1.0)), "yaprak", g)
        B.add(sph(r * 0.62, (x + r * 0.4, GARDEN + h * 0.55, z + r * 0.28), 1), "yaprak", g)
    tree(-9.4, -6.6, 5.4, 1.8)
    tree(8.2, -7.2, 4.6, 1.5)


def cars():
    def car(x, z, ry, mat="arac_koyu", y=GARDEN):
        L, Wd = 4.45, 1.85
        B.add(bx((L, 0.46, Wd), (x, y + 0.56, z), ry), mat, "araclar")
        B.add(bx((L - 0.3, 0.34, Wd - 0.05), (x, y + 0.92, z), ry), mat, "araclar")
        ox, oz = -0.2 * math.cos(ry), 0.2 * math.sin(ry)
        B.add(bx((L * 0.47, 0.5, Wd - 0.15), (x + ox, y + 1.27, z + oz), ry), mat, "araclar")
        B.add(bx((L * 0.43, 0.38, Wd - 0.09), (x + ox, y + 1.29, z + oz), ry), "arac_cam", "araclar")
        for sx in (-1, 1):
            for sz in (-1, 1):
                dx = math.cos(ry) * sx * L * 0.33 - math.sin(ry) * sz * (Wd / 2 - 0.05)
                dz = -math.sin(ry) * sx * L * 0.33 - math.cos(ry) * sz * (Wd / 2 - 0.05)
                m = trimesh.creation.cylinder(radius=0.33, height=0.22, sections=12)
                m.apply_transform(rotation_matrix(math.pi / 2, [0, 1, 0]))
                m.apply_transform(rotation_matrix(ry, [0, 1, 0]))
                m.apply_translation([x + dx, y + 0.33, z + dz])
                B.add(m, "lastik", "araclar")
    # arac yolundaki iki koyu arac (hedef renderdaki)
    car(X0 - 2.3, 6.6, RY_E)
    car(X0 - 2.3, 1.6, RY_E, "arac_gri")
    # sokaklarda birkac arac
    car(-6.0, PZ1 + 5.2, RY_S, y=0)
    car(PX1 + 5.0, -3.4, RY_E, "arac_gri", y=0)


def main():
    building()
    plot()
    planting()
    cars()
    sc, tri = B.scene()
    p = OUT / "scene.glb"
    sc.export(p)
    info = {
        "dugum": len(sc.geometry), "ucgen": int(tri),
        "boyut_mb": round(p.stat().st_size / 1048576, 2),
        "sinirlar": [[round(float(v), 2) for v in sc.bounds[0]],
                     [round(float(v), 2) for v in sc.bounds[1]]],
        "gruplar": sorted({k.split("__")[0] for k in sc.geometry}),
        "malzemeler": sorted({k.split("__")[1] for k in sc.geometry}),
    }
    (OUT / "scene-info.json").write_text(json.dumps(info, ensure_ascii=False, indent=1))
    print(json.dumps({k: info[k] for k in ("dugum", "ucgen", "boyut_mb")}, indent=1))


if __name__ == "__main__":
    main()
