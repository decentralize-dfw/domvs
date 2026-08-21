# demo6 — Ana Bina · Luxembourg Köşe Apartmanı (GLB)

Referans fotoğraflardaki **köşe apartmanının dış kabuğu** — çevre binalar bilinçli olarak yok,
yalnız ana bina ve arsası. İç mekân modellenmedi; dışarıdan birebir benzerlik hedeflendi.
`tools/build_scene.py` sahneyi kurar ve **`scene.glb`** (glTF 2.0) olarak dışa aktarır;
`index.html` yerel three.js ile tarayıcı görüntüleyicisidir.

## Referanstan modele geçen özellikler

* **Taş zemin kat** — rustik kesme taş kaplama, çevresini saran derz çizgileri; üstünde 2 kat beyaz sıva
* **Bej söve çerçeveleri** — bütün sokak pencerelerinde çıkıntılı taş söve, koyu jaluzili cam
* **Köşe pencereleri** — ön/sol köşede iki camın ince koyu dikmeyle köşede buluştuğu,
  sövelerin köşeyi sardığı pencereler (3 katta da)
* **Balkonlar** — yan cephede üst üste 3 balkon: açık döşeme + koyu dikey çubuklu korkuluk,
  arkalarında genişletilmiş cam doğrama
* **Çatı** — dik kırma (hip) çatı, tepesi düz; üzerinde **çinko (koyu metal) dormer kutuları**,
  eğime oturan ışıklıklar ve çinko kaplı bacalar
* **Giriş** — koyu metal düz saçak (kanopi), koyu kapı + yan cam kolonu, üstünde dar pencere dizisi
* **Arsa** — taş istinat duvarları + harpuşta, yuvarlak budanmış şimşir topları, parke avlu,
  ön-solda metal korkuluklu bodrum rampası, iki cadde ve kaldırım, park hâlinde araçlar

Bina ölçüleri: 13.2 × 12.0 m taban, taş zemin + 2 kat (3.0 m), saçak 9.55 m, çatı tepesi ~15.2 m.
~17.6k üçgen, 36 düğüm, 30 PBR malzeme, 0.34 MB.

## Üretim / görüntüleme

```bash
pip install trimesh shapely numpy scipy mapbox_earcut
python3 tools/build_scene.py        # -> scene.glb + scene-info.json

python3 -m http.server 8000         # görüntüleyici (file:// değil)
# → http://localhost:8000/demo6/    # İzometrik / Kuş bakışı / Sokak / Köşe açıları
```

`Sokak` ve `Köşe` kamera ön ayarları, referans fotoğrafların çekildiği açılara denk gelir.

## GLB kullanımı

`scene.glb` standarttır: Blender (İçe Aktar → glTF 2.0), three.js `GLTFLoader`, Unity/Unreal
glTF eklentileri, Windows 3D Viewer vb. Düğüm adları `grup__malzeme` biçimindedir
(`govde`, `cephe`, `cati`, `arsa`, `bitki`, `araclar`) — parçalar gruba göre seçilebilir.

Cepheler parametriktir: pencere aksları `sove_window(cephe, konum, kat)` çağrılarıyla tanımlı;
söve ölçüsü, kat yüksekliği, çatı eğimi vb. dosyanın başındaki sabitlerden değişir.
