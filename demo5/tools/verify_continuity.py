#!/usr/bin/env python3
"""Agac yapisindaki tum klip birlesmelerini piksel duzeyinde dogrular.

Olcut: bir birlesmedeki kare farki, kliplerin kendi dogal ardisik kare
farkindan belirgin buyuk olmamali. Karsilastirmalar 320x180'e kucultulmus
karelerde yapilir (ayni olcek hem dogal fark hem birlesme icin gecerli).
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import imageio_ffmpeg

M = Path(__file__).resolve().parent.parent / "media"
FF = imageio_ffmpeg.get_ffmpeg_exe()
EXT = sys.argv[1] if len(sys.argv) > 1 else "mp4"
SW, SH = 320, 180

man = json.loads((M / "manifest.json").read_text())
SEC, AXIS = man["sections"], man["axis"]

cache = {}
def load(clip):
    if clip not in cache:
        out = subprocess.run([FF, "-v", "error", "-i", str(M / f"{clip}.{EXT}"),
                              "-vf", f"scale={SW}:{SH}", "-f", "rawvideo",
                              "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
        a = np.frombuffer(out, np.uint8).reshape(-1, SH, SW, 3).astype(np.int16)
        cache[clip] = (a[0].copy(), a[1].copy(), a[-2].copy(), a[-1].copy(), len(a))
    return cache[clip]

first  = lambda c: load(c)[0]
second = lambda c: load(c)[1]
penult = lambda c: load(c)[2]
last   = lambda c: load(c)[3]
count  = lambda c: load(c)[4]
d = lambda a, b: round(float(np.abs(a - b).mean()), 2)

loops = [s["loop"] for s in SEC] + [b["loop"] for s in SEC for b in s["branches"]]
NATC = {c: max(d(first(c), second(c)), d(penult(c), last(c))) for c in loops}
LIM_EQ = 3.0              # "ayni kare olmali" siniri (kodek gurultusu payi)

print(f"format .{EXT} · {len(man['clips'])} klip")
print(f"dogal ardisik kare farki: min {min(NATC.values()):.2f} / max {max(NATC.values()):.2f}")
print("birlesme siniri: ilgili dongunun kendi dogal kare farkinin 1.6 kati + 2\n")

rows, bad = [], []
def chk(label, a, b, lim):
    v = d(a, b)
    good = v <= lim
    rows.append((good, label, v, lim))
    if not good: bad.append(label)

def seam(*refs):
    """Birlesmenin sinirini, o birlesmedeki dongulerin dogal kare farkina gore belirle."""
    return max(NATC[r] for r in refs) * 1.6 + 2.0

# --- ana donguler + dikey aks ---
for i, s in enumerate(SEC):
    chk(f"m{i+1}  dongu dikisi", last(s["loop"]), first(s["loop"]), seam(s["loop"]))
for i, ax in enumerate(AXIS):
    a, bnext = SEC[i]["loop"], SEC[i+1]["loop"]
    chk(f"m{i+1}[0] == {ax['fwd']}[0]", first(a), first(ax["fwd"]), LIM_EQ)
    chk(f"{ax['fwd']}[son] → m{i+2}[0]", last(ax["fwd"]), first(bnext), seam(a, bnext))
    chk(f"{ax['rev']}[son] == m{i+1}[0]", last(ax["rev"]), first(a), LIM_EQ)
    chk(f"m{i+2}[son] → {ax['rev']}[0]", last(bnext), first(ax["rev"]), seam(a, bnext))
for i in range(len(AXIS)-1):
    chk(f"{AXIS[i]['fwd']}[son] → {AXIS[i+1]['fwd']}[0] (zincir)",
        last(AXIS[i]["fwd"]), first(AXIS[i+1]["fwd"]), seam(SEC[i+1]["loop"]))
    chk(f"{AXIS[i+1]['rev']}[son] → {AXIS[i]['rev']}[0] (zincir)",
        last(AXIS[i+1]["rev"]), first(AXIS[i]["rev"]), seam(SEC[i+1]["loop"]))

# --- dallar ---
for i, s in enumerate(SEC):
    m = s["loop"]
    for b in s["branches"]:
        chk(f"m{i+1}[0] == {b['enter']}[0]", first(m), first(b["enter"]), LIM_EQ)
        chk(f"{b['enter']}[son] → {b['loop']}[0]", last(b["enter"]), first(b["loop"]), seam(b["loop"]))
        chk(f"{b['loop']} dongu dikisi", last(b["loop"]), first(b["loop"]), seam(b["loop"]))
        chk(f"{b['loop']}[son] → {b['exit']}[0]", last(b["loop"]), first(b["exit"]), seam(b["loop"]))
        chk(f"{b['exit']}[son] == m{i+1}[0]", last(b["exit"]), first(m), LIM_EQ)
    # daldan cikip baska dala / aksa zincirleme
    chk(f"{s['branches'][0]['exit']}[son] → {s['branches'][1]['enter']}[0] (dal→dal)",
        last(s["branches"][0]["exit"]), first(s["branches"][1]["enter"]), LIM_EQ)
    if i < len(AXIS):
        chk(f"{s['branches'][2]['exit']}[son] → {AXIS[i]['fwd']}[0] (dal→aks)",
            last(s["branches"][2]["exit"]), first(AXIS[i]["fwd"]), LIM_EQ)

for good, label, v, lim in rows:
    if not good or "--v" in sys.argv:
        print(f"  {'OK  ' if good else 'HATA'} {label:<48} fark {v:6.2f} (sınır {lim:.2f})")
print(f"\n{len(rows)} kontrol, {len(bad)} hata"
      + ("" if not bad else "\nhatalar: " + ", ".join(bad)))
sys.exit(1 if bad else 0)
