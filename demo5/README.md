# demo5 — Akıllı Video Player

Döngü klipleri ile geçiş kliplerini **kare hassasiyetinde** birbirine bağlayan oynatıcı.

## Zincir

```
LOOP A ──(v2)──▶ LOOP B ──(v4)──▶ LOOP C
       ◀─(v2r)──        ◀─(v4r)──
```

* `v1`, `v3`, `v5` → kusursuz döngü klipleri (5 sn, 150 kare, tam 1 devir)
* `v2`, `v4` → geçiş klipleri (2.5 sn, 75 kare) · `v2r`, `v4r` → aynı geçişlerin tersi (geri gezinme)

## Neden kayma olmuyor

1. **Üretim tarafı** (`tools/generate_videos.py`): her klibin "bir sonraki karesi", zincirdeki sonraki
   klibin 0. karesidir. Geçiş klibi, A sahnesinin tam o karesinden başlar ve B sahnesinin 0. karesinin
   hemen öncesinde biter. Geçişin faz hızı iki uçta döngü hızına eşitlenir (0.5× → 1.5× → 0.5×),
   böylece konum da hız da sürekli kalır.
2. **Oynatma tarafı** (`index.html`): tüm klipler baştan belleğe indirilir (blob), 0. kareleri
   boyanmış hâlde duraklatılmış bekler. Klip değişimi sadece katman değiştirmektir → siyah kare,
   donma ya da ağ beklemesi olmaz. (Piksel testi: 336 örnekte 0 siyah kare, 0 donan kare.)
3. **Yakalama hızı**: döngünün ortasında ileri/geri basılırsa kalan süre ×3 (2/3/5 seçilebilir)
   hızda oynatılıp son kareye yetişilir, geçiş klibi de bu hızda başlayıp 420 ms içinde 1×'e iner.

## Kullanım

```bash
python3 -m http.server 8000     # file:// değil, http üzerinden açın (fetch/blob gerekir)
# → http://localhost:8000/demo5/
```

Klavye: `←` `→` gezinme, `D` teknik bilgi paneli.

## Videoları yeniden üretmek

```bash
pip install numpy imageio-ffmpeg
python3 demo5/tools/generate_videos.py          # mp4 (H.264) seti
# webm (VP9) yedeği, H.264 desteklemeyen tarayıcı derlemeleri için:
for f in v1 v2 v3 v4 v5 v2r v4r; do
  ffmpeg -y -i demo5/media/$f.mp4 -an -c:v libvpx-vp9 -crf 32 -b:v 0 -row-mt 1 \
         -cpu-used 4 -g 30 -keyint_min 30 -pix_fmt yuv420p demo5/media/$f.webm
done
```
