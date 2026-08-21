#!/usr/bin/env python3
"""
Ana bina — Luxembourg kose apartmani, dis kabuk modeli.

Referanslar (fotograflardan okunan):
  * zemin kat: rustik kesme tas kaplama; ustunde 2 kat beyaz siva
  * tum sokak pencerelerinde cikintili BEJ SOVE cerceveleri, koyu jaluzili cam
  * sokaga bakan koselerde KOSE PENCERELERI (iki cam ince koyu dikmeyle kosede bulusur,
    soveler koseyi sarar)
  * yan cephede ust uste balkonlar (koyu dikey cubuklu korkuluk, acik doseme)
  * belirgin beyaz kat/sacak bantlari; dik arduvaz cati, tepesi duz
  * catida genis KOYU METAL (cinko) dormer kutulari, cinko kaplamali bacalar
  * giris: koyu metal duz sacak (kanopi), koyu kapi, yanlarda dar pencere kolonu
  * arsa: tas istinat duvarlari, yuvarlak budanmis simsir toplari, parke avlu,
    on-solda metal korkuluklu bodrum rampasi
Ic mekan yok — yalnizca dis kabuk. 1 birim = 1 m, Y yukari (glTF).
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
    "tas_sokl":     ("#9E9789", 0.0, 0.92),
    "tas_duvar":    ("#9F947F", 0.0, 0.93)
    ,"derz":         ("#7C7160", 0.0, 0.93),
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
        self.group = "bina"

    def add(self, mesh, mat, group=None):
        if mesh is not None:
            self.parts.setdefault((group or self.group, mat), []).append(mesh)

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


# ---------------------------------------------------------------- ilkeller
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
    if inset > 0 and (not Polygon(out).is_valid or Polygon(out).area < 0.4):
        return None
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


# ---------------------------------------------------------------- olculer
W, D = 13.2, 12.0
X0, X1 = -W / 2, W / 2
Z0, Z1 = -D / 2, D / 2
FOOT = [(X0, Z0), (X1, Z0), (X1, Z1), (X0, Z1)]
BASE = 0.55            # bahce kotu (istinat duvari icindeki zemin)
FH = 3.0
FLOORS = 3             # zemin (tas) + 2 kat (siva)
GF_TOP = BASE + FH     # tas kaplamanin ustu
EAVE = BASE + FLOORS * FH          # 9.55
ROOF_INSET = 4.2
ROOF_H = 5.1
SLOPE = math.atan2(ROOF_H, ROOF_INSET)

# cepheler: ON = +Z (giris, sokak 1) · SAG = +X (balkonlar, sokak 2)
#           SOL = -X (genis pencereler + kose penceresi) · ARKA = -Z


def face_info(face):
    if face == "on":
        return 0.0, (0.0, 1.0)
    if face == "arka":
        return math.pi, (0.0, -1.0)
    if face == "sag":
        return math.pi / 2, (1.0, 0.0)
    return -math.pi / 2, (-1.0, 0.0)


def face_point(face, t, out=0.0):
    """t: cepheye soldan saga (disaridan bakinca) 0..1"""
    ry, (nx, nz) = face_info(face)
    if face == "on":
        x, z = X0 + t * W, Z1
    elif face == "arka":
        x, z = X1 - t * W, Z0
    elif face == "sag":
        x, z = X1, Z1 - t * D
    else:
        x, z = X0, Z0 + t * D
    return x + nx * out, z + nz * out, ry, nx, nz


# ---------------------------------------------------------------- cephe ogeleri
def glazing(cx, y, cz, ry, w, h, grp):
    """koyu cam + ince koyu dograma"""
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


def sove_window(face, t_c, y, w=2.1, h=1.6, grp="cephe", sove=True, sove_mat="sove_bej"):
    """Cikintili bej soveli pencere (referanstaki ana pencere tipi)."""
    cx, cz, ry, nx, nz = face_point(face, t_c, out=0.10)
    glazing(cx, y, cz, ry, w, h, grp)
    if not sove:
        return
    s = 0.20          # sove bant genisligi
    p = 0.16          # cikinti
    fx, fz = nx * 0.05, nz * 0.05
    B.add(bx((w + 2 * s, s, p), (cx + fx, y + h / 2 + s / 2, cz + fz), ry), sove_mat, grp)
    B.add(bx((w + 2 * s, s, p), (cx + fx, y - h / 2 - s / 2, cz + fz), ry), sove_mat, grp)
    for sgn in (-1, 1):
        dx = math.cos(ry) * sgn * (w / 2 + s / 2)
        dz = -math.sin(ry) * sgn * (w / 2 + s / 2)
        B.add(bx((s, h + 2 * s, p), (cx + dx + fx, y, cz + dz + fz), ry), sove_mat, grp)


def corner_window(y, w=1.75, h=1.6, grp="cephe"):
    """ON-SOL kosesini (X0, Z1) saran kose penceresi: iki cam ince koyu dikmede bulusur,
    bej soveler koseyi doner."""
    g = 0.02
    # cam ON yuzunde (normal +Z)
    cxa = X0 + g + w / 2
    glazing(cxa, y, Z1 + 0.10, 0.0, w, h, grp)
    # cam SOL yuzunde (normal -X)
    cza = Z1 - g - w / 2
    glazing(X0 - 0.10, y, cza, -math.pi / 2, w, h, grp)
    # kose dikmesi
    B.add(bx((0.14, h, 0.14), (X0 + 0.02, y, Z1 - 0.02)), "dograma", grp)
    s, p = 0.20, 0.16
    # ust/alt soveler — koseyi sarar
    for yy in (y + h / 2 + s / 2, y - h / 2 - s / 2):
        B.add(bx((w + g + s + 0.1, s, p), (X0 + (w + g + 0.1 - s) / 2 + 0.0, yy, Z1 + 0.11)), sove := "sove_bej", grp)
        B.add(bx((p, s, w + g + s + 0.1), (X0 - 0.11, yy, Z1 - (w + g + 0.1 - s) / 2)), sove, grp)
        B.add(bx((p + 0.06, s, p + 0.06), (X0 - 0.02, yy, Z1 + 0.02)), sove, grp)
    # dis dusey soveler
    B.add(bx((s, h + 2 * s, p), (X0 + g + w + s / 2, y, Z1 + 0.11)), "sove_bej", grp)
    B.add(bx((p, h + 2 * s, s), (X0 - 0.11, y, Z1 - g - w - s / 2)), "sove_bej", grp)


def railing(cx, y, cz, ry, w, h=1.05, grp="cephe"):
    B.add(bx((w, 0.07, 0.06), (cx, y + h, cz), ry), "korkuluk", grp)
    B.add(bx((w, 0.05, 0.05), (cx, y + 0.10, cz), ry), "korkuluk", grp)
    n = max(4, int(w / 0.125))
    for k in range(n):
        t = (k + 0.5) / n - 0.5
        dx, dz = math.cos(ry) * t * w, -math.sin(ry) * t * w
        B.add(bx((0.028, h, 0.028), (cx + dx, y + h / 2, cz + dz), ry), "korkuluk", grp)


def balcony(face, t_c, y_slab, w=3.9, d=1.4, grp="cephe"):
    cx, cz, ry, nx, nz = face_point(face, t_c, out=0.0)
    mx, mz = cx + nx * d / 2, cz + nz * d / 2
    B.add(bx((w, 0.18, d), (mx, y_slab, mz), ry), "balkon_dosem", grp)
    ex, ez = cx + nx * d, cz + nz * d
    railing(ex, y_slab + 0.09, ez, ry, w, grp=grp)
    for s in (-1, 1):
        px = mx + math.cos(ry) * s * w / 2
        pz = mz - math.sin(ry) * s * w / 2
        railing(px, y_slab + 0.09, pz, ry + math.pi / 2, d, grp=grp)


def dormer(face, t, w=4.4, h=2.6, depth=2.4, wins=2, grp="cati"):
    cx, cz, ry, nx, nz = face_point(face, t, out=0.0)
    inset = 1.3
    cx, cz = cx - nx * inset, cz - nz * inset
    y0 = EAVE + 0.75
    B.add(bx((w, h, depth), (cx, y0 + h / 2, cz), ry), "dormer_metal", grp)
    B.add(bx((w + 0.26, 0.18, depth + 0.26), (cx, y0 + h + 0.07, cz), ry), "dormer_metal", grp)
    fx, fz = cx + nx * depth / 2, cz + nz * depth / 2
    for k in range(wins):
        tt = (k + 0.5) / wins - 0.5
        wx = fx + math.cos(ry) * tt * (w * 0.82)
        wz = fz - math.sin(ry) * tt * (w * 0.82)
        glazing(wx + nx * 0.02, y0 + h / 2, wz + nz * 0.02, ry,
                min(1.6, w / wins - 0.6), h - 1.0, grp)


def skylight(face, t, inset=2.7, w=0.95, h=1.25, grp="cati"):
    cx, cz, ry, nx, nz = face_point(face, t, out=0.0)
    cx, cz = cx - nx * inset, cz - nz * inset
    y = EAVE + 0.4 + (inset - 0.42) * math.tan(SLOPE)
    for size, mat, dy in (((w + 0.14, 0.10, h + 0.14), "dormer_metal", 0.0),
                          ((w, 0.14, h), "cam", 0.05)):
        m = trimesh.creation.box(extents=size)
        m.apply_transform(rotation_matrix(-SLOPE, [1, 0, 0]))
        m.apply_transform(rotation_matrix(ry, [0, 1, 0]))
        m.apply_translation([cx, y + dy, cz])
        B.add(m, mat, grp)


def chimney(cx, cz, w=1.0, d=1.6, top=None, grp="cati"):
    top = top or (EAVE + ROOF_H + 1.0)
    y0 = EAVE + 1.2
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


# ---------------------------------------------------------------- bina
def building():
    g = "govde"
    # tas zemin kat (govdeden 5 cm tasar) + altta yari bodrum
    B.add(prism(ring_of(FOOT, -0.05), -1.6, GF_TOP), "tas_zemin", g)
    B.add(prism(ring_of(FOOT, -0.09), -1.6, BASE - 0.02), "tas_sokl", g)
    # tas derz cizgileri (zemin kati saran ince cikintili seritler)
    yy = BASE + 0.42
    while yy < GF_TOP - 0.25:
        B.add(prism(ring_of(FOOT, -0.065), yy, yy + 0.035), "derz", g)
        yy += 0.44
    # dusey derzler yerine köşe taşları hissi: sokl üstü ince bant yeterli
    # zemin/1. kat ayrimi: ince bej bant
    B.add(prism(ring_of(FOOT, -0.08), GF_TOP - 0.06, GF_TOP + 0.10), "sove_bej", g)
    # ust govde (beyaz siva)
    B.add(prism(FOOT, GF_TOP, EAVE), "siva_beyaz", g)
    # belirgin beyaz sacak bandi
    B.add(prism(ring_of(FOOT, -0.34), EAVE - 0.10, EAVE + 0.52), "saceg", g)

    # cati
    outer = ring_of(FOOT, -0.34)
    top_ring = ring_of(outer, ROOF_INSET)
    res = band(outer, top_ring, EAVE + 0.52, EAVE + 0.52 + ROOF_H)
    if res:
        m, inner = res
        B.add(m, "cati_arduvaz", "cati")
        B.add(prism(inner, EAVE + 0.46 + ROOF_H, EAVE + 0.58 + ROOF_H), "cati_mahya", "cati")

    # ---------------- ON cephe (+Z, giris sokagi) ----------------
    for fl in range(FLOORS):
        y = BASE + fl * FH + FH * 0.52
        corner_window(y)                                   # ON-SOL kosesi
        sove_window("on", 0.42, y, w=1.35, h=1.6)          # orta aks
        sove_window("on", 0.60, y, w=0.85, h=1.6)          # giris ustu dar kolon
        sove_window("on", 0.82, y, w=1.7, h=1.6)           # sag aks
    # giris (zemin, t=0.60 civari)
    cx, cz, ry, nx, nz = face_point("on", 0.62, out=0.0)
    B.add(bx((2.6, 2.5, 0.24), (cx - nx * 0.06, BASE + 1.28, cz - nz * 0.06), ry), "siva_golge", "cephe")
    B.add(bx((1.35, 2.25, 0.12), (cx + nx * 0.05, BASE + 1.15, cz + nz * 0.05), ry), "kapi", "cephe")
    B.add(bx((0.55, 2.25, 0.10), (cx + math.cos(ry) * 0.98 + nx * 0.05, BASE + 1.15,
                                  cz - math.sin(ry) * 0.98 + nz * 0.05), ry), "cam", "cephe")
    B.add(bx((3.0, 0.16, 1.35), (cx + nx * 0.62, BASE + 2.62, cz + nz * 0.62), ry), "kanopi", "cephe")
    B.add(bx((0.30, 0.4, 0.06), (cx + math.cos(ry) * 1.6 + nx * 0.08, BASE + 1.55,
                                 cz - math.sin(ry) * 1.6 + nz * 0.08), ry), "metal_acik", "cephe")

    # ---------------- SOL cephe (-X, genis pencereler) ----------------
    for fl in range(FLOORS):
        y = BASE + fl * FH + FH * 0.52
        sove_window("sol", 0.30, y, w=2.5, h=1.6)
        sove_window("sol", 0.62, y, w=2.1, h=1.6)
        # kose penceresi bu cephenin sag ucunda (corner_window ile geldi)

    # ---------------- SAG cephe (+X, balkonlar) ----------------
    for fl in range(FLOORS):
        y = BASE + fl * FH + FH * 0.52
        y_slab = BASE + fl * FH + 0.10
        # balkon arkasi genis dograma
        cx, cz, ry, nx, nz = face_point("sag", 0.30, out=0.06)
        B.add(bx((4.1, 2.4, 0.06), (cx, y + 0.1, cz), ry), "siva_golge", "cephe")
        glazing(cx - math.cos(ry) * 1.0 + nx * 0.03, y, cz + math.sin(ry) * 1.0 + nz * 0.03, ry, 1.6, 2.1, "cephe")
        glazing(cx + math.cos(ry) * 1.0 + nx * 0.03, y, cz - math.sin(ry) * 1.0 + nz * 0.03, ry, 1.6, 2.1, "cephe")
        balcony("sag", 0.30, y_slab, w=4.3, d=1.4)
        sove_window("sag", 0.68, y, w=1.5, h=1.6)
        sove_window("sag", 0.88, y, w=1.0, h=1.6)

    # ---------------- ARKA cephe (-Z) ----------------
    for fl in range(FLOORS):
        y = BASE + fl * FH + FH * 0.52
        for t, w in ((0.16, 1.5), (0.42, 1.9), (0.72, 1.5), (0.9, 0.9)):
            sove_window("arka", t, y, w=w, h=1.55, sove=(fl > 0))

    # bodrum pencereleri (tas icinde, sove yok) — on ve sol
    for t in (0.2, 0.42):
        cx, cz, ry, nx, nz = face_point("on", t, out=0.08)
        glazing(cx, BASE - 0.55, cz, ry, 0.95, 0.5, "cephe")
    for t in (0.3, 0.62):
        cx, cz, ry, nx, nz = face_point("sol", t, out=0.08)
        glazing(cx, BASE - 0.55, cz, ry, 0.95, 0.5, "cephe")

    # ---------------- cati ustu ----------------
    dormer("on", 0.30, w=4.6, h=2.6, wins=2)     # fotograftaki sol buyuk cinko kutu
    dormer("on", 0.78, w=2.4, h=2.5, wins=1)
    dormer("sag", 0.32, w=4.8, h=2.7, wins=2)    # balkon cephesindeki genis kutu
    dormer("sol", 0.45, w=3.2, h=2.5, wins=1)
    dormer("arka", 0.4, w=3.8, h=2.5, wins=2)
    skylight("on", 0.55)
    skylight("sol", 0.8)
    skylight("sag", 0.75)
    skylight("arka", 0.75)
    chimney(X1 - 2.6, Z0 + 2.2)                  # buyuk cinko baca
    chimney(X0 + 2.2, Z0 + 3.4, w=0.85, d=1.2, top=EAVE + ROOF_H + 0.7)

    # yagmur inisleri
    for cx, cz in ((X0 + 0.1, Z1 + 0.12), (X1 - 0.1, Z1 + 0.12), (X1 + 0.12, Z0 + 0.1)):
        B.add(cyl(0.06, EAVE, (cx, EAVE / 2 + 0.3, cz), sections=8), "oluk", g)


# ---------------------------------------------------------------- arsa
PX0, PX1 = -11.5, 11.8
PZ0, PZ1 = -10.2, 10.6
PLOT = [(PX0, PZ0), (PX1, PZ0), (PX1, PZ1), (PX0, PZ1)]


def plot():
    g = "arsa"
    B.add(prism(PLOT, -1.4, -0.16), "kaide", g)
    B.add(prism(PLOT, -0.16, 0.02), "kaldirim", g)
    # istinat duvari (tas) + harpusta — bahce kotu BASE'e kadar dolu
    B.add(prism(PLOT, 0.0, 0.78), "tas_duvar", g)
    B.add(prism(PLOT, 0.78, 0.88), "harpusta", g)
    B.add(prism(ring_of(PLOT, 0.5), 0.0, BASE + 0.35), "cim", g)   # duvar ici dolgu+cim

    # avlu (SAG cephe onu, parke)
    court = [(X1 + 0.3, -6.0), (PX1 - 0.5, -6.0), (PX1 - 0.5, 8.2), (X1 + 0.3, 8.2)]
    B.add(prism(court, BASE - 0.02, BASE + 0.10), "parke", g)
    # on bahce yolu (giris)
    B.add(prism([(0.2, Z1), (2.6, Z1), (2.6, PZ1 - 0.5), (0.2, PZ1 - 0.5)], BASE - 0.02, BASE + 0.08),
          "parke_koyu", g)
    # bodrum rampasi (on-sol) + metal korkuluk
    ramp = [(X0 + 0.6, Z1 + 0.2), (0.0, Z1 + 0.2), (0.0, PZ1 - 0.6), (X0 + 0.6, PZ1 - 0.6)]
    B.add(prism(ramp, -0.3, -0.12), "parke_koyu", g)
    railing(-3.1, 0.4, PZ1 - 0.6, 0.0, 6.0, h=0.9, grp=g)
    railing(X0 + 0.6, 0.4, (Z1 + PZ1) / 2, math.pi / 2, 3.6, h=0.9, grp=g)

    # sokaklar: ON (+Z) ve SAG (+X)
    B.add(bx((PX1 - PX0 + 14, 0.14, 3.4), ((PX0 + PX1) / 2 + 3, 0.07, PZ1 + 1.8)), "kaldirim", g)
    B.add(bx((PX1 - PX0 + 14, 0.12, 7.0), ((PX0 + PX1) / 2 + 3, 0.06, PZ1 + 6.9)), "asfalt", g)
    B.add(bx((3.4, 0.14, PZ1 - PZ0 + 10), (PX1 + 1.8, 0.07, 1.0)), "kaldirim", g)
    B.add(bx((7.0, 0.12, PZ1 - PZ0 + 10), (PX1 + 6.9, 0.06, 1.0)), "asfalt", g)


def planting():
    # yuvarlak budanmis simsirler (fotograftaki toplar) — on bahce
    for x, z, r in ((3.6, 9.2, 0.85), (5.2, 8.6, 0.6), (6.6, 9.3, 0.75), (8.4, 8.8, 0.55),
                    (-6.4, 9.4, 0.7), (-8.6, 9.0, 0.55), (-10.2, 9.5, 0.6)):
        bush(x, z, r)
    # sag avlu kenari
    for z in (-8.0, -5.2, -2.6, 0.4, 3.2):
        bush(10.6, z, 0.6)
    # arka bahce
    for x in (-9.0, -6.0, -3.0, 1.0, 5.0, 8.0):
        bush(x, -9.2, 0.65)
    bush(-10.4, 5.0, 0.7); bush(-10.4, 1.0, 0.6); bush(-10.4, -3.0, 0.7)
    tree(-8.6, -7.4, h=6.5, r=2.1)
    tree(9.8, -8.6, h=5.2, r=1.7)


def cars():
    car(-6.5, 14.6, 0.0, "araclar")
    car(-1.5, 14.6, 0.0, "araclar")
    car(16.2, -4.0, math.pi / 2, "araclar")


def main():
    building()
    plot()
    planting()
    cars()
    sc, tri = B.scene()
    p = OUT / "scene.glb"
    sc.export(p)
    info = {
        "konu": "Luxembourg kose apartmani — dis kabuk (referans fotograflardan)",
        "dugum": len(sc.geometry),
        "ucgen": int(tri),
        "boyut_mb": round(p.stat().st_size / 1048576, 2),
        "bina": {"genislik": W, "derinlik": D, "kat": "tas zemin + 2 siva + cati",
                 "sacak_kotu": round(EAVE, 2), "cati_tepe": round(EAVE + 0.52 + ROOF_H, 2)},
        "sinirlar": [[round(float(v), 2) for v in sc.bounds[0]],
                     [round(float(v), 2) for v in sc.bounds[1]]],
        "gruplar": sorted({k.split("__")[0] for k in sc.geometry}),
        "malzemeler": sorted({k.split("__")[1] for k in sc.geometry}),
    }
    (OUT / "scene-info.json").write_text(json.dumps(info, ensure_ascii=False, indent=1))
    print(json.dumps({k: info[k] for k in ("dugum", "ucgen", "boyut_mb", "bina", "sinirlar")},
                     ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
