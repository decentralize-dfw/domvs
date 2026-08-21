#!/usr/bin/env python3
"""
Luxembourg kose apartmani — dis kabuk, referans fotograflardan birebir envanter.

SOKAK FOTOSU (cephe envanteri):
  GENIS-PENCERE CEPHESI (on, +Z):
    * rustik tas bahce kati (sokaktan ~2.4 m yukseklik gorunur)
    * 3 beyaz siva kat; akslar soldan saga:
        A1  dar pencere (w~0.9)  — SOLDAKI GERI CEKILMIS planda (0.4 m iceri)
        A2  GENIS pencere (w~2.35, bej sove bandi)
        A3  GENIS pencere (w~2.35, bej sove bandi)
        sag uc: kose seridine kadar sagir duvar
    * KOSE PENCERESI YOK. Duz 90 derece kose.
  BALKON CEPHESI (yan, +X):
    * koseye yakin: BEJ TAS PORTAL (genis dikey cerceve, ~0.3 m one tasar)
      icinde 3 kat ust uste balkon: beyaz dosemeli, koyu metal korkuluk,
      arkasi yerden tavana koyu dograma/cam
    * portalin saginda: sove'li dik pencere aksi (w~1.5)
    * sag ucta zemin: GIRIS — koyu kapi + ince kanopi, onunde bej tas avlu
  CATI: arduvaz kirma, ustu genis DUZ platform; beyaz kornis bandi;
    * genis-pencere yamacinda: buyuk cinko dormer kutusu (2 pencere) +
      arkada kucuk cinko kutu + isiklik
    * balkon yamacinda: buyuk cinko cerceveli EGIK CAMLI kutu (arrow'lu)
    * uzun cinko baca (mahya onunde) + ikinci baca sagda
HAVADAN RENDER (vaziyet):
    * arsa sokaktan ~0.95 m yuksek; rustik tas istinat duvarlari + harpusta
    * on ve yan bahceler: yuvarlak budanmis calilar dizili tarhlar + agac
    * giris onunden sokaga inen BEJ TAS DOSELI avlu/rampa (sag serit)
    * catida arka-solda cati cikisi kutusu
1 birim = 1 m. Y yukari. Malzeme gercekciligi sonraki asama.
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
    "siva_ic":      ("#DCD7CD", 0.0, 0.9),
    "sove_bej":     ("#D3BF9C", 0.0, 0.85),
    "tas_rustik":   ("#9C8E74", 0.0, 0.95),
    "derz":         ("#6E624E", 0.0, 0.95),
    "tas_istinat":  ("#988B72", 0.0, 0.95),
    "harpusta":     ("#B0A896", 0.0, 0.9),
    "cati_arduvaz": ("#363C43", 0.0, 0.82),
    "cati_duz":     ("#2E343A", 0.0, 0.8),
    "cinko":        ("#4A5058", 0.3, 0.55),
    "saceg":        ("#EAE7DF", 0.0, 0.85),
    "dograma":      ("#2B3036", 0.15, 0.45),
    "cam":          ("#151A21", 0.0, 0.12),
    "panjur":       ("#3A4048", 0.0, 0.5),
    "korkuluk":     ("#23272D", 0.5, 0.4),
    "balkon_dosem": ("#E7E3DA", 0.0, 0.85),
    "kapi":         ("#22262B", 0.2, 0.4),
    "kanopi":       ("#2F343A", 0.3, 0.45),
    "oluk":         ("#8A9098", 0.7, 0.35),
    "avlu_tas":     ("#C3B49A", 0.0, 0.92),
    "yol_tasi":     ("#B4AC9E", 0.0, 0.93),
    "asfalt":       ("#3A3F45", 0.0, 0.96),
    "kaldirim":     ("#ABA69C", 0.0, 0.92),
    "cim":          ("#5A7546", 0.0, 0.95),
    "cali":         ("#41632F", 0.0, 0.95),
    "yaprak":       ("#4A7036", 0.0, 0.95),
    "govde":        ("#5B4A3C", 0.0, 0.9),
    "arac_koyu":    ("#22262C", 0.4, 0.25),
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


def cyl(r, h, pos, axis="y", sections=14):
    m = trimesh.creation.cylinder(radius=r, height=h, sections=sections)
    if axis == "y":
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


# ============================ OLCULER ============================
# genis-pencere cephesi +Z bakar, balkon cephesi +X bakar. Kose (X1, Z1).
X0, X1 = -6.6, 6.6
Z0, Z1 = -5.8, 5.8
SETB = 0.4                    # sol ucta geri cekilme
XSEAM = -3.9                  # geri cekilme dikisi (A1 aksindan sonra)
ZB = Z1 - SETB                # geri cekilmis on duzlem

FOOT = [(X0, ZB), (XSEAM, ZB), (XSEAM, Z1), (X1, Z1),
        (X1, Z0), (X0, Z0)]

STREET_Y = 0.0
GARDEN_Y = 0.95               # arsa yukselligi
STONE_TOP = 2.40              # rustik tas katin ustu
FH = 2.95
FLOORS = 3
EAVE = STONE_TOP + FLOORS * FH        # 11.25
CORNICE_T = EAVE + 0.55

RM = 0.32
RECT = [(X0 - RM, Z0 - RM), (X1 + RM, Z0 - RM), (X1 + RM, Z1 + RM), (X0 - RM, Z1 + RM)]
ROOF_INSET = 3.6              # genis duz tepe icin daha dik yamac
ROOF_H = 3.9
SLOPE = math.atan2(ROOF_H, ROOF_INSET)
ROOF_Y0 = CORNICE_T
TOP_Y = ROOF_Y0 + ROOF_H

RY_ON, RY_SAG, RY_SOL, RY_ARKA = 0.0, math.pi / 2, -math.pi / 2, math.pi

fl_y = [STONE_TOP + f * FH + FH * 0.52 for f in range(FLOORS)]   # pencere merkezleri


# ============================ CEPHE OGELERI ============================
def glazing(cx, y, cz, ry, w, h, grp="cephe", blind=0.45):
    """Koyu dograma + cam; ust kisimda panjur (stor) bandi — fotodaki gorunum."""
    nx, nz = math.sin(ry), math.cos(ry)
    B.add(bx((w, h, 0.05), (cx, y, cz), ry), "cam", grp)
    if blind > 0:
        bh = h * blind
        B.add(bx((w - 0.08, bh, 0.06), (cx + nx * 0.005, y + h / 2 - bh / 2 - 0.03, cz + nz * 0.005), ry),
              "panjur", grp)
    t = 0.075
    fx, fz = nx * 0.025, nz * 0.025
    B.add(bx((w + 2 * t, t, 0.09), (cx + fx, y + h / 2 + t / 2, cz + fz), ry), "dograma", grp)
    B.add(bx((w + 2 * t, t, 0.09), (cx + fx, y - h / 2 - t / 2, cz + fz), ry), "dograma", grp)
    for s in (-1, 1):
        dx = math.cos(ry) * s * (w / 2 + t / 2)
        dz = -math.sin(ry) * s * (w / 2 + t / 2)
        B.add(bx((t, h + 2 * t, 0.09), (cx + dx + fx, y, cz + dz + fz), ry), "dograma", grp)


def sove(cx, cz, ry, y, w, h, p=0.10, s=0.24, grp="cephe"):
    """Bej dogaltasi bant cerceve (fotograftaki flat sove)."""
    nx, nz = math.sin(ry), math.cos(ry)
    fx, fz = cx + nx * p / 2, cz + nz * p / 2
    B.add(bx((w + 2 * s, s, p), (fx, y + h / 2 + s / 2, fz), ry), "sove_bej", grp)
    B.add(bx((w + 2 * s, s, p), (fx, y - h / 2 - s / 2, fz), ry), "sove_bej", grp)
    for sgn in (-1, 1):
        dx = math.cos(ry) * sgn * (w / 2 + s / 2)
        dz = -math.sin(ry) * sgn * (w / 2 + s / 2)
        B.add(bx((s, h, p), (fx + dx, y, fz + dz), ry), "sove_bej", grp)


def upper_window(cx, cz, ry, y, w, h=1.62, grp="cephe"):
    nx, nz = math.sin(ry), math.cos(ry)
    glazing(cx + nx * 0.07, y, cz + nz * 0.07, ry, w, h, grp)
    sove(cx, cz, ry, y, w + 0.1, h + 0.1, grp=grp)
    B.add(bx((w + 0.5, 0.08, 0.20), (cx + nx * 0.08, y - h / 2 - 0.30, cz + nz * 0.08), ry), "sove_bej", grp)


def stone_window(cx, cz, ry, y, w=1.5, h=1.15, grp="cephe"):
    nx, nz = math.sin(ry), math.cos(ry)
    glazing(cx + nx * 0.05, y, cz + nz * 0.05, ry, w, h, grp, blind=0.35)
    B.add(bx((w + 0.24, 0.14, 0.12), (cx + nx * 0.06, y + h / 2 + 0.07, cz + nz * 0.06), ry), "harpusta", grp)


def railing(cx, y, cz, ry, w, h=1.02, grp="cephe"):
    B.add(bx((w, 0.075, 0.055), (cx, y + h, cz), ry), "korkuluk", grp)
    B.add(bx((w, 0.05, 0.045), (cx, y + 0.08, cz), ry), "korkuluk", grp)
    n = max(4, int(w / 0.115))
    for k in range(n):
        t = (k + 0.5) / n - 0.5
        dx, dz = math.cos(ry) * t * w, -math.sin(ry) * t * w
        B.add(bx((0.026, h, 0.026), (cx + dx, y + h / 2, cz + dz), ry), "korkuluk", grp)


# ============================ BINA ============================
def building():
    g = "govde"
    # ---- rustik tas bahce kati (sokak kotundan tas ustune) ----
    B.add(prism(ring_of(FOOT, -0.06), GARDEN_Y - 1.2, STONE_TOP), "tas_rustik", g)
    yy = GARDEN_Y + 0.10
    while yy < STONE_TOP - 0.2:
        B.add(prism(ring_of(FOOT, -0.035), yy, yy + 0.04), "derz", g)
        yy += 0.36
    B.add(prism(ring_of(FOOT, -0.10), STONE_TOP - 0.04, STONE_TOP + 0.12), "sove_bej", g)

    # ---- ust govde + kornis ----
    B.add(prism(FOOT, STONE_TOP, EAVE), "siva_beyaz", g)
    B.add(prism(ring_of(FOOT, -0.30), EAVE - 0.08, CORNICE_T), "saceg", g)

    # ---- cati ----
    m, inner = band(RECT, ring_of(RECT, ROOF_INSET), ROOF_Y0, TOP_Y)
    B.add(m, "cati_arduvaz", "cati")
    B.add(prism(inner, TOP_Y - 0.05, TOP_Y + 0.07), "cati_duz", "cati")
    B.add(prism(RECT, ROOF_Y0 - 0.13, ROOF_Y0 + 0.02), "saceg", "cati")

    # ============ GENIS-PENCERE CEPHESI (+Z) ============
    # A1 dar aks geri cekilmis planda
    for y in fl_y:
        upper_window(-5.3, ZB, RY_ON, y, 0.92)
    # A2 + A3 genis akslar ana planda
    for y in fl_y:
        upper_window(-1.7, Z1, RY_ON, y, 2.35)
        upper_window(1.7, Z1, RY_ON, y, 2.35)
    # tas katta pencereler
    stone_window(-1.7, Z1, RY_ON, GARDEN_Y + 0.85)
    stone_window(1.7, Z1, RY_ON, GARDEN_Y + 0.85)
    stone_window(-5.3, ZB, RY_ON, GARDEN_Y + 0.85, w=0.85)

    # ============ BALKON CEPHESI (+X) ============
    PORT_W, PORT_P = 4.3, 0.32           # bej portal: genislik, one tasma
    PORT_Z = Z1 - 0.9 - PORT_W / 2       # koseden 0.9 sonra baslar -> merkez
    # portal cercevesi (tas ustunden kornise)
    pz0, pz1 = PORT_Z - PORT_W / 2, PORT_Z + PORT_W / 2
    B.add(bx((PORT_P, EAVE - STONE_TOP, 0.35), (X1 + PORT_P / 2, (STONE_TOP + EAVE) / 2, pz1 + 0.175)), "sove_bej", g)
    B.add(bx((PORT_P, EAVE - STONE_TOP, 0.35), (X1 + PORT_P / 2, (STONE_TOP + EAVE) / 2, pz0 - 0.175)), "sove_bej", g)
    B.add(bx((PORT_P, 0.45, PORT_W + 0.7), (X1 + PORT_P / 2, EAVE - 0.225, PORT_Z)), "sove_bej", g)
    # portal ici: hafif geri duzlem + kat kat balkon
    B.add(bx((0.06, EAVE - STONE_TOP, PORT_W), (X1 + 0.03, (STONE_TOP + EAVE) / 2, PORT_Z)), "siva_ic", g)
    for fi, y in enumerate(fl_y):
        slab_y = STONE_TOP + fi * FH + 0.08
        glazing(X1 + 0.10, y + 0.18, PORT_Z - 1.05, RY_SAG, 1.85, 2.25, blind=0.5)
        glazing(X1 + 0.10, y + 0.18, PORT_Z + 1.05, RY_SAG, 1.85, 2.25, blind=0.5)
        B.add(bx((1.45, 0.16, PORT_W - 0.1), (X1 + PORT_P + 0.4, slab_y, PORT_Z)), "balkon_dosem", "cephe")
        railing(X1 + PORT_P + 1.1, slab_y + 0.08, PORT_Z, RY_SAG, PORT_W - 0.14)
        railing(X1 + PORT_P + 0.55, slab_y + 0.08, pz0 + 0.03, 0.0, 1.1)
        railing(X1 + PORT_P + 0.55, slab_y + 0.08, pz1 - 0.03, 0.0, 1.1)
    # portalin saginda pencere aksi
    for y in fl_y:
        upper_window(X1, -2.2, RY_SAG, y, 1.5)
    # tas katta: giris (sag ucta) + pencere
    stone_window(X1, -0.2, RY_SAG, GARDEN_Y + 0.85, w=1.2)
    door_z = -4.2
    B.add(bx((0.2, 2.35, 1.9), (X1 - 0.02, GARDEN_Y + 1.175, door_z)), "siva_ic", g)
    B.add(bx((0.1, 2.2, 1.15), (X1 + 0.06, GARDEN_Y + 1.1, door_z - 0.25)), "kapi", "cephe")
    B.add(bx((0.1, 2.2, 0.55), (X1 + 0.06, GARDEN_Y + 1.1, door_z + 0.6)), "cam", "cephe")
    B.add(bx((1.15, 0.12, 2.4), (X1 + 0.55, GARDEN_Y + 2.45, door_z)), "kanopi", "cephe")

    # ============ SOL (-X) & ARKA (-Z) sade akslar ============
    for y in fl_y:
        upper_window(X0, 2.4, RY_SOL, y, 1.7)
        upper_window(X0, -1.4, RY_SOL, y, 1.3)
        for xx, w in ((-4.2, 1.5), (-1.2, 1.8), (2.2, 1.5), (5.0, 0.95)):
            upper_window(xx, Z0, RY_ARKA, y, w)
    stone_window(X0, 2.4, RY_SOL, GARDEN_Y + 0.85)
    stone_window(-1.2, Z0, RY_ARKA, GARDEN_Y + 0.85)

    # ============ CATI USTU ============
    def dormer(cx, cz, ry, w, depth, wins, h=2.35):
        nx, nz = math.sin(ry), math.cos(ry)
        y0 = ROOF_Y0 + 0.35
        B.add(bx((w, h, depth), (cx, y0 + h / 2, cz), ry), "cinko", "cati")
        B.add(bx((w + 0.22, 0.14, depth + 0.22), (cx, y0 + h + 0.06, cz), ry), "cinko", "cati")
        fx, fz = cx + nx * depth / 2, cz + nz * depth / 2
        for k in range(wins):
            t = (k + 0.5) / wins - 0.5
            glazing(fx + math.cos(ry) * t * w * 0.72 + nx * 0.03, y0 + h * 0.52,
                    fz - math.sin(ry) * t * w * 0.72 + nz * 0.03, ry,
                    min(1.35, w / wins - 0.55), h - 1.0, "cati", blind=0.3)

    def glassbox(c_along, ry, w, depth=2.4, h=2.0):
        """Cinko cerceveli egik camli buyuk cati kutusu (balkon yamacindaki)."""
        nx, nz = math.sin(ry), math.cos(ry)
        y0 = ROOF_Y0 + 0.35
        if abs(nx) > 0.5:      # +X yamaci
            cx, cz = X1 + RM - depth / 2 - 0.28, c_along
            size = (depth, h, w)
        else:
            cx, cz = c_along, Z1 + RM - depth / 2 - 0.28
            size = (w, h, depth)
        B.add(bx(size, (cx, y0 + h / 2, cz)), "cinko", "cati")
        gm = trimesh.creation.box(extents=(w - 0.35, 0.1, depth - 0.5))
        gm.apply_transform(rotation_matrix(-SLOPE * 0.55, [1, 0, 0] if abs(nz) > 0.5 else [0, 0, 1]))
        gm.apply_translation([cx + nx * 0.1, y0 + h + 0.02, cz + nz * 0.1])
        B.add(gm, "cam", "cati")

    dormer(-2.2, Z1 + RM - 1.35, RY_ON, 3.0, 2.2, 2)      # A2 ustu buyuk kutu
    dormer(-4.6, Z1 + RM - 1.05, RY_ON, 1.6, 1.5, 1)      # arkadaki kucuk kutu
    dormer(0.0, Z0 - RM + 1.25, RY_ARKA, 3.2, 2.2, 2)     # arka
    dormer(X0 - RM + 1.15, 0.6, RY_SOL, 2.4, 2.0, 1)      # sol yamac
    glassbox(1.4, RY_SAG, 4.2)                            # balkon yamaci — egik camli kutu

    # isikliklar
    for cx, cz, ry in ((0.9, Z1 + RM - 2.1, RY_ON), (-3.3, Z0 - RM + 2.1, RY_ARKA)):
        m2 = trimesh.creation.box(extents=(0.95, 0.09, 1.2))
        m2.apply_transform(rotation_matrix(-SLOPE if ry == RY_ON else SLOPE, [1, 0, 0]))
        m2.apply_translation([cx, ROOF_Y0 + 1.45, cz])
        B.add(m2, "cam", "cati")

    # bacalar: uzun cinko (foto ortasi) + sag arka
    B.add(bx((0.85, 3.4, 1.25), (-2.0, TOP_Y + 0.4, 0.6)), "cinko", "cati")
    B.add(bx((1.0, 0.16, 1.4), (-2.0, TOP_Y + 2.18, 0.6)), "cati_duz", "cati")
    B.add(bx((0.8, 2.0, 1.1), (4.5, TOP_Y - 0.6, -2.8)), "cinko", "cati")
    B.add(bx((0.95, 0.15, 1.25), (4.5, TOP_Y + 0.48, -2.8)), "cati_duz", "cati")
    # arka-sol cati cikis kutusu (duz tepede)
    B.add(bx((1.9, 1.1, 1.6), (-1.9, TOP_Y + 0.55, -1.6)), "cinko", "cati")

    # yagmur inisleri
    for cx, cz in ((XSEAM + 0.08, Z1 + 0.1), (X1 - 0.08, Z1 + 0.1), (X1 + 0.1, Z0 + 0.15), (X0 - 0.1, 0.2)):
        B.add(cyl(0.055, EAVE - GARDEN_Y, (cx, (EAVE + GARDEN_Y) / 2, cz), sections=8), "oluk", g)


# ============================ ARSA ============================
PX0, PX1 = -10.8, 11.6
PZ0, PZ1 = -9.6, 10.4


def plot():
    g = "arsa"
    PLOT = [(PX0, PZ0), (PX1, PZ0), (PX1, PZ1), (PX0, PZ1)]
    B.add(prism(PLOT, -1.3, 0.02), "kaide", g)

    # sokaklar + kaldirim
    B.add(bx((PX1 - PX0 + 16, 0.14, 3.2), ((PX0 + PX1) / 2 + 4, 0.07, PZ1 + 1.7)), "kaldirim", g)
    B.add(bx((PX1 - PX0 + 16, 0.12, 6.6), ((PX0 + PX1) / 2 + 4, 0.06, PZ1 + 6.5)), "asfalt", g)
    B.add(bx((3.2, 0.14, PZ1 - PZ0 + 12), (PX1 + 1.7, 0.07, 0.6)), "kaldirim", g)
    B.add(bx((6.6, 0.12, PZ1 - PZ0 + 12), (PX1 + 6.5, 0.06, 0.6)), "asfalt", g)

    # rustik istinat duvarlari + harpusta (arsa cevresi)
    for p0, p1 in (((PX0, PZ1), (PX1, PZ1)), ((PX1, PZ1), (PX1, PZ0)),
                   ((PX0, PZ0), (PX1, PZ0)), ((PX0, PZ0), (PX0, PZ1))):
        L = math.hypot(p1[0] - p0[0], p1[1] - p0[1])
        ry = math.atan2(p1[0] - p0[0], p1[1] - p0[1])
        cx, cz = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
        B.add(bx((0.45, GARDEN_Y + 0.1, L), (cx, (GARDEN_Y + 0.1) / 2, cz), ry), "tas_istinat", g)
        B.add(bx((0.55, 0.09, L), (cx, GARDEN_Y + 0.12, cz), ry), "harpusta", g)

    # bahce zemini
    B.add(prism(ring_of([(PX0, PZ0), (PX1, PZ0), (PX1, PZ1), (PX0, PZ1)], 0.45),
                0.02, GARDEN_Y), "cim", g)

    # ---- giris avlusu: bej tas doseme, balkon cephesi onunden sokaga ----
    APR = [(X1 + 0.2, -6.6), (PX1 - 0.45, -6.6), (PX1 - 0.45, 1.2), (X1 + 0.2, 1.2)]
    B.add(prism(APR, GARDEN_Y - 0.02, GARDEN_Y + 0.06), "avlu_tas", g)
    # avludan yan sokaga inen rampa/merdiven
    for k in range(5):
        y1 = GARDEN_Y - (k + 1) * (GARDEN_Y - 0.14) / 5
        B.add(bx((5.4, 0.16, 1.05), (X1 + 2.85, y1 + 0.08, -6.6 - 0.5 - k * 0.52)), "avlu_tas", g)

    # ---- on bahcede tas doseli dar yuruyus yolu ----
    B.add(bx((1.7, 0.07, 3.0), (-5.0, GARDEN_Y + 0.02, PZ1 - 1.55)), "yol_tasi", g)


def planting():
    g = "bitki"
    def bush(x, z, r=0.62):
        B.add(sph(r, (x, GARDEN_Y + r * 0.7, z), 2, (1.0, 0.82, 1.0)), "cali", g)

    # on bahce tarhi: fotodaki gibi sik yuvarlak calilar
    for x, r in ((-9.6, 0.62), (-8.2, 0.5), (-6.6, 0.68), (-3.4, 0.56), (-1.8, 0.72),
                 (-0.2, 0.5), (1.6, 0.66), (3.4, 0.54), (5.2, 0.7), (7.0, 0.52)):
        bush(x, PZ1 - 0.95, r)
    for x, r in ((-2.6, 0.5), (0.8, 0.58), (4.2, 0.48)):
        bush(x, PZ1 - 2.3, r)
    # sol serit
    for z, r in ((8.2, 0.6), (5.6, 0.5), (2.8, 0.66), (-0.4, 0.52), (-3.6, 0.62), (-6.4, 0.5)):
        bush(PX0 + 0.95, z, r)
    # arka serit
    for x, r in ((-8.4, 0.6), (-5.6, 0.5), (-2.6, 0.64), (0.6, 0.5), (3.4, 0.6)):
        bush(x, PZ0 + 0.95, r)
    # avlu kenari
    for z, r in ((0.6, 0.55), (-2.4, 0.45), (-5.2, 0.55)):
        bush(PX1 - 1.0, z, r)

    def tree(x, z, h, r):
        B.add(cyl(0.15, h * 0.5, (x, GARDEN_Y + h * 0.25, z), sections=8), "govde", g)
        B.add(sph(r, (x, GARDEN_Y + h * 0.72, z), 2, (1.0, 0.86, 1.0)), "yaprak", g)
        B.add(sph(r * 0.66, (x + r * 0.4, GARDEN_Y + h * 0.56, z + r * 0.3), 1), "yaprak", g)
        B.add(sph(r * 0.6, (x - r * 0.38, GARDEN_Y + h * 0.6, z - r * 0.26), 1), "yaprak", g)

    tree(-8.6, 6.8, 6.2, 2.1)         # fotodaki on-sol agac
    tree(-7.8, -6.8, 5.2, 1.8)


def cars():
    def car(x, z, ry):
        L, Wd = 4.4, 1.84
        B.add(bx((L, 0.44, Wd), (x, 0.56, z), ry), "arac_koyu", "araclar")
        B.add(bx((L - 0.3, 0.36, Wd - 0.05), (x, 0.9, z), ry), "arac_koyu", "araclar")
        ox, oz = -0.2 * math.cos(ry), 0.2 * math.sin(ry)
        B.add(bx((L * 0.48, 0.52, Wd - 0.14), (x + ox, 1.26, z + oz), ry), "arac_koyu", "araclar")
        B.add(bx((L * 0.44, 0.4, Wd - 0.08), (x + ox, 1.28, z + oz), ry), "arac_cam", "araclar")
        for sx in (-1, 1):
            for sz in (-1, 1):
                dx = math.cos(ry) * sx * L * 0.33 - math.sin(ry) * sz * (Wd / 2 - 0.05)
                dz = -math.sin(ry) * sx * L * 0.33 - math.cos(ry) * sz * (Wd / 2 - 0.05)
                m = trimesh.creation.cylinder(radius=0.33, height=0.22, sections=12)
                m.apply_transform(rotation_matrix(math.pi / 2, [0, 1, 0]))
                m.apply_transform(rotation_matrix(ry, [0, 1, 0]))
                m.apply_translation([x + dx, 0.33, z + dz])
                B.add(m, "lastik", "araclar")
    car(-7.2, PZ1 + 1.7, 0.0)
    car(-2.2, PZ1 + 1.7, 0.0)
    car(PX1 + 1.9, -5.0, math.pi / 2)


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
