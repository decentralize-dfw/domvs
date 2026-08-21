#!/usr/bin/env python3
"""
demo5 icin frame-uyumlu video seti uretir.

Uretilen klipler:
  v1.mp4  -> LOOP A   (kusursuz dongu)
  v2.mp4  -> GECIS A->B
  v3.mp4  -> LOOP B   (kusursuz dongu)
  v4.mp4  -> GECIS B->C
  v5.mp4  -> LOOP C   (kusursuz dongu)
  v2r.mp4 / v4r.mp4 -> ayni gecislerin ters yonu (geri navigasyon icin)

Kural: her klibin "bir sonraki" karesi, zincirdeki bir sonraki klibin 0. karesidir.
Bu sayede oynatici klip degistirdiginde goruntude hicbir siçrama olmaz.
"""
import math
import subprocess
import sys
from pathlib import Path

import numpy as np
import imageio_ffmpeg

W, H = 1280, 720
FPS = 30
LOOP_FRAMES = 150   # 5.0 sn - tam 1 devir
TRANS_FRAMES = 75   # 2.5 sn - tam 1 devir (2x tempo, dinamik gecis hissi)

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
    {   # A - derin okyanus / aurora
        "stops": [(3, 8, 24), (7, 46, 92), (28, 148, 176), (156, 246, 228)],
        "f": (3.05, 2.35, 1.80),
        "rot": 0.35,
        "warp": 1.25,
        "glow": (70, 205, 255),
        "gmix": 0.30,
        "fil": 0.55,
        "blobs": [(-0.65, -0.15, 0.45, 0.00, 0.62),
                  (0.70, 0.20, 0.38, 0.33, 0.50),
                  (0.05, -0.35, 0.55, 0.66, 0.42)],
    },
    {   # B - gun batimi / magenta
        "stops": [(20, 5, 26), (96, 22, 76), (214, 74, 96), (255, 196, 122)],
        "f": (2.15, 3.40, 2.60),
        "rot": -0.62,
        "warp": 1.85,
        "glow": (255, 130, 90),
        "gmix": 0.34,
        "fil": 0.48,
        "blobs": [(0.55, 0.25, 0.60, 0.12, 0.52),
                  (-0.75, 0.05, 0.30, 0.55, 0.66),
                  (-0.10, 0.40, 0.42, 0.80, 0.36)],
    },
    {   # C - yesim / altin
        "stops": [(4, 16, 14), (12, 74, 62), (58, 176, 118), (250, 226, 150)],
        "f": (3.80, 1.70, 3.10),
        "rot": 0.95,
        "warp": 0.90,
        "glow": (180, 255, 170),
        "gmix": 0.28,
        "fil": 0.60,
        "blobs": [(0.15, -0.30, 0.34, 0.40, 0.70),
                  (-0.55, 0.30, 0.50, 0.05, 0.44),
                  (0.80, -0.10, 0.28, 0.72, 0.38)],
    },
]


def lerp(a, b, u):
    if isinstance(a, (list, tuple)):
        return [lerp(x, y, u) for x, y in zip(a, b)]
    return a + (b - a) * u


def blend_scene(a, b, u):
    return {k: lerp(a[k], b[k], u) for k in a}


def make_lut(stops):
    """4 duraktan 256 girisli renk tablosu."""
    stops = np.asarray(stops, dtype=np.float32)
    pos = np.linspace(0.0, 1.0, len(stops), dtype=np.float32)
    t = np.linspace(0.0, 1.0, 256, dtype=np.float32)
    lut = np.stack([np.interp(t, pos, stops[:, c]) for c in range(3)], axis=1)
    return lut.astype(np.float32)


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
    # ince detay katmani (tum terimler faz icinde tam periyodik → dongu bozulmaz)
    w += 0.42 * np.sin(f1 * 2.7 * Xr - 3.0 * t) * np.sin(f2 * 2.3 * Yr + 2.0 * t)

    g = np.zeros((H, W), dtype=np.float32)
    for bx, by, r, off, size in sc["blobs"]:
        a = t + off * 2.0 * math.pi
        cx = bx + r * math.cos(a)
        cy = by + r * 0.55 * math.sin(a)
        d2 = (X - cx) ** 2 + (Y - cy) ** 2
        g += np.exp(-d2 / (size * size + 1e-6))

    v = np.clip(0.5 + w / 6.6 + 0.16 * g, 0.0, 1.0)
    idx = (v * 255.0).astype(np.uint8)
    rgb = make_lut(sc["stops"])[idx]
    rgb += (g * sc["gmix"])[..., None] * np.asarray(sc["glow"], dtype=np.float32)

    # akan ince filamanlar: alanin es-yukselti cizgileri → goruntuye netlik/doku
    fil = np.abs(np.sin(w * 2.35 + 3.0 * t)) ** 16
    fil *= (0.35 + 0.65 * v)
    rgb += fil[..., None] * np.asarray(sc["stops"][3], dtype=np.float32) * sc["fil"]

    rgb *= VIGNETTE
    return np.clip(rgb, 0, 255).astype(np.uint8)


def encode(name, frames_iter, count):
    path = OUT / name
    cmd = [FFMPEG, "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-",
           "-an",
           "-c:v", "libx264", "-preset", "slow", "-crf", "20",
           "-profile:v", "high", "-level", "4.0",
           "-pix_fmt", "yuv420p",
           "-g", str(FPS), "-keyint_min", str(FPS), "-sc_threshold", "0",
           "-movflags", "+faststart",
           str(path)]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i, fr in enumerate(frames_iter):
        p.stdin.write(fr.tobytes())
        if i % 25 == 0:
            print(f"  {name}: {i+1}/{count}", flush=True)
    p.stdin.close()
    if p.wait() != 0:
        sys.exit(f"ffmpeg hata: {name}")
    print(f"  -> {name} ({path.stat().st_size/1024:.0f} KB)", flush=True)


def smoothstep(u):
    u = min(max(u, 0.0), 1.0)
    return u * u * (3.0 - 2.0 * u)


def loop_frames(sc):
    for i in range(LOOP_FRAMES):
        yield render(sc, i / LOOP_FRAMES)


def eased_phase(u):
    """Gecis klibi 1 tam devri yarim surede tamamlar; ama hiz profili iki ucta
    dongu videosunun hiziyla ayni olsun diye yumusatilir (0.5x -> 1.5x -> 0.5x).
    Boylece klip degisiminde konum da hiz da surekli kalir."""
    k = 0.5 / (2.0 * math.pi)
    return u - k * math.sin(2.0 * math.pi * u)


def trans_frames(a, b):
    for j in range(TRANS_FRAMES):
        u = j / TRANS_FRAMES
        pu = smoothstep(min(u / 0.88, 1.0))
        sc = blend_scene(a, b, pu)
        swell = math.sin(math.pi * u)
        yield render(sc, eased_phase(u), zoom=1.0 + 0.14 * swell, shift=-0.22 * swell)


def reverse_clip(src, dst):
    cmd = [FFMPEG, "-y", "-loglevel", "error", "-i", str(OUT / src),
           "-vf", "reverse", "-an",
           "-c:v", "libx264", "-preset", "slow", "-crf", "20",
           "-profile:v", "high", "-level", "4.0", "-pix_fmt", "yuv420p",
           "-g", str(FPS), "-keyint_min", str(FPS), "-sc_threshold", "0",
           "-movflags", "+faststart", str(OUT / dst)]
    subprocess.run(cmd, check=True)
    print(f"  -> {dst} ({(OUT/dst).stat().st_size/1024:.0f} KB)", flush=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    A, B, C = SCENES
    encode("v1.mp4", loop_frames(A), LOOP_FRAMES)
    encode("v2.mp4", trans_frames(A, B), TRANS_FRAMES)
    encode("v3.mp4", loop_frames(B), LOOP_FRAMES)
    encode("v4.mp4", trans_frames(B, C), TRANS_FRAMES)
    encode("v5.mp4", loop_frames(C), LOOP_FRAMES)
    reverse_clip("v2.mp4", "v2r.mp4")
    reverse_clip("v4.mp4", "v4r.mp4")
    print("bitti")


if __name__ == "__main__":
    main()
