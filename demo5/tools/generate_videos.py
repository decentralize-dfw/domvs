#!/usr/bin/env python3
"""
demo5 — agac yapili klip seti uretir.

Yapi (dikey ana aks + her bolume 3 eklenti dali):

    m1 ──f1/r1── m2 ──f2/r2── m3 ── ... ── m7      (7 ana bolum, dikey aks)
     │            │            │
     ├─e11/x11─ b11            ...                  (her bolumde 3 eklenti dali)
     ├─e12/x12─ b12
     └─e13/x13─ b13

Klipler:
  m1..m7      ana dongu           4.0 sn / 120 kare / tam 1 devir
  f1..f6      aks ileri gecisi    2.0 sn /  60 kare
  r1..r6      aks geri gecisi     (f'nin ters kodlanmisi)
  e{k}{b}     dala giris          1.2 sn /  36 kare
  b{k}{b}     dal dongusu         3.0 sn /  90 kare / tam 1 devir
  x{k}{b}     daldan cikis        (e'nin ters kodlanmisi)

Kare sozlesmesi:
  gecis[0]        == kaynak_dongu[0]
  gecis[son] + 1  == hedef_dongu[0]
  ters[son]       == kaynak_dongu[0]
Bu yuzden gecisler birbirine de zincirlenebilir (ara dongu oynatilmadan).
Gecisin faz hizi iki ucta ilgili dongunun hiziyla esitlenir -> konum ve hiz surekli.
"""
import copy
import json
import math
import subprocess
import sys
from pathlib import Path

import numpy as np
import imageio_ffmpeg

W, H = 960, 540
FPS = 30
MAIN_FRAMES   = 120   # 4.0 sn
AXIS_FRAMES   = 60    # 2.0 sn
BRANCH_FRAMES = 75    # 2.5 sn
ENTER_FRAMES  = 36    # 1.2 sn
CRF, WEBM_CRF = "30", "40"
WEBM_W, WEBM_H = 640, 360   # webm yalnizca yedek: daha kucuk cozunurluk

OUT = Path(__file__).resolve().parent.parent / "media"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

ax = np.linspace(-1.6, 1.6, W, dtype=np.float32)
ay = np.linspace(-0.9, 0.9, H, dtype=np.float32)
X0, Y0 = np.meshgrid(ax, ay)
RAD = np.sqrt((X0 / 1.6) ** 2 + (Y0 / 0.9) ** 2)
VIGNETTE = np.clip(1.0 - 0.52 * (RAD ** 2.1), 0.15, 1.0).astype(np.float32)[..., None]

# ------------------------------------------------------------------ 7 ana bolum
SECTIONS = [
    {"name": "OKYANUS", "sub": "derin mavi",
     "stops": [(3, 8, 24), (7, 46, 92), (28, 148, 176), (156, 246, 228)],
     "f": (3.05, 2.35, 1.80), "rot": 0.35, "warp": 1.25,
     "glow": (70, 205, 255), "gmix": 0.30, "fil": 0.55,
     "blobs": [(-0.65, -0.15, 0.45, 0.00, 0.62), (0.70, 0.20, 0.38, 0.33, 0.50),
               (0.05, -0.35, 0.55, 0.66, 0.42)]},
    {"name": "GÜN BATIMI", "sub": "magenta / amber",
     "stops": [(20, 5, 26), (96, 22, 76), (214, 74, 96), (255, 196, 122)],
     "f": (2.15, 3.40, 2.60), "rot": -0.62, "warp": 1.85,
     "glow": (255, 130, 90), "gmix": 0.34, "fil": 0.48,
     "blobs": [(0.55, 0.25, 0.60, 0.12, 0.52), (-0.75, 0.05, 0.30, 0.55, 0.66),
               (-0.10, 0.40, 0.42, 0.80, 0.36)]},
    {"name": "YEŞİM", "sub": "yeşil / altın",
     "stops": [(4, 16, 14), (12, 74, 62), (58, 176, 118), (250, 226, 150)],
     "f": (3.80, 1.70, 3.10), "rot": 0.95, "warp": 0.90,
     "glow": (180, 255, 170), "gmix": 0.28, "fil": 0.60,
     "blobs": [(0.15, -0.30, 0.34, 0.40, 0.70), (-0.55, 0.30, 0.50, 0.05, 0.44),
               (0.80, -0.10, 0.28, 0.72, 0.38)]},
    {"name": "NEBULA", "sub": "mor / indigo",
     "stops": [(10, 6, 28), (52, 26, 110), (140, 72, 200), (240, 186, 255)],
     "f": (2.60, 2.90, 3.60), "rot": -1.25, "warp": 2.15,
     "glow": (170, 120, 255), "gmix": 0.32, "fil": 0.52,
     "blobs": [(-0.30, 0.35, 0.52, 0.25, 0.58), (0.62, -0.28, 0.44, 0.62, 0.48),
               (-0.85, -0.20, 0.36, 0.90, 0.40)]},
    {"name": "BAKIR", "sub": "çöl tonları",
     "stops": [(24, 10, 4), (96, 44, 16), (198, 110, 42), (255, 226, 172)],
     "f": (1.85, 4.10, 2.20), "rot": 1.55, "warp": 1.05,
     "glow": (255, 170, 80), "gmix": 0.30, "fil": 0.64,
     "blobs": [(0.40, 0.40, 0.30, 0.50, 0.64), (-0.60, -0.30, 0.58, 0.18, 0.46),
               (0.90, -0.35, 0.40, 0.84, 0.34)]},
    {"name": "BUZUL", "sub": "buz mavisi",
     "stops": [(6, 14, 24), (30, 70, 110), (120, 180, 220), (242, 250, 255)],
     "f": (4.20, 2.05, 2.85), "rot": -0.20, "warp": 1.45,
     "glow": (200, 235, 255), "gmix": 0.26, "fil": 0.70,
     "blobs": [(-0.20, -0.40, 0.48, 0.08, 0.54), (0.75, 0.30, 0.34, 0.44, 0.60),
               (-0.90, 0.25, 0.42, 0.70, 0.38)]},
    {"name": "GÜL KUARTZ", "sub": "pembe / sedef",
     "stops": [(22, 8, 18), (104, 34, 62), (222, 122, 138), (255, 226, 224)],
     "f": (2.95, 3.15, 2.05), "rot": 0.68, "warp": 1.65,
     "glow": (255, 165, 190), "gmix": 0.31, "fil": 0.58,
     "blobs": [(0.30, -0.35, 0.44, 0.30, 0.56), (-0.70, 0.32, 0.38, 0.66, 0.52),
               (0.85, 0.15, 0.32, 0.95, 0.40)]},
]

BRANCH_NAMES = ["AKIŞ", "IŞIK", "DOKU"]


def branch_scene(base, b):
    """Ana bolumun uzerine eklenen varyant: ayni palet ailesi, farkli karakter."""
    sc = copy.deepcopy(base)
    f1, f2, f3 = sc["f"]
    if b == 0:                                   # AKIŞ — uzun akan filamanlar
        sc["f"] = (f1 * 0.85, f2 * 0.85, f3 * 1.95)
        sc["warp"] += 0.75
        sc["fil"] = min(sc["fil"] + 0.28, 1.0)
        sc["rot"] += 0.45
        sc["blobs"] = [(x, y, r * 1.55, o, s * 0.9) for x, y, r, o, s in sc["blobs"]]
    elif b == 1:                                 # IŞIK — parlak, hacimli
        sc["gmix"] += 0.30
        sc["stops"] = [tuple(c + (255 - c) * m for c in st)
                       for st, m in zip(sc["stops"], (0.06, 0.14, 0.20, 0.30))]
        sc["glow"] = tuple(min(255, c * 1.12 + 18) for c in sc["glow"])
        sc["blobs"] = [(x, y, r * 0.7, o, s * 1.5) for x, y, r, o, s in sc["blobs"]]
        sc["fil"] = max(sc["fil"] - 0.15, 0.1)
        sc["rot"] -= 0.35
    else:                                        # DOKU — ince, yogun desen
        sc["f"] = (f1 * 2.05, f2 * 1.95, f3 * 1.1)
        sc["fil"] = min(sc["fil"] + 0.42, 1.15)
        sc["gmix"] = max(sc["gmix"] - 0.10, 0.05)
        sc["warp"] = max(sc["warp"] - 0.35, 0.3)
        sc["stops"] = [tuple(c * m for c in st)
                       for st, m in zip(sc["stops"], (0.7, 0.8, 1.0, 1.1))]
        sc["rot"] += 0.9
    sc["stops"] = [tuple(min(255.0, max(0.0, c)) for c in st) for st in sc["stops"]]
    return sc


def lerp(a, b, u):
    if isinstance(a, (list, tuple)):
        return [lerp(x, y, u) for x, y in zip(a, b)]
    return a + (b - a) * u


def blend(a, b, u):
    return {k: lerp(a[k], b[k], u) for k in a if k not in ("name", "sub")}


def make_lut(stops):
    stops = np.asarray(stops, dtype=np.float32)
    pos = np.linspace(0.0, 1.0, len(stops), dtype=np.float32)
    t = np.linspace(0.0, 1.0, 256, dtype=np.float32)
    return np.stack([np.interp(t, pos, stops[:, c]) for c in range(3)], axis=1).astype(np.float32)


def render(sc, phase, zoom=1.0, shift=0.0):
    t = 2.0 * math.pi * phase
    ct, st = math.cos(sc["rot"]), math.sin(sc["rot"])
    X = (X0 / zoom) + shift
    Y = (Y0 / zoom)
    Xr = X * ct - Y * st
    Yr = X * st + Y * ct

    f1, f2, f3 = sc["f"]
    w = np.sin(f1 * Xr + sc["warp"] * math.sin(t))
    w += np.sin(f2 * Yr + sc["warp"] * math.cos(t))
    w += np.sin(f3 * 0.72 * (Xr + Yr) + 2.0 * t)
    w += 0.65 * np.sin(2.2 * (Xr * Xr + Yr * Yr) - t)
    w += 0.42 * np.sin(f1 * 2.7 * Xr - 3.0 * t) * np.sin(f2 * 2.3 * Yr + 2.0 * t)

    g = np.zeros((H, W), dtype=np.float32)
    for bx, by, r, off, size in sc["blobs"]:
        a = t + off * 2.0 * math.pi
        cx = bx + r * math.cos(a)
        cy = by + r * 0.55 * math.sin(a)
        g += np.exp(-((X - cx) ** 2 + (Y - cy) ** 2) / (size * size + 1e-6))

    v = np.clip(0.5 + w / 6.6 + 0.16 * g, 0.0, 1.0)
    rgb = make_lut(sc["stops"])[(v * 255.0).astype(np.uint8)]
    rgb += (g * sc["gmix"])[..., None] * np.asarray(sc["glow"], dtype=np.float32)
    fil = np.abs(np.sin(w * 2.35 + 3.0 * t)) ** 16
    fil *= (0.35 + 0.65 * v)
    rgb += fil[..., None] * np.asarray(sc["stops"][3], dtype=np.float32) * sc["fil"]
    rgb *= VIGNETTE
    return np.clip(rgb, 0, 255).astype(np.uint8)


def smoothstep(u):
    u = min(max(u, 0.0), 1.0)
    return u * u * (3.0 - 2.0 * u)


def phase_curve(u, a, c):
    """p(0)=0, p(1)=1, p'(0)=a, p'(1)=c  → iki ucta dongu hiziyla ayni hiz."""
    return a * u + (3 - 2 * a - c) * u * u + (a + c - 2) * u ** 3


def loop_frames(sc, n):
    for i in range(n):
        yield render(sc, i / n)


def trans_frames(a_sc, b_sc, m, src_n, dst_n):
    a, c = m / src_n, m / dst_n
    for j in range(m):
        u = j / m
        sc = blend(a_sc, b_sc, smoothstep(min(u / 0.88, 1.0)))
        swell = math.sin(math.pi * u) ** 1.6
        yield render(sc, phase_curve(u, a, c), zoom=1.0 + 0.14 * swell, shift=-0.22 * swell)


X264 = ["-c:v", "libx264", "-preset", "slow", "-crf", CRF,
        "-profile:v", "high", "-level", "4.0", "-pix_fmt", "yuv420p",
        "-g", str(FPS), "-keyint_min", str(FPS), "-sc_threshold", "0",
        "-movflags", "+faststart"]


def encode(name, frames_iter):
    path = OUT / f"{name}.mp4"
    p = subprocess.Popen([FFMPEG, "-y", "-loglevel", "error",
                          "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                          "-r", str(FPS), "-i", "-", "-an", *X264, str(path)],
                         stdin=subprocess.PIPE)
    for fr in frames_iter:
        p.stdin.write(fr.tobytes())
    p.stdin.close()
    if p.wait() != 0:
        sys.exit(f"ffmpeg hata: {name}")
    print(f"  {name} ({path.stat().st_size/1024:.0f} KB)", flush=True)


def reverse_clip(src, dst):
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", str(OUT / f"{src}.mp4"),
                    "-vf", "reverse", "-an", *X264, str(OUT / f"{dst}.mp4")], check=True)
    print(f"  {dst} (ters, {(OUT/(dst+'.mp4')).stat().st_size/1024:.0f} KB)", flush=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for f in OUT.glob("*.mp4"): f.unlink()
    for f in OUT.glob("*.webm"): f.unlink()

    branches = [[branch_scene(s, b) for b in range(3)] for s in SECTIONS]
    names = []

    print("ana dongular:", flush=True)
    for i, s in enumerate(SECTIONS, 1):
        encode(f"m{i}", loop_frames(s, MAIN_FRAMES)); names.append(f"m{i}")

    print("aks gecisleri:", flush=True)
    for i in range(len(SECTIONS) - 1):
        encode(f"f{i+1}", trans_frames(SECTIONS[i], SECTIONS[i+1], AXIS_FRAMES, MAIN_FRAMES, MAIN_FRAMES))
        reverse_clip(f"f{i+1}", f"r{i+1}")
        names += [f"f{i+1}", f"r{i+1}"]

    print("dallar:", flush=True)
    for k, s in enumerate(SECTIONS, 1):
        for b in range(3):
            bs = branches[k-1][b]
            encode(f"e{k}{b+1}", trans_frames(s, bs, ENTER_FRAMES, MAIN_FRAMES, BRANCH_FRAMES))
            reverse_clip(f"e{k}{b+1}", f"x{k}{b+1}")
            encode(f"b{k}{b+1}", loop_frames(bs, BRANCH_FRAMES))
            names += [f"e{k}{b+1}", f"x{k}{b+1}", f"b{k}{b+1}"]

    manifest = {
        "fps": FPS, "size": [W, H],
        "durations": {"main": MAIN_FRAMES/FPS, "axis": AXIS_FRAMES/FPS,
                      "branch": BRANCH_FRAMES/FPS, "enter": ENTER_FRAMES/FPS},
        "sections": [
            {"name": s["name"], "sub": s["sub"], "loop": f"m{k+1}",
             "branches": [{"name": BRANCH_NAMES[b], "enter": f"e{k+1}{b+1}",
                           "loop": f"b{k+1}{b+1}", "exit": f"x{k+1}{b+1}"} for b in range(3)]}
            for k, s in enumerate(SECTIONS)],
        "axis": [{"fwd": f"f{i+1}", "rev": f"r{i+1}"} for i in range(len(SECTIONS)-1)],
        "clips": names,
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1))

    print(f"webm yedekleri ({len(names)} klip)...", flush=True)
    procs = []
    for n in names:
        procs.append(subprocess.Popen(
            [FFMPEG, "-y", "-loglevel", "error", "-i", str(OUT / f"{n}.mp4"), "-an",
             "-c:v", "libvpx-vp9", "-crf", WEBM_CRF, "-b:v", "0", "-row-mt", "1",
             "-vf", f"scale={WEBM_W}:{WEBM_H}",
             "-cpu-used", "4", "-g", str(FPS), "-keyint_min", str(FPS),
             "-pix_fmt", "yuv420p", str(OUT / f"{n}.webm")]))
        if len(procs) >= 8:
            [q.wait() for q in procs]; procs = []
    [q.wait() for q in procs]
    total = sum(f.stat().st_size for f in OUT.iterdir()) / 1048576
    print(f"bitti: {len(names)} klip x 2 format, {total:.1f} MB")


if __name__ == "__main__":
    main()
