#!/usr/bin/env python3
"""
Kose parseli sahnesi — prosedurel 3B model, GLB cikisi.

Sahne: iki caddenin kesistigi kose; icteki adada mansart catili apartmanlar,
cevrede kaldirimlar, agaclar, park etmis araclar, yaya gecitleri, bisiklet
seridi, sokak mobilyasi. Diorama gibi kalin bir kaide uzerinde durur.

Koordinat: X sag, Z on (guney), Y yukari. 1 birim = 1 metre. glTF Y-up.

Cikti: scene.glb  (malzemeye ve gruba gore birlestirilmis, adlandirilmis dugumler)
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
import trimesh
from shapely.geometry import Polygon
from trimesh.transformations import rotation_matrix, translation_matrix

OUT = Path(__file__).resolve().parent.parent

# --------------------------------------------------------------------------
# malzemeler:  ad -> (renk hex, metallic, roughness)
# --------------------------------------------------------------------------
MATS = {
    "duvar_krem":     ("#E3D6BC", 0.0, 0.9),
    "duvar_bej":      ("#D2BE97", 0.0, 0.9),
    "duvar_beyaz":    ("#EAE5D9", 0.0, 0.9),
    "duvar_gri":      ("#C4BDB0", 0.0, 0.9),
    "plint_tas":      ("#A59E92", 0.0, 0.9),
    "cati_arduvaz":   ("#333940", 0.0, 0.85),
    "cati_koyu":      ("#272C32", 0.0, 0.8),
    "saceg":          ("#DDD8CB", 0.0, 0.88),
    "cam":            ("#10141A", 0.0, 0.12),
    "cerceve":        ("#E9E7DF", 0.0, 0.65),
    "panjur":         ("#2A2E34", 0.0, 0.6),
    "metal_koyu":     ("#2B2F35", 0.6, 0.4),
    "metal_acik":     ("#9AA0A8", 0.7, 0.35),
    "kapi":           ("#3B342C", 0.0, 0.5),
    "asfalt":         ("#34383E", 0.0, 0.97),
    "asfalt_acik":    ("#3D434A", 0.0, 0.95),
    "kaldirim":       ("#A39D92", 0.0, 0.93),
    "kaldirim_koyu":  ("#948F86", 0.0, 0.92),
    "bisiklet_serit":  ("#8C4E42", 0.0, 0.9),
    "cizgi_beyaz":    ("#EFEFEC", 0.0, 0.7),
    "bordur":         ("#9C978E", 0.0, 0.9),
    "cim":            ("#5E7C48", 0.0, 0.95),
    "yaprak":         ("#456B32", 0.0, 0.95),
    "yaprak_koyu":    ("#365828", 0.0, 0.95),
    "govde":          ("#5B4A3C", 0.0, 0.9),
    "cit":            ("#3F6133", 0.0, 0.95),
    "arac_siyah":     ("#191C21", 0.35, 0.25),
    "arac_gri":       ("#6E747C", 0.4, 0.28),
    "arac_beyaz":     ("#DCDCDA", 0.3, 0.3),
    "arac_kirmizi":   ("#8E2320", 0.35, 0.28),
    "arac_lacivert":  ("#1E2B44", 0.35, 0.28),
    "arac_cam":       ("#1B2026", 0.1, 0.12),
    "lastik":         ("#15171A", 0.0, 0.85),
    "kaide":          ("#2C3035", 0.0, 0.85),
    "tabela_mavi":    ("#20489B", 0.0, 0.5),
    "tabela_beyaz":   ("#EDEDEA", 0.0, 0.5),
}


def hexf(h):
    h = h.lstrip("#")
    return [int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4)]


class Builder:
    """Parcalari (grup, malzeme) cifti altinda toplar, sonunda birlestirir."""

    def __init__(self):
        self.parts = {}
        self.group = "sahne"

    def g(self, name):
        self.group = name
        return self

    def add(self, mesh, mat, group=None):
        if mesh is None:
            return
        key = (group or self.group, mat)
        self.parts.setdefault(key, []).append(mesh)

    def scene(self):
        sc = trimesh.Scene()
        tri = 0
        for (grp, mat), meshes in sorted(self.parts.items()):
            m = trimesh.util.concatenate(meshes)
            col, metal, rough = MATS[mat]
            m.visual = trimesh.visual.TextureVisuals(
                material=trimesh.visual.material.PBRMaterial(
                    name=mat,
                    baseColorFactor=hexf(col) + [1.0],
                    metallicFactor=metal,
                    roughnessFactor=rough,
                    doubleSided=True))
            tri += len(m.faces)
            sc.add_geometry(m, geom_name=f"{grp}__{mat}", node_name=f"{grp}__{mat}")
        return sc, tri


B = Builder()

# --------------------------------------------------------------------------
# ilkel yardimcilar
# --------------------------------------------------------------------------
def _xz(p):
    """(x,z) veya (x,y,z) kabul eder."""
    return (p[0], p[1]) if len(p) == 2 else (p[0], p[2])


def bx(size, pos, ry=0.0, rx=0.0, rz=0.0):
    m = trimesh.creation.box(extents=size)
    if rx: m.apply_transform(rotation_matrix(rx, [1, 0, 0]))
    if rz: m.apply_transform(rotation_matrix(rz, [0, 0, 1]))
    if ry: m.apply_transform(rotation_matrix(ry, [0, 1, 0]))
    m.apply_translation(pos)
    return m


def cyl(r, h, pos, axis="y", sections=16, ry=0.0):
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
    """XZ duzlemindeki cokgeni Y ekseninde katilastirir.

    shapely (a,b) -> ekstruzyon +Z -> X ekseninde -90 donus sonucu (a, t, -b)
    olur; bu yuzden cokgen (x, -z) olarak kurulur ki sonucta z korunsun.
    """
    p = Polygon([(x, -z) for x, z in poly_xz])
    if not p.is_valid:
        p = p.buffer(0)
    m = trimesh.creation.extrude_polygon(p, y1 - y0)
    m.apply_transform(rotation_matrix(-math.pi / 2, [1, 0, 0]))
    m.apply_translation([0, y0, 0])
    return m


def _ccw(poly):
    """Ayak izini saat yonunun tersine cevirir (ic taraf solda kalir)."""
    a = 0.0
    n = len(poly)
    for i in range(n):
        x0, z0 = poly[i]; x1, z1 = poly[(i + 1) % n]
        a += x0 * z1 - x1 * z0
    return list(poly) if a > 0 else list(reversed(poly))


def _edge_normals(poly):
    """Her kenarin ice bakan birim normali (CCW ayak izi icin sol normal)."""
    n = len(poly)
    out = []
    for i in range(n):
        x0, z0 = poly[i]; x1, z1 = poly[(i + 1) % n]
        dx, dz = x1 - x0, z1 - z0
        L = math.hypot(dx, dz) or 1.0
        out.append((-dz / L, dx / L))
    return out


def ring_of(poly, inset):
    """Miter ice-ofset: kose sayisi korunur, sirasi birebir ayni kalir.

    Negatif deger disa ofset verir. Kendini kesen sonuc olusursa None doner.
    """
    poly = _ccw(poly)
    n = len(poly)
    nb = _edge_normals(poly)
    out = []
    for i in range(n):
        n2 = nb[i]                    # i -> i+1 kenari
        n1 = nb[(i - 1) % n]          # i-1 -> i kenari
        dot = n1[0] * n2[0] + n1[1] * n2[1]
        k = 1.0 + dot
        if k < 0.05:                  # cok keskin kose
            return None
        px = poly[i][0] + inset * (n1[0] + n2[0]) / k
        pz = poly[i][1] + inset * (n1[1] + n2[1]) / k
        out.append((px, pz))
    if inset > 0:
        q = Polygon(out)
        if not q.is_valid or q.area < 0.6:
            return None
    return out


def band(outer, inner, y0, y1):
    """Iki halka arasini yan yuzeylerle kapatir (cati egimi). Koseler birebir eslesir."""
    if inner is None or len(inner) != len(outer):
        return None
    o, i = _ccw(outer), inner
    V, F = [], []
    n = len(o)
    for k in range(n):
        k2 = (k + 1) % n
        base = len(V)
        V += [[o[k][0], y0, o[k][1]], [o[k2][0], y0, o[k2][1]],
              [i[k2][0], y1, i[k2][1]], [i[k][0], y1, i[k][1]]]
        F += [[base, base + 2, base + 1], [base, base + 3, base + 2]]
    m = trimesh.Trimesh(vertices=np.array(V, dtype=np.float64),
                        faces=np.array(F), process=False)
    return m, list(i)


def cap(poly, y):
    m = prism(poly, y - 0.06, y)
    return m


# --------------------------------------------------------------------------
# yapi parcalari
# --------------------------------------------------------------------------
def window(pos, ry, w=1.15, h=1.65, glass="cam", frame="cerceve", grp=None, shutter=False):
    """Koyu cam + cevresinde ince cerceve cubuklari + denizlik.

    Cerceve dolu kutu degil, dort ince cubuk: cam gercekten gorunur.
    """
    nx, nz = math.sin(ry), math.cos(ry)
    fx, fz = nx * 0.03, nz * 0.03
    # cam paneli (duvardan hafif disari)
    B.add(bx((w, h, 0.05), pos, ry), glass, grp)
    # cerceve cubuklari
    t = 0.10
    B.add(bx((w + 2 * t, t, 0.10), (pos[0] + fx, pos[1] + h / 2 + t / 2, pos[2] + fz), ry), frame, grp)
    B.add(bx((w + 2 * t, t, 0.10), (pos[0] + fx, pos[1] - h / 2 - t / 2, pos[2] + fz), ry), frame, grp)
    for sgn in (-1, 1):
        dx = math.cos(ry) * sgn * (w / 2 + t / 2)
        dz = -math.sin(ry) * sgn * (w / 2 + t / 2)
        B.add(bx((t, h + 2 * t, 0.10), (pos[0] + dx + fx, pos[1], pos[2] + dz + fz), ry), frame, grp)
    # orta dikme
    B.add(bx((0.07, h, 0.08), (pos[0] + fx, pos[1], pos[2] + fz), ry), frame, grp)
    # denizlik
    B.add(bx((w + 0.38, 0.09, 0.24), (pos[0] + nx * 0.07, pos[1] - h / 2 - t - 0.05, pos[2] + nz * 0.07), ry),
          "plint_tas", grp)
    if shutter:
        B.add(bx((w + 0.3, 0.22, 0.16), (pos[0] + fx, pos[1] + h / 2 + 0.26, pos[2] + fz), ry), "panjur", grp)


def railing(pos, ry, w, h=1.02, bars=None, grp=None):
    """Metal korkuluk: alt-ust ray + dikey cubuklar."""
    B.add(bx((w, 0.06, 0.05), (pos[0], pos[1] + h, pos[2]), ry), "metal_koyu", grp)
    B.add(bx((w, 0.04, 0.04), (pos[0], pos[1] + h * 0.45, pos[2]), ry), "metal_koyu", grp)
    n = bars if bars else max(3, int(w / 0.22))
    for k in range(n):
        t = (k + 0.5) / n - 0.5
        dx, dz = math.cos(ry) * t * w, -math.sin(ry) * t * w
        B.add(bx((0.035, h, 0.035), (pos[0] + dx, pos[1] + h / 2, pos[2] + dz), ry), "metal_koyu", grp)


def balcony(pos, ry, w=2.6, d=1.1, grp=None):
    nx, nz = math.sin(ry), math.cos(ry)
    cx, cz = pos[0] + nx * d / 2, pos[2] + nz * d / 2
    B.add(bx((w, 0.14, d), (cx, pos[1], cz), ry), "saceg", grp)
    railing((cx + nx * d / 2, pos[1] + 0.07, cz + nz * d / 2), ry, w, grp=grp)
    railing((cx - nx * d / 2 * 0 + math.cos(ry) * w / 2, pos[1] + 0.07, cz - math.sin(ry) * w / 2 * -1),
            ry + math.pi / 2, d, grp=grp)
    railing((cx - math.cos(ry) * w / 2, pos[1] + 0.07, cz + math.sin(ry) * w / 2),
            ry + math.pi / 2, d, grp=grp)


def dormer(pos, ry, w=1.9, h=1.5, d=1.5, grp=None):
    """Cati penceresi kutusu + mini kirma cati."""
    nx, nz = math.sin(ry), math.cos(ry)
    B.add(bx((w, h, d), pos, ry), "duvar_gri", grp)
    top = pos[1] + h / 2
    B.add(bx((w + 0.22, 0.12, d + 0.16), (pos[0], top + 0.06, pos[2]), ry), "cati_koyu", grp)
    B.add(bx((w * 0.62, 0.5, d * 0.72), (pos[0], top + 0.34, pos[2]), ry), "cati_arduvaz", grp)
    window((pos[0] + nx * (d / 2 - 0.02), pos[1] + 0.03, pos[2] + nz * (d / 2 - 0.02)),
           ry, w=w - 0.5, h=h - 0.45, grp=grp)


def skylight(pos, ry, tilt, w=0.9, h=1.1, grp=None):
    m = trimesh.creation.box(extents=(w, 0.12, h))
    m.apply_transform(rotation_matrix(tilt, [1, 0, 0]))
    m.apply_transform(rotation_matrix(ry, [0, 1, 0]))
    m.apply_translation(pos)
    B.add(m, "cam", grp)


def chimney(pos, h=1.6, w=0.8, d=1.1, pipes=3, grp=None):
    B.add(bx((w, h, d), (pos[0], pos[1] + h / 2, pos[2])), "duvar_gri", grp)
    B.add(bx((w + 0.16, 0.12, d + 0.16), (pos[0], pos[1] + h + 0.06, pos[2])), "kaldirim_koyu", grp)
    for k in range(pipes):
        t = (k + 0.5) / pipes - 0.5
        B.add(cyl(0.07, 0.34, (pos[0], pos[1] + h + 0.24, pos[2] + t * d * 0.7)), "metal_acik", grp)


def steps(pos, ry, w=2.4, n=4, rise=0.17, run=0.32, grp=None):
    nx, nz = math.sin(ry), math.cos(ry)
    for k in range(n):
        y = (k + 0.5) * rise
        off = (n - k - 0.5) * run
        B.add(bx((w, rise, run * (k + 1)),
                 (pos[0] + nx * (off - run * k / 2), y, pos[2] + nz * (off - run * k / 2)), ry),
              "plint_tas", grp)


def hedge(p0, p1, h=0.75, w=0.7, grp=None):
    x0, z0 = p0; x1, z1 = p1
    L = math.hypot(x1 - x0, z1 - z0)
    ry = math.atan2(x1 - x0, z1 - z0)
    B.add(bx((w, h, L), ((x0 + x1) / 2, h / 2, (z0 + z1) / 2), ry), "cit", grp)


def low_wall(p0, p1, h=0.62, w=0.42, grp=None, mat="plint_tas"):
    x0, z0 = p0; x1, z1 = p1
    L = math.hypot(x1 - x0, z1 - z0)
    ry = math.atan2(x1 - x0, z1 - z0)
    B.add(bx((w, h, L), ((x0 + x1) / 2, h / 2, (z0 + z1) / 2), ry), mat, grp)
    B.add(bx((w + 0.1, 0.07, L), ((x0 + x1) / 2, h + 0.035, (z0 + z1) / 2), ry), "kaldirim_koyu", grp)


def tree(pos, h=6.0, r=2.0, grp="agaclar", dark=False):
    px, pz = _xz(pos)
    B.add(cyl(0.17 + h * 0.012, h * 0.55, (px, h * 0.275, pz), sections=8), "govde", grp)
    mat = "yaprak_koyu" if dark else "yaprak"
    B.add(sph(r, (px, h * 0.72, pz), 2, (1.0, 0.85, 1.0)), mat, grp)
    B.add(sph(r * 0.72, (px + r * 0.45, h * 0.55, pz + r * 0.3), 1), mat, grp)
    B.add(sph(r * 0.66, (px - r * 0.42, h * 0.58, pz - r * 0.32), 1), mat, grp)
    B.add(sph(r * 0.6, (px + r * 0.2, h * 0.92, pz - r * 0.35), 1), mat, grp)


def bush(pos, r=0.75, grp="bahce"):
    px, pz = _xz(pos)
    B.add(sph(r, (px, r * 0.75, pz), 1, (1.0, 0.8, 1.0)), "cit", grp)


def car(pos, ry, color="arac_siyah", grp="araclar"):
    px, pz = _xz(pos)
    L, W = 4.35, 1.82
    B.add(bx((L, 0.42, W), (px, 0.52, pz), ry), color, grp)
    B.add(bx((L - 0.25, 0.34, W - 0.06), (px, 0.86, pz), ry), color, grp)
    cx = -0.15 * math.cos(ry)
    cz = 0.15 * math.sin(ry)
    B.add(bx((L * 0.5, 0.5, W - 0.16), (px + cx, 1.22, pz + cz), ry), color, grp)
    B.add(bx((L * 0.46, 0.36, W - 0.10), (px + cx, 1.24, pz + cz), ry), "arac_cam", grp)
    B.add(bx((L * 0.52, 0.06, W - 0.12), (px + cx, 1.46, pz + cz), ry), color, grp)
    for sx in (-1, 1):
        for sz in (-1, 1):
            dx = math.cos(ry) * sx * L * 0.33 - math.sin(ry) * sz * (W / 2 - 0.06)
            dz = -math.sin(ry) * sx * L * 0.33 - math.cos(ry) * sz * (W / 2 - 0.06)
            B.add(cyl(0.33, 0.22, (px + dx, 0.33, pz + dz), axis="x", sections=12, ry=ry),
                  "lastik", grp)
    for sz in (-1, 1):
        dx = math.cos(ry) * L * 0.49 - math.sin(ry) * sz * W * 0.3
        dz = -math.sin(ry) * L * 0.49 - math.cos(ry) * sz * W * 0.3
        B.add(bx((0.08, 0.16, 0.42), (px + dx, 0.66, pz + dz), ry), "tabela_beyaz", grp)


def lamp(pos, ry=0.0, grp="mobilya"):
    px, pz = _xz(pos)
    B.add(cyl(0.14, 0.25, (px, 0.12, pz), sections=10), "metal_koyu", grp)
    B.add(cyl(0.075, 5.4, (px, 2.7, pz), sections=10), "metal_acik", grp)
    B.add(bx((1.1, 0.09, 0.09), (px + math.sin(ry) * 0.5, 5.36, pz + math.cos(ry) * 0.5), ry + math.pi / 2),
          "metal_acik", grp)
    B.add(bx((0.5, 0.16, 0.3), (px + math.sin(ry) * 1.0, 5.24, pz + math.cos(ry) * 1.0), ry),
          "metal_koyu", grp)


def sign(pos, ry, kind="mavi", grp="mobilya"):
    px, pz = _xz(pos)
    B.add(cyl(0.05, 2.5, (px, 1.25, pz), sections=8), "metal_acik", grp)
    if kind == "mavi":
        B.add(cyl(0.34, 0.05, (px, 2.35, pz), axis="x", sections=20, ry=ry), "tabela_mavi", grp)
    else:
        B.add(bx((0.62, 0.62, 0.05), (px, 2.35, pz), ry), "tabela_beyaz", grp)
        B.add(bx((0.52, 0.52, 0.02), (px + math.sin(ry) * 0.04, 2.35, pz + math.cos(ry) * 0.04), ry),
              "tabela_mavi", grp)


def bollard(pos, grp="mobilya"):
    px, pz = _xz(pos)
    B.add(cyl(0.08, 0.95, (px, 0.47, pz), sections=8), "metal_koyu", grp)
    B.add(sph(0.09, (px, 0.96, pz), 1), "metal_koyu", grp)


# --------------------------------------------------------------------------
# apartman ureteci
# --------------------------------------------------------------------------
def apartment(name, foot, floors=4, fh=3.1, base=0.0, wall="duvar_krem",
              roof="mansart", roof_h=4.6, facades=None, plinth=1.1,
              dormers=(), chimneys=(), entrance=None, balconies=(), skylights=()):
    """
    foot     : (x,z) kose listesi (saat yonunun tersi)
    facades  : {kenar_indeksi: dict(bays=n, balcony=[kat..], shutter=bool)}
    """
    grp = name
    foot = _ccw(foot)
    wall_h = floors * fh
    top = base + wall_h

    # govde
    B.add(prism(foot, base, top), wall, grp)
    # tas soklu (zemin bandi)
    big = ring_of(foot, -0.06)
    if big:
        B.add(prism(big, base, base + plinth), "plint_tas", grp)
    # sacak
    eave = ring_of(foot, -0.42)
    if eave:
        B.add(prism(eave, top - 0.28, top + 0.14), "saceg", grp)

    # cati: mansart (dik alt + yatik ust) veya kirma
    r1 = ring_of(foot, 1.55)
    slope_angle = math.atan2(roof_h * 0.62, 1.55)
    if r1:
        res = band(foot, r1, top + 0.14, top + roof_h * 0.62)
        if res:
            m, r1o = res
            B.add(m, "cati_arduvaz", grp)
            if roof == "mansart":
                r2 = ring_of(r1o, 2.6)
                res2 = band(r1o, r2, top + roof_h * 0.62, top + roof_h) if r2 else None
                if res2:
                    m2, r2o = res2
                    B.add(m2, "cati_arduvaz", grp)
                    B.add(cap(r2o, top + roof_h + 0.02), "cati_koyu", grp)
                    rr = ring_of(r2o, -0.12)
                    if rr:
                        B.add(prism(rr, top + roof_h + 0.01, top + roof_h + 0.1), "cati_koyu", grp)
                else:
                    B.add(cap(r1o, top + roof_h * 0.62 + 0.02), "cati_koyu", grp)
            else:
                B.add(cap(r1o, top + roof_h * 0.62 + 0.02), "cati_koyu", grp)
    else:
        B.add(prism(foot, top + 0.14, top + roof_h * 0.5), "cati_arduvaz", grp)

    # cepheler: pencere/balkon dizilimi
    n = len(foot)
    for i in range(n):
        x0, z0 = foot[i]
        x1, z1 = foot[(i + 1) % n]
        L = math.hypot(x1 - x0, z1 - z0)
        if L < 2.2:
            continue
        cfg = (facades or {}).get(i, {})
        if cfg.get("blank"):
            continue
        L2 = math.hypot(x1 - x0, z1 - z0) or 1.0
        ry = math.atan2((z1 - z0) / L2, -(x1 - x0) / L2)     # disa bakan normalin acisi
        nx, nz = math.sin(ry), math.cos(ry)
        bays = cfg.get("bays", max(1, int(round(L / 2.7))))
        bal_floors = set(cfg.get("balcony", []))
        bal_bays = set(cfg.get("balcony_bays", range(bays)))
        for f in range(floors):
            y = base + f * fh + fh * 0.55
            for bcol in range(bays):
                t = (bcol + 0.5) / bays - 0.5
                px = (x0 + x1) / 2 + (x1 - x0) * t + nx * 0.06
                pz = (z0 + z1) / 2 + (z1 - z0) * t + nz * 0.06
                if entrance and i == entrance.get("face") and f == 0 and bcol == entrance.get("bay", 0):
                    continue
                if f in bal_floors and bcol in bal_bays and L / bays > 2.2:
                    window((px, y, pz), ry, w=min(1.55, L / bays * 0.55), h=2.1,
                           grp=grp, shutter=cfg.get("shutter", False))
                    balcony((px, base + f * fh + 0.12, pz), ry, w=min(2.9, L / bays * 0.85), grp=grp)
                else:
                    window((px, y, pz), ry, w=min(1.45, L / bays * 0.52), h=1.85,
                           grp=grp, shutter=cfg.get("shutter", False))

    # giris
    if entrance is not None:
        i = entrance["face"]
        x0, z0 = foot[i]; x1, z1 = foot[(i + 1) % n]
        L = math.hypot(x1 - x0, z1 - z0)
        L2 = math.hypot(x1 - x0, z1 - z0) or 1.0
        ry = math.atan2((z1 - z0) / L2, -(x1 - x0) / L2)
        nx, nz = math.sin(ry), math.cos(ry)
        bays = (facades or {}).get(i, {}).get("bays", max(1, int(L / 3.1)))
        t = (entrance.get("bay", 0) + 0.5) / bays - 0.5
        px = (x0 + x1) / 2 + (x1 - x0) * t + nx * 0.05
        pz = (z0 + z1) / 2 + (z1 - z0) * t + nz * 0.05
        B.add(bx((1.9, 2.5, 0.16), (px, base + 1.25, pz), ry), "kapi", grp)
        B.add(bx((2.15, 0.2, 0.55), (px + nx * 0.25, base + 2.62, pz + nz * 0.25), ry), "saceg", grp)
        steps((px + nx * 0.12, base, pz + nz * 0.12), ry, w=2.3, n=int(max(2, base / 0.17)) if base else 3, grp=grp)

    # cati pencereleri / bacalar — (kenar, oran) ile egim uzerine oturtulur
    def on_slope(face, t, frac):
        x0, z0 = foot[face % n]; x1, z1 = foot[(face + 1) % n]
        L2 = math.hypot(x1 - x0, z1 - z0) or 1.0
        ry = math.atan2((z1 - z0) / L2, -(x1 - x0) / L2)
        nx, nz = math.sin(ry), math.cos(ry)
        inset = 1.55 * frac
        px = x0 + (x1 - x0) * t - nx * inset
        pz = z0 + (z1 - z0) * t - nz * inset
        return px, pz, ry

    for face, t in dormers:
        px, pz, ry = on_slope(face, t, 0.42)
        dormer((px, top + roof_h * 0.30, pz), ry, grp=grp)
    for face, t in skylights:
        px, pz, ry = on_slope(face, t, 0.62)
        skylight((px, top + roof_h * 0.42, pz), ry, slope_angle, grp=grp)
    for c in chimneys:
        chimney((c[0], top + roof_h * 0.52, c[1]), h=2.2, grp=grp)


# ==========================================================================
# SAHNE
# ==========================================================================
SX0, SX1 = -46.0, 46.0        # kaide sinirlari
SZ0, SZ1 = -32.0, 36.0
ROAD_A = (22.0, 31.0)         # on cadde (X boyunca), z araligi
ROAD_B = (26.0, 35.0)         # sag cadde (Z boyunca), x araligi
SW = 0.16                     # kaldirim yuksekligi


def ground():
    g = "zemin"
    # kaide
    B.add(bx((SX1 - SX0, 1.7, SZ1 - SZ0), ((SX0 + SX1) / 2, -0.85, (SZ0 + SZ1) / 2)), "kaide", g)
    # taban zemin (kaldirim tonunda)
    B.add(bx((SX1 - SX0, 0.16, SZ1 - SZ0), ((SX0 + SX1) / 2, 0.08, (SZ0 + SZ1) / 2)), "kaldirim", g)

    # asfalt
    B.add(bx((SX1 - SX0, 0.17, ROAD_A[1] - ROAD_A[0]),
             ((SX0 + SX1) / 2, 0.085, sum(ROAD_A) / 2)), "asfalt", g)
    B.add(bx((ROAD_B[1] - ROAD_B[0], 0.17, SZ1 - SZ0),
             (sum(ROAD_B) / 2, 0.086, (SZ0 + SZ1) / 2)), "asfalt", g)

    # bordurler (kaldirim kenarlari)
    for z in (ROAD_A[0], ROAD_A[1]):
        B.add(bx((SX1 - SX0, SW + 0.06, 0.3), ((SX0 + SX1) / 2, (SW + 0.06) / 2, z)), "bordur", g)
    for x in (ROAD_B[0], ROAD_B[1]):
        B.add(bx((0.3, SW + 0.06, SZ1 - SZ0), (x, (SW + 0.06) / 2, (SZ0 + SZ1) / 2)), "bordur", g)

    # bisiklet seridi (sag caddenin dogu seridi)
    B.add(bx((1.7, 0.02, SZ1 - SZ0), (ROAD_B[1] - 0.9, 0.175, (SZ0 + SZ1) / 2)), "bisiklet_serit", g)
    # kaldirim uzerinde kirmizi bisiklet gecisi bandi
    B.add(bx((ROAD_B[1] - ROAD_B[0], 0.02, 1.6), (sum(ROAD_B) / 2, 0.176, ROAD_A[0] - 2.4)), "bisiklet_serit", g)

    # yaya gecitleri
    for k in range(7):                                  # on caddeyi kesen gecit
        B.add(bx((0.62, 0.02, ROAD_A[1] - ROAD_A[0] - 0.4),
                 (2.0 + k * 1.25, 0.176, sum(ROAD_A) / 2)), "cizgi_beyaz", g)
    for k in range(5):                                  # sag caddeyi kesen gecit
        B.add(bx((ROAD_B[1] - ROAD_B[0] - 0.4, 0.02, 0.62),
                 (sum(ROAD_B) / 2, 0.176, 31.9 + k * 0.95)), "cizgi_beyaz", g)
    # gecit uyari isaretleri (ucgen yerine kucuk kare bloklar)
    for x in (-1.2, 11.5):
        B.add(bx((0.9, 0.02, 0.9), (x, 0.176, ROAD_A[0] + 1.6), math.pi / 4), "cizgi_beyaz", g)
    # yol ok isareti
    B.add(bx((0.5, 0.02, 2.6), (ROAD_B[0] + 2.2, 0.176, 24.5)), "cizgi_beyaz", g)
    for k, w in enumerate((1.3, 0.95, 0.6)):
        B.add(bx((w, 0.02, 0.42), (ROAD_B[0] + 2.2, 0.176, 23.0 + k * 0.42)), "cizgi_beyaz", g)
    # orta seritler (kesikli)
    for k in range(16):
        B.add(bx((2.2, 0.02, 0.16), (SX0 + 3 + k * 5.6, 0.176, sum(ROAD_A) / 2)), "cizgi_beyaz", g)

    # kaldirimlar
    def pav(x0, x1, z0, z1, mat="kaldirim"):
        B.add(bx((x1 - x0, SW, z1 - z0), ((x0 + x1) / 2, SW / 2 + 0.08, (z0 + z1) / 2)), mat, g)

    pav(SX0, ROAD_B[0], ROAD_A[0] - 4.5, ROAD_A[0])          # on caddenin kuzey kaldirimi
    pav(SX0, SX1, ROAD_A[1], ROAD_A[1] + 4.5)                # guney kaldirim
    pav(ROAD_B[0] - 4.5, ROAD_B[0], SZ0, ROAD_A[0])          # sag caddenin bati kaldirimi
    pav(ROAD_B[1], ROAD_B[1] + 4.5, SZ0, SZ1)                # dogu kaldirim
    pav(ROAD_B[0] - 4.5, ROAD_B[0], ROAD_A[1], SZ1)
    # kose meydanciklari (koyu tonda tas dokusu izlenimi)
    pav(ROAD_B[0] - 12, ROAD_B[0] - 4.5, ROAD_A[0] - 4.5, ROAD_A[0], "kaldirim_koyu")
    pav(ROAD_B[0] - 4.5, ROAD_B[0], ROAD_A[0] - 12, ROAD_A[0] - 4.5, "kaldirim_koyu")

    # rogar kapaklari
    for p in ((6.0, 24.0), (ROAD_B[0] + 3.0, 30.0), (-14.0, 27.0)):
        B.add(cyl(0.36, 0.03, (p[0], 0.18, p[1]), sections=14), "metal_koyu", g)

    # cim / bahce alanlari (bloklarin arasi)
    for (x0, x1, z0, z1) in ((-40, -34, 2, 14), (-12, -6, -2, 2), (2, 18, -2, 3), (22, 24, -20, -6)):
        B.add(bx((x1 - x0, 0.06, z1 - z0), ((x0 + x1) / 2, 0.13, (z0 + z1) / 2)), "cim", g)


def buildings():
    # --- kose apartmani (kahraman bina, guneydogu kosesi pahli) ---
    hero = [(4.0, 3.0), (20.5, 3.0), (20.5, 15.0), (17.6, 18.4), (4.0, 18.4)]
    apartment("bina_kose", hero, floors=4, fh=3.15, wall="duvar_krem", roof_h=4.8,
              facades={
                  0: dict(bays=5, blank=True),
                  1: dict(bays=4, balcony=[1, 2, 3], balcony_bays=[1, 2]),
                  2: dict(bays=1),
                  3: dict(bays=5, balcony=[1, 2, 3], balcony_bays=[3]),
                  4: dict(bays=4),
              },
              entrance=dict(face=3, bay=1),
              dormers=[(0, 0.22), (0, 0.5), (0, 0.78), (1, 0.3), (1, 0.7),
                       (3, 0.25), (3, 0.55), (3, 0.8)],
              chimneys=[(6.0, 10.5), (18.0, 6.0), (12.5, 13.0)],
              skylights=[(0, 0.35), (0, 0.65), (1, 0.5), (3, 0.4)])

    # --- orta apartman ---
    mid = [(-13.5, 2.0), (2.0, 2.0), (2.0, 17.2), (-13.5, 17.2)]
    apartment("bina_orta", mid, floors=4, fh=3.1, wall="duvar_bej", roof_h=4.4,
              facades={0: dict(bays=5, blank=True),
                       1: dict(bays=5, balcony=[1, 2, 3], balcony_bays=[3]),
                       2: dict(bays=5, balcony=[2, 3], balcony_bays=[1, 3]),
                       3: dict(bays=5)},
              entrance=dict(face=2, bay=2),
              dormers=[(0, 0.25), (0, 0.5), (0, 0.75), (2, 0.3), (2, 0.7)],
              chimneys=[(-12.0, 9.0), (0.5, 6.0)],
              skylights=[(0, 0.38), (0, 0.62), (2, 0.5)])

    # --- sol apartman (kanatli) ---
    left = [(-33.0, 1.0), (-15.5, 1.0), (-15.5, 14.0), (-24.0, 14.0), (-24.0, 17.6), (-33.0, 17.6)]
    apartment("bina_sol", left, floors=4, fh=3.05, wall="duvar_beyaz", roof_h=4.2,
              facades={0: dict(bays=5, blank=True), 1: dict(bays=4, balcony=[1, 2, 3], balcony_bays=[2]),
                       2: dict(bays=3), 3: dict(bays=1), 4: dict(bays=3), 5: dict(bays=4)},
              entrance=dict(face=2, bay=1),
              dormers=[(0, 0.3), (0, 0.7), (5, 0.5), (1, 0.4)],
              chimneys=[(-31.0, 8.0), (-17.5, 5.0)],
              skylights=[(0, 0.5), (5, 0.3)])

    # --- arka sira: krem blok ---
    apartment("bina_arka_sol", [(-25.0, -15.0), (-9.0, -15.0), (-9.0, -2.0), (-25.0, -2.0)],
              floors=5, fh=3.0, wall="duvar_bej", roof="kirma", roof_h=3.2,
              facades={0: dict(bays=5), 1: dict(bays=4), 2: dict(bays=5), 3: dict(bays=4)},
              chimneys=[(-22.0, -8.0), (-12.0, -8.0)])

    apartment("bina_arka_orta", [(-5.5, -17.0), (8.5, -17.0), (8.5, -4.0), (-5.5, -4.0)],
              floors=5, fh=3.0, wall="duvar_krem", roof="kirma", roof_h=3.4,
              facades={0: dict(bays=4), 1: dict(bays=4), 2: dict(bays=4), 3: dict(bays=4)},
              chimneys=[(-2.0, -10.0), (5.0, -10.0)])

    # --- caddenin karsisi (sag) ---
    apartment("bina_sag", [(40.0, -6.0), (SX1, -6.0), (SX1, 12.0), (40.0, 12.0)],
              floors=5, fh=3.05, wall="duvar_beyaz", roof_h=4.0,
              facades={0: dict(bays=2), 1: dict(bays=5, blank=True), 2: dict(bays=2),
                       3: dict(bays=5, balcony=[1, 2, 3], balcony_bays=[1, 3])},
              entrance=dict(face=3, bay=0),
              dormers=[(3, 0.3), (3, 0.7), (0, 0.5)],
              chimneys=[(43.0, 2.0)])

    # --- diorama kenarinda kesilmis evler ---
    apartment("ev_on_sol", [(SX0, 31.5), (-31.0, 31.5), (-31.0, SZ1), (SX0, SZ1)],
              floors=2, fh=3.0, wall="duvar_beyaz", roof_h=3.0,
              facades={0: dict(bays=4), 1: dict(bays=2), 2: dict(bays=4, blank=True), 3: dict(bays=2)},
              dormers=[(0, 0.35), (0, 0.7)], chimneys=[(-35.0, 34.0)])

    apartment("ev_on_sag", [(39.5, 31.5), (SX1, 31.5), (SX1, SZ1), (39.5, SZ1)],
              floors=2, fh=3.0, wall="duvar_bej", roof_h=2.8,
              facades={0: dict(bays=2), 1: dict(bays=2), 2: dict(bays=2, blank=True), 3: dict(bays=2)},
              chimneys=[(42.0, 34.0)])

    apartment("ev_bati", [(SX0, 4.0), (-38.0, 4.0), (-38.0, 18.0), (SX0, 18.0)],
              floors=2, fh=3.0, wall="duvar_gri", roof_h=3.2,
              facades={0: dict(bays=2), 1: dict(bays=4), 2: dict(bays=2), 3: dict(bays=4, blank=True)},
              dormers=[(1, 0.35), (1, 0.7)],
              chimneys=[(-42.0, 11.0)])


def gardens():
    g = "bahce"
    # kose binanin onundeki istinat duvarlari + citler
    low_wall((2.5, 19.6), (18.5, 19.6), grp=g)
    hedge((3.0, 20.4), (10.0, 20.4), h=0.85, grp=g)
    hedge((12.5, 20.4), (18.0, 20.4), h=0.85, grp=g)
    low_wall((21.6, 4.0), (21.6, 17.0), grp=g)
    hedge((22.4, 5.0), (22.4, 16.0), h=0.8, grp=g)
    # orta ve sol bina onleri
    low_wall((-14.0, 18.4), (1.0, 18.4), grp=g)
    hedge((-13.0, 19.2), (0.0, 19.2), h=0.7, grp=g)
    low_wall((-33.0, 18.8), (-25.0, 18.8), grp=g)
    hedge((-32.0, 19.5), (-25.5, 19.5), h=0.7, grp=g)
    # cicek tarhlari
    for p in ((6.5, 20.9), (9.0, 20.9), (15.0, 20.9), (-6.0, 19.8), (-28.0, 20.1)):
        bush(p, 0.65, grp=g)
    for p in ((23.4, 8.0), (23.4, 12.0), (23.4, 15.0)):
        bush(p, 0.7, grp=g)
    # arka bahce cim + buyuk agac
    B.add(bx((16.0, 0.06, 9.0), (-1.0, 0.13, -9.0)), "cim", g)
    tree((-0.5, -9.5), h=10.5, r=4.2, dark=True)
    tree((-14.0, -18.0), h=8.0, r=3.0, dark=True)
    tree((13.0, -12.0), h=7.5, r=2.9)


def street_furniture():
    # kaldirim agaclari
    for x in (-42, -35.5, -29, -22.5, -16, -9.5, -3, 3.5, 10, 16.5):
        tree((x, ROAD_A[0] - 2.2), h=5.6, r=1.9)
    for z in (16.0, 9.0, 2.0, -5.0, -12.0, -19.0, -26.0):
        tree((ROAD_B[0] - 2.2, z), h=5.4, r=1.8)
    for z in (14.0, 4.0, -6.0, -16.0, -25.0):
        tree((ROAD_B[1] + 2.2, z), h=5.2, r=1.75)
    for x in (-40, -33, -25, -18, 2, 12, 20, 38, 43):
        tree((x, ROAD_A[1] + 2.4), h=5.0, r=1.7)

    lamp((ROAD_B[0] - 1.4, ROAD_A[0] - 6.5), ry=math.pi)
    lamp((-20.0, ROAD_A[0] - 1.5), ry=math.pi)
    lamp((ROAD_B[1] + 1.4, -10.0), ry=math.pi / 2)

    sign((ROAD_B[1] + 1.2, 27.5), -math.pi / 2, "mavi")
    sign((-24.0, ROAD_A[0] - 1.2), math.pi, "kare")
    sign((ROAD_B[0] - 1.2, 20.0), math.pi, "kare")
    sign((13.0, ROAD_A[1] + 1.4), 0.0, "mavi")

    for k in range(6):
        bollard((16.5 + k * 1.6, ROAD_A[0] - 0.9))
    for k in range(3):
        bollard((ROAD_B[0] - 0.9, 19.5 - k * 1.6))


def cars():
    dark = ["arac_siyah", "arac_gri", "arac_siyah", "arac_lacivert", "arac_beyaz",
            "arac_siyah", "arac_gri", "arac_kirmizi", "arac_beyaz", "arac_siyah"]
    i = 0
    for x in (-41, -36, -31, -24, -19, -8, -3, 6, 11):          # on cadde kuzey seridi
        car((x, ROAD_A[0] + 1.8), 0.0, dark[i % len(dark)]); i += 1
    for x in (-38, -33, 18, 24, 38):                            # guney seridi
        car((x, ROAD_A[1] - 1.8), math.pi, dark[i % len(dark)]); i += 1
    for z in (16, 10, 3, -6, -14, -22):                         # sag cadde bati seridi
        car((ROAD_B[0] + 1.8, z), math.pi / 2, dark[i % len(dark)]); i += 1
    for z in (13, 0, -10, -20):                                 # dogu seridi
        car((ROAD_B[1] - 2.4, z), -math.pi / 2, dark[i % len(dark)]); i += 1


def main():
    ground()
    buildings()
    gardens()
    street_furniture()
    cars()

    sc, tri = B.scene()
    path = OUT / "scene.glb"
    sc.export(path)
    size = path.stat().st_size / 1048576
    bounds = sc.bounds
    info = {
        "dugum": len(sc.geometry),
        "ucgen": int(tri),
        "boyut_mb": round(size, 2),
        "sinirlar": [[round(float(v), 2) for v in bounds[0]], [round(float(v), 2) for v in bounds[1]]],
        "gruplar": sorted({k.split("__")[0] for k in sc.geometry}),
        "malzemeler": sorted({k.split("__")[1] for k in sc.geometry}),
    }
    (OUT / "scene-info.json").write_text(json.dumps(info, ensure_ascii=False, indent=1))
    print(json.dumps(info, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
