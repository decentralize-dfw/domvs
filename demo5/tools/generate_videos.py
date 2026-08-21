#!/usr/bin/env python3
"""
demo5 icin frame-uyumlu video seti uretir.

Zincir:  L1 --f1--> L2 --f2--> L3 --f3--> L4 --f4--> L5 --f5--> L6
            <--r1--     <--r2--     <--r3--     <--r4--     <--r5--

Uretilenler:
  loop1..loop6.mp4  -> kusursuz dongu klipleri (4.0 sn / 120 kare / tam 1 devir)
  fwd1..fwd5.mp4    -> ileri gecis klipleri    (2.0 sn /  60 kare / tam 1 devir)
  rev1..rev5.mp4     -> ayni gecislerin ters kodlanmis kopyalari (geri gezinme)

Kare sozlesmesi (oynaticinin dayandigi kurallar):
  * fwd_k[0]            == loop_k[0]                 (gecis, dongunun 0. karesinden baslar)
  * fwd_k[son] + 1 kare == loop_{k+1}[0]             (gecis, hedef dongunun oncesinde biter)
  * rev_k[son]          == loop_k[0]
  * Bu yuzden fwd_k[son] -> fwd_{k+1}[0] gecisi de kare-tam surekli olur
    (zincirleme atlamada ara dongu oynatilmadan dogrudan bir sonraki gecise girilebilir).
  * Gecisin faz hizi iki ucta dongu hiziyla esitlenir (0.5x -> 1.5x -> 0.5x):
    konum da hiz da surekli.
"""
import math
import subprocess
import sys
from pathlib import Path

import numpy as np
import imageio_ffmpeg

W, H = 1280, 720
FPS = 30
LOOP_FRAMES = 120   # 4.0 sn - tam 1 devir
TRANS_FRAMES = 60   # 2.0 sn - tam 1 devir (ortalama 2x tempo)
CRF = "24"

OUT = Path(__file__).resolve().parent.parent / "media"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

# ---------------------------------------------------------------- koordinatlar
ax = np.linspace(-1.6, 1.6, W, dtype=np.float32)
ay = np.linspace(-0.9, 0.9, H, dtype=np.float32)
X0, Y0 = np.meshgrid(ax, ay)
RAD = np.sqrt((X0 / 1.6) ** 2 + (Y0 / 0.9) ** 2)
VIGNETTE = np.clip(1.0 - 0.52 * (RAD ** 2.1), 0.15, 1.0).astype(np.float32)[..., None]

# ---------------------------------------------------------------- sahneler
SCENES = [
    {   # 01 - derin okyanus
        "stops": [(3, 8, 24), (7, 46, 92), (28, 148, 176), (156, 246, 228)],
        "f": (3.05, 2.35, 1.80), "rot": 0.35, "warp": 1.25,
        "glow": (70, 205, 255), "gmix": 0.30, "fil": 0.55,
        "blobs": [(-0.65, -0.15, 0.45, 0.00, 0.62),
                  (0.70, 0.20, 0.38, 0.33, 0.50),
                  (0.05, -0.35, 0.55, 0.66, 0.42)],
    },
    {   # 02 - gun batimi
        "stops": [(20, 5, 26), (96, 22, 76), (214, 74, 96), (255, 196, 122)],
        "f": (2.15, 3.40, 2.60), "rot": -0.62, "warp": 1.85,
        "glow": (255, 130, 90), "gmix": 0.34, "fil": 0.48,
        "blobs": [(0.55, 0.25, 0.60, 0.12, 0.52),
                  (-0.75, 0.05, 0.30, 0.55, 0.66),
                  (-0.10, 0.40, 0.42, 0.80, 0.36)],
    },
    {   # 03 - yesim
        "stops": [(4, 16, 14), (12, 74, 62), (58, 176, 118), (250, 226, 150)],
        "f": (3.80, 1.70, 3.10), "rot": 0.95, "warp": 0.90,
        "glow": (180, 255, 170), "gmix": 0.28, "fil": 0.60,
        "blobs": [(0.15, -0.30, 0.34, 0.40, 0.70),
                  (-0.55, 0.30, 0.50, 0.05, 0.44),
                  (0.80, -0.10, 0.28, 0.72, 0.38)],
    },
    {   # 04 - mor nebula
        "stops": [(10, 6, 28), (52, 26, 110), (140, 72, 200), (240, 186, 255)],
        "f": (2.60, 2.90, 3.60), "rot": -1.25, "warp": 2.15,
        "glow": (170, 120, 255), "gmix": 0.32, "fil": 0.52,
        "blobs": [(-0.30, 0.35, 0.52, 0.25, 0.58),
                  (0.62, -0.28, 0.44, 0.62, 0.48),
                  (-0.85, -0.20, 0.36, 0.90, 0.40)],
    },
    {   # 05 - bakir / col
        "stops": [(24, 10, 4), (96, 44, 16), (198, 110, 42), (255, 226, 172)],
        "f": (1.85, 4.10, 2.20), "rot": 1.55, "warp": 1.05,
        "glow": (255, 170, 80), "gmix": 0.30, "fil": 0.64,
        "blobs": [(0.40, 0.40, 0.30, 0.50, 0.64),
                  (-0.60, -0.30, 0.58, 0.18, 0.46),
                  (0.90, -0.35, 0.40, 0.84, 0.34)],
    },
    {   # 06 - buzul
        "stops": [(6, 14, 24), (30, 70, 110), (120, 180, 220), (242, 250, 255)],
        "f": (4.20, 2.05, 2.85), "rot": -0.20, "warp": 1.45,
        "glow": (200, 235, 255), "gmix": 0.26, "fil": 0.70,
        "blobs": [(-0.20, -0.40, 0.48, 0.08, 0.54),
                  (0.75, 0.30, 0.34, 0.44, 0.60),
                  (-0.90, 0.25, 0.42, 0.70, 0.38)],
    },
]


def lerp(a, b, u):
    if isinstance(a, (list, tuple)):
        return [lerp(x, y, u) for x, y in zip(a, b)]
    return a + (b - a) * u


def blend_scene(a, b, u):
    return {k: lerp(a[k], b[k], u) for k in a}


def make_lut(stops):
    stops = np.asarray(stops, dtype=np.float32)
    pos = np.linspace(0.0, 1.0, len(stops), dtype=np.float32)
    t = np.linspace(0.0, 1.0, 256, dtype=np.float32)
    return np.stack([np.interp(t, pos, stops[:, c]) for c in range(3)], axis=1).astype(np.float32)


def render(sc, phase, zoom=1.0, shift=0.0):
    """Tum terimler faz icinde tam periyodiktir -> kare 120 == kare 0."""
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
        d2 = (X - cx) ** 2 + (Y - cy) ** 2
        g += np.exp(-d2 / (size * size + 1e-6))

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


def eased_phase(u):
    """Gecis 1 devri yarim surede tamamlar ama iki ucta dongu hiziyla ayni hizdadir."""
    k = (TRANS_FRAMES / LOOP_FRAMES) / (2.0 * math.pi)   # = 0.5 / 2pi
    return u - k * math.sin(2.0 * math.pi * u)


def loop_frames(sc):
    for i in range(LOOP_FRAMES):
        yield render(sc, i / LOOP_FRAMES)


def trans_frames(a, b):
    for j in range(TRANS_FRAMES):
        u = j / TRANS_FRAMES
        sc = blend_scene(a, b, smoothstep(min(u / 0.88, 1.0)))
        swell = math.sin(math.pi * u) ** 1.6      # iki ucta ~0 -> artik zoom/kayma yok
        yield render(sc, eased_phase(u), zoom=1.0 + 0.14 * swell, shift=-0.22 * swell)


X264 = ["-c:v", "libx264", "-preset", "slow", "-crf", CRF,
        "-profile:v", "high", "-level", "4.0", "-pix_fmt", "yuv420p",
        "-g", str(FPS), "-keyint_min", str(FPS), "-sc_threshold", "0",
        "-movflags", "+faststart"]


def encode(name, frames_iter):
    path = OUT / name
    cmd = [FFMPEG, "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-an", *X264, str(path)]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for fr in frames_iter:
        p.stdin.write(fr.tobytes())
    p.stdin.close()
    if p.wait() != 0:
        sys.exit(f"ffmpeg hata: {name}")
    print(f"  -> {name} ({path.stat().st_size/1024:.0f} KB)", flush=True)


def reverse_clip(src, dst):
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", str(OUT / src),
                    "-vf", "reverse", "-an", *X264, str(OUT / dst)], check=True)
    print(f"  -> {dst} ({(OUT/dst).stat().st_size/1024:.0f} KB)", flush=True)


def webm(src):
    dst = src.replace(".mp4", ".webm")
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", str(OUT / src), "-an",
                    "-c:v", "libvpx-vp9", "-crf", "34", "-b:v", "0", "-row-mt", "1",
                    "-cpu-used", "4", "-g", str(FPS), "-keyint_min", str(FPS),
                    "-pix_fmt", "yuv420p", str(OUT / dst)], check=True)
    return dst


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for i, sc in enumerate(SCENES, 1):
        encode(f"loop{i}.mp4", loop_frames(sc))
    for i in range(len(SCENES) - 1):
        encode(f"fwd{i+1}.mp4", trans_frames(SCENES[i], SCENES[i+1]))
        reverse_clip(f"fwd{i+1}.mp4", f"rev{i+1}.mp4")

    names = [f"loop{i}.mp4" for i in range(1, len(SCENES) + 1)]
    names += [f"fwd{i}.mp4" for i in range(1, len(SCENES))]
    names += [f"rev{i}.mp4" for i in range(1, len(SCENES))]
    print("webm yedekleri...", flush=True)
    procs = []
    for n in names:
        procs.append(subprocess.Popen(
            [FFMPEG, "-y", "-loglevel", "error", "-i", str(OUT / n), "-an",
             "-c:v", "libvpx-vp9", "-crf", "34", "-b:v", "0", "-row-mt", "1",
             "-cpu-used", "4", "-g", str(FPS), "-keyint_min", str(FPS),
             "-pix_fmt", "yuv420p", str(OUT / n.replace(".mp4", ".webm"))]))
        if len(procs) >= 8:
            [q.wait() for q in procs]; procs = []
    [q.wait() for q in procs]
    print(f"bitti: {len(names)} klip x 2 format")


if __name__ == "__main__":
    main()
