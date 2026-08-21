#!/usr/bin/env python3
"""Klip birlesme noktalarini piksel duzeyinde dogrular.

Olcut: bir birlesmedeki kare farki, dongunun kendi dogal kare farkindan
belirgin buyuk olmamali (siçrama yok demek).
"""
import subprocess, sys, numpy as np, imageio_ffmpeg
from pathlib import Path

M = Path(__file__).resolve().parent.parent / "media"
FF = imageio_ffmpeg.get_ffmpeg_exe()
N = 6                      # sahne sayisi
EXT = sys.argv[1] if len(sys.argv) > 1 else "mp4"
W, H = 1280, 720

def frames(clip, sel):
    out = subprocess.run([FF, "-v", "error", "-i", str(M/f"{clip}.{EXT}"),
                          "-vf", sel, "-vsync", "0", "-f", "rawvideo",
                          "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
    a = np.frombuffer(out, np.uint8).reshape(-1, H, W, 3).astype(np.int16)
    return a

cache = {}
def f(clip, which):
    if clip not in cache:
        n = int(subprocess.run([FF+"", "-v", "error", "-i", str(M/f"{clip}.{EXT}"),
                                "-f", "null", "-"], capture_output=True).returncode == 0)
        a = frames(clip, "select=1")           # tum kareler
        cache[clip] = (a[0], a[-1], a[1], a[-2], len(a))
    first, last, second, penult, cnt = cache[clip]
    return {"first": first, "last": last, "second": second, "penult": penult, "count": cnt}[which]

def d(a, b): return round(float(np.abs(a-b).mean()), 2)

loops = [f"loop{i}" for i in range(1, N+1)]
fwd   = [f"fwd{i}"  for i in range(1, N)]
rev   = [f"rev{i}"  for i in range(1, N)]

print(f"format: .{EXT}")
print("klip kare sayilari:", {c: f(c, "count") for c in loops[:1] + fwd[:1] + rev[:1]})

# dogal kare farki referansi: her klibin ic kare farki
nat = []
for c in loops:
    nat.append(d(f(c, "first"), f(c, "second")))
    nat.append(d(f(c, "last"), f(c, "penult")))
NAT = max(nat)
print(f"dogal (ardisik) kare farki  : min {min(nat)} / max {NAT}")

checks, bad = [], 0
def chk(label, a, b, limit):
    global bad
    v = d(a, b)
    ok = v <= limit
    if not ok: bad += 1
    checks.append((label, v, limit, "OK" if ok else "HATA"))

for i in range(N):
    chk(f"loop{i+1}: son -> ilk  (dongu dikisi)", f(loops[i], "last"), f(loops[i], "first"), NAT*1.6)
for i in range(N-1):
    chk(f"loop{i+1}[0]  == fwd{i+1}[0]   (gecis girisi)", f(loops[i], "first"), f(fwd[i], "first"), 2.5)
    chk(f"fwd{i+1}[son] -> loop{i+2}[0]  (gecis cikisi)", f(fwd[i], "last"), f(loops[i+1], "first"), NAT*1.6)
    chk(f"rev{i+1}[son] == loop{i+1}[0]  (geri cikisi)",  f(rev[i], "last"), f(loops[i], "first"), 2.5)
    chk(f"loop{i+2}[son]-> rev{i+1}[0]   (geri girisi)",  f(loops[i+1], "last"), f(rev[i], "first"), NAT*1.6)
for i in range(N-2):
    chk(f"fwd{i+1}[son] -> fwd{i+2}[0]   (ileri zincir)", f(fwd[i], "last"), f(fwd[i+1], "first"), NAT*1.6)
    chk(f"rev{i+2}[son] -> rev{i+1}[0]   (geri zincir)",  f(rev[i+1], "last"), f(rev[i], "first"), NAT*1.6)

wid = max(len(c[0]) for c in checks)
for label, v, lim, st in checks:
    print(f"  {st:4} {label:<{wid}}  fark {v:6.2f}  (sinir {lim:.2f})")
print(f"\n{len(checks)} kontrol, {bad} hata")
sys.exit(1 if bad else 0)
