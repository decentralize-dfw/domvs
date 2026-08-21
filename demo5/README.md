# demo5 — Akıllı Video Player

6 sahne, 16 klip. Döngü klipleri ile geçiş klipleri **kare hassasiyetinde** birbirine bağlanır;
sahne değişiminde siyah kare, donma ya da sıçrama olmaz.

## Zincir

```
L1 ═fwd1═▶ L2 ═fwd2═▶ L3 ═fwd3═▶ L4 ═fwd4═▶ L5 ═fwd5═▶ L6
   ◀═rev1═    ◀═rev2═    ◀═rev3═    ◀═rev4═    ◀═rev5═
```

| klip | süre | rol |
|---|---|---|
| `loop1…loop6` | 4.0 sn / 120 kare | kusursuz döngü (tam 1 devir) |
| `fwd1…fwd5`   | 2.0 sn /  60 kare | ileri geçiş (sahne k → k+1) |
| `rev1…rev5`   | 2.0 sn /  60 kare | aynı geçişin ters kodlanmış kopyası |

Sahneler: 01 Okyanus · 02 Gün Batımı · 03 Yeşim · 04 Nebula · 05 Bakır · 06 Buzul

## Kare sözleşmesi

`tools/generate_videos.py` şunları garanti eder:

* `fwd_k[0] == loop_k[0]` — geçiş, döngünün 0. karesinden başlar
* `fwd_k[son] + 1 kare == loop_{k+1}[0]` — geçiş, hedef döngünün hemen öncesinde biter
* `rev_k[son] == loop_k[0]`
* Bu ikisinin sonucu: `fwd_k[son] → fwd_{k+1}[0]` de sürekli. Bu yüzden uzak bir sahneye
  atlandığında **ara döngüler hiç oynatılmadan** geçişler doğrudan birbirine zincirlenir.
* Geçişin faz hızı iki uçta döngü hızına eşitlenir (0.5× → 1.5× → 0.5×): konum da hız da sürekli.

## Oynatma tarafı (`index.html`)

* 16 klip başta belleğe indirilir (fetch + blob), hepsi **0. karesi boyanmış** hâlde duraklatılmış bekler.
  Klip değişimi yalnızca katman değiştirmektir → ağ beklemesi / siyah kare yok.
* Döngü ortasında yön tuşuna basılırsa kalan süre ×3 (2/3/5 seçilebilir) hızda oynatılıp son kareye
  yetişilir; geçiş klibi de bu hızda başlar ve zincirin **son** adımında 420 ms içinde 1×'e iner.
* Uzak sahneye atlama (dot / çip / `1`–`6` / `Home` / `End`) tek hamlede zincirlenir; zincir ortasında
  yön değiştirmek de desteklenir.
* H.264/mp4 ana set, VP9/webm yedek; tarayıcıya göre otomatik seçilir.

Klavye: `←` `→` gezinme · `1`–`6` sahneye atlama · `Home`/`End` uçlara · `D` teknik bilgi paneli.

## Doğrulama

```bash
python3 tools/verify_continuity.py         # mp4 seti: 34 birleşme noktası
python3 tools/verify_continuity.py webm    # webm seti
```

Her birleşmedeki piksel farkı, kliplerin kendi doğal ardışık kare farkının altında kalmalıdır.
Son ölçüm: 34/34 geçti (giriş birleşmeleri ≈1.0, çıkış/zincir birleşmeleri 6–11; doğal kare farkı 6–12).

Tarayıcı tarafı (Playwright ile) doğrulananlar: 16/16 klip tam tamponda, 10 tek adım geçişinin
tamamında 0 siyah kare / 0 donan kare, 1→6 ve 6→1 zincir sıraları, hızlı üst üste basma,
zincir ortasında yön değiştirme, 30 istekli rastgele stres, döngü sarma kararlılığı.

## Kullanım

```bash
python3 -m http.server 8000     # file:// değil — fetch/blob için http gerekir
# → http://localhost:8000/demo5/
```

## Videoları yeniden üretmek

```bash
pip install numpy imageio-ffmpeg
python3 tools/generate_videos.py    # 16 klip x (mp4 + webm), ~6 dk
```

Sahne eklemek için `SCENES` listesine yeni bir palet/parametre sözlüğü eklemek yeterli:
döngü, ileri ve geri geçiş klipleri otomatik üretilir. Oynatıcı tarafında `SCENES` dizisine
karşılık gelen satırı eklemek dışında değişiklik gerekmez.
