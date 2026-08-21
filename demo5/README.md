# demo5 — Ağaç Yapılı Akıllı Video Player

7 bölümlük dikey aks + her bölüme 3 eklenti dalı. Toplam **82 klip**, hepsi birbirine
**kare hassasiyetinde** bağlı: hiçbir geçişte siyah kare, donma ya da sıçrama yok.

```
        m1 ──┬─ e11/x11 ─ b11  (+ AKIŞ)
        │    ├─ e12/x12 ─ b12  (+ IŞIK)
        │    └─ e13/x13 ─ b13  (+ DOKU)
    f1 ↓↑ r1
        m2 ──┬─ e21/x21 ─ b21
        │    ├─ …
        ⋮
        m7 ──┴─ e73/x73 ─ b73
```

| klip | adet | süre | rol |
|---|---|---|---|
| `m1…m7`     | 7  | 4.0 sn / 120 kare | ana bölüm döngüsü (tam 1 devir) |
| `f1…f6`     | 6  | 2.0 sn /  60 kare | dikey aks ileri geçişi |
| `r1…r6`     | 6  | 2.0 sn /  60 kare | aynı geçişin ters kodlanmışı |
| `e{k}{b}`   | 21 | 1.2 sn /  36 kare | dala giriş (ana gövde → eklenti) |
| `b{k}{b}`   | 21 | 2.5 sn /  75 kare | eklenti dalı döngüsü |
| `x{k}{b}`   | 21 | 1.2 sn /  36 kare | daldan çıkış (girişin tersi) |

Bölümler: 01 Okyanus · 02 Gün Batımı · 03 Yeşim · 04 Nebula · 05 Bakır · 06 Buzul · 07 Gül Kuartz
Her bölümün dalları: **+ AKIŞ** (uzun akan filamanlar) · **+ IŞIK** (hacimli parlama) · **+ DOKU** (ince yoğun desen).
Dal sahneleri, ana bölümün paletinden türetilir — üzerine eklenmiş bir katman gibi görünür.

## Kare sözleşmesi

`tools/generate_videos.py` şunları garanti eder:

* `geçiş[0] == kaynak döngü[0]` — geçiş, kaynak döngünün 0. karesinden başlar
* `geçiş[son] + 1 kare == hedef döngü[0]` — geçiş, hedef döngünün hemen öncesinde biter
* `ters[son] == kaynak döngü[0]`
* Geçişin faz hızı iki ucunda ilgili döngünün hızına eşitlenir (`phase_curve`, uçlarda
  `p'(0)=m/N₁`, `p'(1)=m/N₂`) — konum da hız da sürekli.

Bunun sonucu: `geçiş[son] → sonraki geçiş[0]` de sürekli. Bu yüzden uzak bir düğüme
gidilirken **ara döngüler hiç oynatılmadan** geçişler doğrudan birbirine zincirlenir
(ör. 3.3 → 7.2: `b33 → x33 → f3 → f4 → f5 → f6 → e72 → b72`).

## Oynatma tarafı (`index.html`)

* 82 klibin tamamı açılışta belleğe indirilir (fetch + blob, 8 eşzamanlı).
* **19 sabit eleman** (7 ana döngü + 12 aks geçişi) + **12'lik dinamik havuz** = 31 video elemanı.
  Havuz, bulunulan bölümün 9 dal klibini önden çözüp 0. karesi boyanmış hâlde tutar; klip
  değişimi yalnızca katman değiştirmektir.
* Bir hedefe basıldığında önce **yolun tamamı** hazırlanır (`ensurePath`), sonra zincir başlar —
  zincir ortasında kod çözücü yükü oluşmaz.
* Döngü ortasında basılırsa kalan süre ×3 (2/3/5 seçilebilir) hızda oynatılıp son kareye
  yetişilir; geçiş klibi de bu hızda başlar, zincirin son adımında 380 ms'de 1×'e iner.
* H.264/mp4 ana set (960×540), VP9/webm yedek (640×360); tarayıcıya göre otomatik seçilir.

Klavye: `↑` `↓` bölüm · `→` dala gir / bir sonraki dal · `←` geri · `1`–`7` bölüm · `Q` `W` `E` dal ·
`Esc` ana gövde · `Home`/`End` uçlar · `D` teknik bilgi.

## Doğrulama

```bash
python3 tools/verify_continuity.py         # mp4 seti
python3 tools/verify_continuity.py webm    # webm seti
python3 tools/verify_continuity.py mp4 --v # tüm satırları göster
```

159 birleşme noktası kontrol edilir; her birinin farkı, o birleşmedeki döngünün kendi doğal
ardışık kare farkının 1.6 katı + 2'nin altında kalmalıdır. Son ölçüm: **159/159 geçti** (iki
format için de). Giriş birleşmeleri ≈1.6–2.3 (aynı kare, kodek gürültüsü), çıkış ve zincir
birleşmeleri doğal kare farkı seviyesinde.

Tarayıcı tarafı (Playwright): 82/82 klip bellekte, 31 eleman sınırı korunuyor, 7 bölümlük aks
ileri/geri, **21 dalın hepsinde giriş/çıkış piksel dikişi** (0 siyah kare, 0 donan kare,
maks Δparlaklık 5.5), dal→dal geçişi, uzak düğüme zincir (691 örnek, 0 siyah/donan kare),
28 istekli rastgele stres, döngü kararlılığı, 0 konsol hatası.

## Kullanım

```bash
python3 -m http.server 8000     # file:// değil — fetch/blob için http gerekir
# → http://localhost:8000/demo5/
```

## Yeniden üretmek / genişletmek

```bash
pip install numpy imageio-ffmpeg
python3 tools/generate_videos.py    # 82 klip × (mp4 + webm), ~8 dk, ~26 MB
```

Yeni bölüm eklemek için `SECTIONS` listesine bir palet sözlüğü eklemek yeterli; dallar
`branch_scene()` ile üretilir, `manifest.json` otomatik yazılır ve oynatıcı manifesti okuduğu
için `index.html` değişmeden çalışır.
