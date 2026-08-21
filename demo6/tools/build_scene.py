#!/usr/bin/env python3
"""
Ana bina — Luxembourg kose apartmani, dis kabuk. BIREBIR kutle sadakati:

  * ON cephede CIKMA: kose pencereli hacim ~0.55 m one tasar (sol yarim)
  * giris korunagi bu cikmanin sagindaki GERI planda (ana duzlem)
  * SOL cephede GERI CEKILME: arka bolum ~0.45 m iceri
  * sacak / beyaz kornis bandi bu kirikliklari AYNEN takip eder
  * cati egimi ise butun kutlenin uzerinde tek parca (gercekte oldugu gibi:
    geri cekilen duvarin ustunde cati daha fazla sarkar)
  * cati kutulari (cinko dormer) CEPHE AKSLARINA HIZALI:
      - on solda: cikma hacminin ustunde
      - on sagda: sag pencere aksinin ustunde
      - sag (balkon) cephede: balkon aksinin ustunde
      - solda: genis pencere aksinin ustunde
  1 birim = 1 m, Y yukari.
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
    "siva_golge":   ("#DCD7CD", 0.0, 0.9),
    "sove_bej":     ("#D8C7A5", 0.0, 0.85),
    "tas_zemin":    ("#A2947A", 0.0, 0.93),
    "derz":         ("#7C7160", 0.0, 0.93),
    "tas_sokl":     ("#9E9789", 0.0, 0.92),
    "tas_duvar":    ("#9F947F", 0.0, 0.93),
    "harpusta":     ("#8F887B", 0.0, 0.9),
    "cati_arduvaz": ("#394047", 0.0, 0.8),
    "cati_mahya":   ("#2C3238", 0.0, 0.78),
    "dormer_metal": ("#2E3339", 0.25, 0.5),
    "saceg":        ("#E9E6DE", 0.0, 0.85),
    "dograma":      ("#2E3338", 0.15, 0.45),
    "cam":          ("#141920", 0.0, 0.12),
    "korkuluk":     ("#282D33", 0.5, 0.4),
    "balkon_dosem": ("#E5E1D8", 0.0, 0.85),
    "kapi":         ("#26292E", 0.2, 0.4),
    "kanopi":       ("#33383D", 0.3, 0.45),
    "oluk":         ("#878D94", 0.7, 0.35),
    "parke":        ("#B9AF9F", 0.0, 0.93),
    "parke_koyu":   ("#A1978A", 0.0, 0.93),
    "asfalt":       ("#393E44", 0.0, 0.96),
    "kaldirim":     ("#A9A49A", 0.0, 0.92),
    "cim":          ("#587343", 0.0, 0.95),
    "cit":          ("#3C5E30", 0.0, 0.95),
    "yaprak":       ("#456B32", 0.0, 0.95),
    "govde":        ("#5B4A3C", 0.0, 0.9),
    "arac_koyu":    ("#20242A", 0.4, 0.25),
    "arac_cam":     ("#171B21", 0.1, 0.12),
    "lastik":       ("#141619", 0.0, 0.85),
    "kaide":        ("#2A2E33", 0.0, 0.85),
    "metal_acik":   ("#979DA5", 0.7, 0.35),
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


# ------------------------------------------------------------------ ilkeller
def bx(size, pos, ry=0.0, rx=0.0):
    m = trimesh.creation.box(extents=size)
    if rx:
        m.apply_transform(rotation_matrix(rx, [1, 0, 0]))
    if ry:
        m.apply_transform(rotation_matrix(ry, [0, 1, 0]))
    m.apply_translation(pos)
    return m


def cyl(r, h, pos, axis="y", sections=14, ry=0.0):
    m = trimesh.creation.cylinder(radius=r, height=h, sections=sections)
    if axis == "y":
        m.apply_transform(rotation_matrix(math.pi / 2, [1, 0, 0]))
    elif axis == "x":
        m.apply_transform(rotation_matrix(math.pi / 2, [0, 1, 0]))
    if ry:
        m.apply_transform(rotation_matrix(ry, [0, 1, 0]))
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
    if inner is None or len(inner) != len(outer):
        return None
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


# ------------------------------------------------------------------ kutle
X0, X1 = -6.6, 6.6            # toplam genislik 13.2
Z0, Z1 = -6.0, 6.0            # ana on duzlem
PROJ = 0.55                   # on cikma derinligi
ZP = Z1 + PROJ                # cikma on duzlemi  = 6.55
XP = X0 + 4.8                 # cikmanin sag siniri = -1.8
XR = X0 + 0.45                # sol arka geri cekilmis duzlem = -6.15
ZR = -0.4                     # sol cephedeki kirilma noktasi

FOOT = [(X0, ZP), (XP, ZP), (XP, Z1), (X1, Z1),
        (X1, Z0), (XR, Z0), (XR, ZR), (X0, ZR)]

BASE = 0.55
FH = 3.0
FLOORS = 3
GF_TOP = BASE + FH
EAVE = BASE + FLOORS * FH     # 9.55
CORNICE_T = EAVE + 0.52

# cati: tum kutleyi orten tek kirma egim (dikdortgen hull)
RM = 0.30                     # cati sacak payi (hull disina)
RECT = [(X0 - RM, Z0 - RM), (X1 + RM, Z0 - RM), (X1 + RM, ZP + RM), (X0 - RM, ZP + RM)]
ROOF_INSET = 4.3
ROOF_H = 5.0
SLOPE = math.atan2(ROOF_H, ROOF_INSET)
ROOF_Y0 = CORNICE_T


# ------------------------------------------------------------------ cephe ogeleri
def glazing(cx, y, cz, ry, w, h, grp="cephe"):
    nx, nz = math.sin(ry), math.cos(ry)
    B.add(bx((w, h, 0.06), (cx, y, cz), ry), "cam", grp)
    t = 0.07
    fx, fz = nx * 0.02, nz * 0.02
    B.add(bx((w, t, 0.1), (cx + fx, y + h / 2 - t / 2, cz + fz), ry), "dograma", grp)
    B.add(bx((w, t, 0.1), (cx + fx, y - h / 2 + t / 2, cz + fz), ry), "dograma", grp)
    for s in (-1, 1):
        dx = math.cos(ry) * s * (w / 2 - t / 2)
        dz = -math.sin(ry) * s * (w / 2 - t / 2)
        B.add(bx((t, h, 0.1), (cx + dx + fx, y, cz + dz + fz), ry), "dograma", grp)


def sove_window(cx, cz, ry, y, w=1.7, h=1.6, sove=True, grp="cephe"):
    """(cx,cz) duvar duzleminde; normal yonunde disari tasar."""
    nx, nz = math.sin(ry), math.cos(ry)
    gx, gz = cx + nx * 0.10, cz + nz * 0.10
    glazing(gx, y, gz, ry, w, h, grp)
    if not sove:
        return
    s, p = 0.20, 0.16
    fx, fz = gx + nx * 0.05, gz + nz * 0.05
    B.add(bx((w + 2 * s, s, p), (fx, y + h / 2 + s / 2, fz), ry), "sove_bej", grp)
    B.add(bx((w + 2 * s, s, p), (fx, y - h / 2 - s / 2, fz), ry), "sove_bej", grp)
    for sgn in (-1, 1):
        dx = math.cos(ry) * sgn * (w / 2 + s / 2)
        dz = -math.sin(ry) * sgn * (w / 2 + s / 2)
        B.add(bx((s, h + 2 * s, p), (fx + dx, y, fz + dz), ry), "sove_bej", grp)


def corner_window(y, w=1.75, h=1.6, grp="cephe"):
    """Cikma hacminin (X0, ZP) kosesini saran pencere."""
    g = 0.02
    glazing(X0 + g + w / 2, y, ZP + 0.10, 0.0, w, h, grp)
    glazing(X0 - 0.10, y, ZP - g - w / 2, -math.pi / 2, w, h, grp)
    B.add(bx((0.14, h, 0.14), (X0 + 0.02, y, ZP - 0.02)), "dograma", grp)
    s, p = 0.20, 0.16
    for yy in (y + h / 2 + s / 2, y - h / 2 - s / 2):
        B.add(bx((w + g + s + 0.1, s, p), (X0 + (w + g + 0.1 - s) / 2, yy, ZP + 0.11)), "sove_bej", grp)
        B.add(bx((p, s, w + g + s + 0.1), (X0 - 0.11, yy, ZP - (w + g + 0.1 - s) / 2)), "sove_bej", grp)
        B.add(bx((p + 0.06, s, p + 0.06), (X0 - 0.02, yy, ZP + 0.02)), "sove_bej", grp)
    B.add(bx((s, h + 2 * s, p), (X0 + g + w + s / 2, y, ZP + 0.11)), "sove_bej", grp)
    B.add(bx((p, h + 2 * s, s), (X0 - 0.11, y, ZP - g - w - s / 2)), "sove_bej", grp)


def railing(cx, y, cz, ry, w, h=1.05, grp="cephe"):
    B.add(bx((w, 0.07, 0.06), (cx, y + h, cz), ry), "korkuluk", grp)
    B.add(bx((w, 0.05, 0.05), (cx, y + 0.10, cz), ry), "korkuluk", grp)
    n = max(4, int(w / 0.125))
    for k in range(n):
        t = (k + 0.5) / n - 0.5
        dx, dz = math.cos(ry) * t * w, -math.sin(ry) * t * w
        B.add(bx((0.028, h, 0.028), (cx + dx, y + h / 2, cz + dz), ry), "korkuluk", grp)


def balcony(cx, cz, ry, y_slab, w=4.3, d=1.4, grp="cephe"):
    nx, nz = math.sin(ry), math.cos(ry)
    mx, mz = cx + nx * d / 2, cz + nz * d / 2
    B.add(bx((w, 0.18, d), (mx, y_slab, mz), ry), "balkon_dosem", grp)
    railing(cx + nx * d, y_slab + 0.09, cz + nz * d, ry, w, grp=grp)
    for s in (-1, 1):
        px = mx + math.cos(ry) * s * w / 2
        pz = mz - math.sin(ry) * s * w / 2
        railing(px, y_slab + 0.09, pz, ry + math.pi / 2, d, grp=grp)


def dormer(cx, cz, ry, w=3.4, h=2.55, depth=2.3, wins=2, grp="cati"):
    """(cx,cz) = kutu merkezi. Sacaktan hemen yukarida, cepheye hizali cinko kutu."""
    nx, nz = math.sin(ry), math.cos(ry)
    y0 = ROOF_Y0 + 0.55
    B.add(bx((w, h, depth), (cx, y0 + h / 2, cz), ry), "dormer_metal", grp)
    B.add(bx((w + 0.26, 0.18, depth + 0.26), (cx, y0 + h + 0.07, cz), ry), "dormer_metal", grp)
    fx, fz = cx + nx * depth / 2, cz + nz * depth / 2
    for k in range(wins):
        tt = (k + 0.5) / wins - 0.5
        wx = fx + math.cos(ry) * tt * (w * 0.78)
        wz = fz - math.sin(ry) * tt * (w * 0.78)
        glazing(wx + nx * 0.02, y0 + h * 0.52, wz + nz * 0.02, ry,
                min(1.5, w / wins - 0.7), h - 1.15, grp)


def skylight(cx, cz, ry, w=0.95, hh=1.25, up=1.9, grp="cati"):
    y = ROOF_Y0 + up * math.tan(SLOPE) * 0.72 + 0.35
    for size, mat, dy in (((w + 0.14, 0.10, hh + 0.14), "dormer_metal", 0.0),
                          ((w, 0.14, hh), "cam", 0.05)):
        m = trimesh.creation.box(extents=size)
        m.apply_transform(rotation_matrix(-SLOPE, [1, 0, 0]))
        m.apply_transform(rotation_matrix(ry, [0, 1, 0]))
        m.apply_translation([cx, y + dy, cz])
        B.add(m, mat, grp)


def chimney(cx, cz, w=1.0, d=1.5, top=None, grp="cati"):
    top = top or (ROOF_Y0 + ROOF_H + 0.9)
    y0 = ROOF_Y0 + 1.0
    B.add(bx((w, top - y0, d), (cx, (y0 + top) / 2, cz)), "dormer_metal", grp)
    B.add(bx((w + 0.18, 0.15, d + 0.18), (cx, top + 0.07, cz)), "cati_mahya", grp)


def bush(x, z, r=0.7, y=BASE, grp="bitki"):
    B.add(sph(r, (x, y + r * 0.75, z), 2, (1.0, 0.85, 1.0)), "cit", grp)


def tree(x, z, h=6.0, r=2.0, y=BASE, grp="bitki"):
    B.add(cyl(0.15, h * 0.5, (x, y + h * 0.25, z), sections=8), "govde", grp)
    B.add(sph(r, (x, y + h * 0.7, z), 2, (1.0, 0.88, 1.0)), "yaprak", grp)
    B.add(sph(r * 0.68, (x + r * 0.42, y + h * 0.55, z + r * 0.3), 1), "yaprak", grp)
    B.add(sph(r * 0.6, (x - r * 0.4, y + h * 0.6, z - r * 0.28), 1), "yaprak", grp)


def car(x, z, ry, grp="araclar"):
    L, Wd = 4.4, 1.84
    B.add(bx((L, 0.44, Wd), (x, 0.54, z), ry), "arac_koyu", grp)
    B.add(bx((L - 0.3, 0.36, Wd - 0.05), (x, 0.88, z), ry), "arac_koyu", grp)
    ox, oz = -0.2 * math.cos(ry), 0.2 * math.sin(ry)
    B.add(bx((L * 0.48, 0.52, Wd - 0.14), (x + ox, 1.24, z + oz), ry), "arac_koyu", grp)
    B.add(bx((L * 0.44, 0.4, Wd - 0.08), (x + ox, 1.26, z + oz), ry), "arac_cam", grp)
    B.add(bx((L * 0.5, 0.06, Wd - 0.1), (x + ox, 1.48, z + oz), ry), "arac_koyu", grp)
    for sx in (-1, 1):
        for sz in (-1, 1):
            dx = math.cos(ry) * sx * L * 0.33 - math.sin(ry) * sz * (Wd / 2 - 0.05)
            dz = -math.sin(ry) * sx * L * 0.33 - math.cos(ry) * sz * (Wd / 2 - 0.05)
            B.add(cyl(0.33, 0.22, (x + dx, 0.33, z + dz), axis="x", sections=12, ry=ry), "lastik", grp)


# ------------------------------------------------------------------ bina
RY_ON, RY_ARKA = 0.0, math.pi
RY_SAG, RY_SOL = math.pi / 2, -math.pi / 2


def building():
    g = "govde"
    # tas zemin kat + sokl (kutleyi aynen takip eder)
    B.add(prism(ring_of(FOOT, -0.05), -1.6, GF_TOP), "tas_zemin", g)
    B.add(prism(ring_of(FOOT, -0.09), -1.6, BASE - 0.02), "tas_sokl", g)
    yy = BASE + 0.42
    while yy < GF_TOP - 0.25:
        B.add(prism(ring_of(FOOT, -0.065), yy, yy + 0.035), "derz", g)
        yy += 0.44
    B.add(prism(ring_of(FOOT, -0.08), GF_TOP - 0.06, GF_TOP + 0.10), "sove_bej", g)
    # ust govde
    B.add(prism(FOOT, GF_TOP, EAVE), "siva_beyaz", g)
    # kornis: kutlenin kirikliklarini takip eden beyaz bant
    B.add(prism(ring_of(FOOT, -0.34), EAVE - 0.10, CORNICE_T), "saceg", g)

    # cati: dikdortgen hull uzerinde tek kirma egim + duz tepe
    top_ring = ring_of(RECT, ROOF_INSET)
    res = band(RECT, top_ring, ROOF_Y0, ROOF_Y0 + ROOF_H)
    m, inner = res
    B.add(m, "cati_arduvaz", "cati")
    B.add(prism(inner, ROOF_Y0 + ROOF_H - 0.06, ROOF_Y0 + ROOF_H + 0.06), "cati_mahya", "cati")
    # sacak alti kapama (hull ile kornis arasi)
    B.add(prism(RECT, ROOF_Y0 - 0.14, ROOF_Y0 + 0.02), "saceg", "cati")

    fl_y = [BASE + f * FH + FH * 0.52 for f in range(FLOORS)]

    # ---------------- ON — cikma hacmi (z = ZP duzlemi) ----------------
    for y in fl_y:
        corner_window(y)                       # kose penceresi cikmanin kosesinde
        sove_window(X0 + 3.6, ZP, RY_ON, y, w=1.35)   # cikmanin sag aksi

    # ---------------- ON — geri plan (z = Z1) ----------------
    # giris aksi x=-0.4 · pencere akslari x=1.9, x=4.6
    for fi, y in enumerate(fl_y):
        if fi > 0:
            sove_window(-0.4, Z1, RY_ON, y, w=0.85)   # giris ustu dar kolon
        sove_window(1.9, Z1, RY_ON, y, w=1.35)
        sove_window(4.6, Z1, RY_ON, y, w=1.7)
    # giris
    B.add(bx((2.6, 2.5, 0.24), (-0.4, BASE + 1.28, Z1 - 0.07), RY_ON), "siva_golge", "cephe")
    B.add(bx((1.35, 2.25, 0.12), (-0.75, BASE + 1.15, Z1 + 0.05), RY_ON), "kapi", "cephe")
    B.add(bx((0.55, 2.25, 0.10), (0.35, BASE + 1.15, Z1 + 0.05), RY_ON), "cam", "cephe")
    B.add(bx((3.0, 0.16, 1.30), (-0.4, BASE + 2.62, Z1 + 0.58), RY_ON), "kanopi", "cephe")
    B.add(bx((0.30, 0.4, 0.06), (0.95, BASE + 1.55, Z1 + 0.08), RY_ON), "metal_acik", "cephe")

    # ---------------- SOL — on plan (x = X0, z in [ZR, ZP]) ----------------
    for y in fl_y:
        sove_window(X0, 2.9, RY_SOL, y, w=2.5)
    # ---------------- SOL — geri cekilmis plan (x = XR) ----------------
    for y in fl_y:
        sove_window(XR, -2.0, RY_SOL, y, w=1.9)
        sove_window(XR, -4.6, RY_SOL, y, w=1.3)

    # ---------------- SAG (+X): balkon aksi z=3.1 · pencereler z=-1.6, -4.3 ----
    for fi, y in enumerate(fl_y):
        y_slab = BASE + fi * FH + 0.10
        B.add(bx((4.1, 2.4, 0.06), (X1 + 0.06, y + 0.1, 3.1), RY_SAG), "siva_golge", "cephe")
        glazing(X1 + 0.09, y, 3.1 - 1.0, RY_SAG, 1.6, 2.1)
        glazing(X1 + 0.09, y, 3.1 + 1.0, RY_SAG, 1.6, 2.1)
        balcony(X1, 3.1, RY_SAG, y_slab)
        sove_window(X1, -1.6, RY_SAG, y, w=1.5)
        sove_window(X1, -4.3, RY_SAG, y, w=1.0)

    # ---------------- ARKA (-Z) ----------------
    for fi, y in enumerate(fl_y):
        for xx, w in ((-4.6, 1.5), (-1.6, 1.9), (1.6, 1.5), (4.4, 0.9)):
            sove_window(xx, Z0, RY_ARKA, y, w=w, sove=(fi > 0))

    # bodrum pencereleri
    for xx in (1.9, 4.6):
        glazing(xx, BASE - 0.55, Z1 + 0.08, RY_ON, 0.95, 0.5)
    glazing(X0 - 0.08, BASE - 0.55, 2.9, RY_SOL, 0.95, 0.5)
    glazing(XR - 0.08, BASE - 0.55, -2.0, RY_SOL, 0.95, 0.5)

    # ---------------- cati ustu: akslara hizali ----------------
    dormer(X0 + 2.6, ZP + RM - 1.15, RY_ON, w=3.0, wins=2)   # cikma hacmi ustu
    dormer(4.35, ZP + RM - 1.15, RY_ON, w=2.4, wins=1)       # sag on aks ustu
    skylight(-0.4, ZP + RM - 2.4, RY_ON)                     # giris aksi ustu
    dormer(X1 + RM - 1.15, 3.1, RY_SAG, w=4.4, wins=2)       # balkon aksi ustu
    skylight(X1 + RM - 2.4, -1.6, RY_SAG)                    # sag pencere aksi ustu
    dormer(X0 - RM + 1.15, 2.9, RY_SOL, w=2.8, wins=1)       # sol genis aks ustu
    skylight(X0 - RM + 2.4, -2.0, RY_SOL)                    # sol arka aks ustu
    dormer(-1.6, Z0 - RM + 1.15, RY_ARKA, w=3.6, wins=2)     # arka orta aks ustu
    skylight(3.0, Z0 - RM + 2.4, RY_ARKA)
    chimney(4.4, -3.6)
    chimney(-4.2, -2.6, w=0.85, d=1.15, top=ROOF_Y0 + ROOF_H + 0.5)

    # yagmur inisleri (kutle koselerinde)
    for cx, cz in ((XP - 0.1, ZP + 0.12), (X1 - 0.1, Z1 + 0.12), (X1 + 0.12, Z0 + 0.1), (X0 + 0.12, ZR - 0.1)):
        B.add(cyl(0.06, EAVE, (cx, EAVE / 2 + 0.3, cz), sections=8), "oluk", g)


# ------------------------------------------------------------------ arsa
PX0, PX1 = -11.5, 11.8
PZ0, PZ1 = -10.2, 11.0
PLOT = [(PX0, PZ0), (PX1, PZ0), (PX1, PZ1), (PX0, PZ1)]


def plot():
    g = "arsa"
    B.add(prism(PLOT, -1.4, -0.16), "kaide", g)
    B.add(prism(PLOT, -0.16, 0.02), "kaldirim", g)
    B.add(prism(PLOT, 0.0, 0.78), "tas_duvar", g)
    B.add(prism(PLOT, 0.78, 0.88), "harpusta", g)
    B.add(prism(ring_of(PLOT, 0.5), 0.0, BASE + 0.35), "cim", g)

    court = [(X1 + 0.3, -6.0), (PX1 - 0.5, -6.0), (PX1 - 0.5, 8.2), (X1 + 0.3, 8.2)]
    B.add(prism(court, BASE - 0.02, BASE + 0.10), "parke", g)
    B.add(prism([(-1.6, Z1), (0.8, Z1), (0.8, PZ1 - 0.5), (-1.6, PZ1 - 0.5)], BASE - 0.02, BASE + 0.08),
          "parke_koyu", g)
    ramp = [(X0 + 0.4, ZP + 0.2), (-2.0, ZP + 0.2), (-2.0, PZ1 - 0.6), (X0 + 0.4, PZ1 - 0.6)]
    B.add(prism(ramp, -0.3, -0.12), "parke_koyu", g)
    railing(-4.2, 0.4, PZ1 - 0.6, 0.0, 4.4, h=0.9, grp=g)
    railing(X0 + 0.4, 0.4, (ZP + PZ1) / 2, math.pi / 2, 3.2, h=0.9, grp=g)

    B.add(bx((PX1 - PX0 + 14, 0.14, 3.4), ((PX0 + PX1) / 2 + 3, 0.07, PZ1 + 1.8)), "kaldirim", g)
    B.add(bx((PX1 - PX0 + 14, 0.12, 7.0), ((PX0 + PX1) / 2 + 3, 0.06, PZ1 + 6.9)), "asfalt", g)
    B.add(bx((3.4, 0.14, PZ1 - PZ0 + 10), (PX1 + 1.8, 0.07, 1.0)), "kaldirim", g)
    B.add(bx((7.0, 0.12, PZ1 - PZ0 + 10), (PX1 + 6.9, 0.06, 1.0)), "asfalt", g)


def planting():
    for x, z, r in ((2.6, 9.6, 0.85), (4.2, 9.0, 0.6), (5.6, 9.7, 0.75), (8.4, 9.2, 0.55),
                    (-7.4, 9.8, 0.7), (-9.6, 9.4, 0.55), (-10.6, 9.9, 0.6)):
        bush(x, z, r)
    for z in (-8.0, -5.2, -2.6, 0.4, 3.2):
        bush(10.6, z, 0.6)
    for x in (-9.0, -6.0, -3.0, 1.0, 5.0, 8.0):
        bush(x, -9.2, 0.65)
    bush(-10.4, 5.0, 0.7)
    bush(-10.4, 1.0, 0.6)
    bush(-10.4, -3.0, 0.7)
    tree(-8.6, -7.4, h=6.5, r=2.1)
    tree(9.8, -8.6, h=5.2, r=1.7)


def cars():
    car(-6.5, 15.0, 0.0)
    car(-1.5, 15.0, 0.0)
    car(16.2, -4.0, math.pi / 2)


def main():
    building()
    plot()
    planting()
    cars()
    sc, tri = B.scene()
    p = OUT / "scene.glb"
    sc.export(p)
    info = {
        "konu": "Luxembourg kose apartmani — artikulasyonlu kutle (cikma + geri cekilme)",
        "dugum": len(sc.geometry),
        "ucgen": int(tri),
        "boyut_mb": round(p.stat().st_size / 1048576, 2),
        "kutle": {"on_cikma_m": PROJ, "sol_geri_cekilme_m": round(XR - X0, 2),
                  "sacak": round(EAVE, 2), "cati_tepe": round(ROOF_Y0 + ROOF_H, 2)},
        "sinirlar": [[round(float(v), 2) for v in sc.bounds[0]],
                     [round(float(v), 2) for v in sc.bounds[1]]],
        "gruplar": sorted({k.split("__")[0] for k in sc.geometry}),
        "malzemeler": sorted({k.split("__")[1] for k in sc.geometry}),
    }
    (OUT / "scene-info.json").write_text(json.dumps(info, ensure_ascii=False, indent=1))
    print(json.dumps({k: info[k] for k in ("dugum", "ucgen", "boyut_mb", "kutle")},
                     ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
