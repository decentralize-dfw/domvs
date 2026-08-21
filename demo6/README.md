# demo6 — Köşe Parseli · 3B Sahne (GLB)

Referans görseldeki köşe parselinin prosedürel 3B modeli. Tek bir Python betiği sahneyi
kurar ve **`scene.glb`** olarak dışa aktarır; `index.html` ise modeli tarayıcıda gösteren
üç boyutlu bir görüntüleyicidir (three.js yerel olarak `vendor/` içinde, CDN gerekmez).

## Sahnede ne var

| grup | içerik |
|---|---|
| `zemin` | diorama kaidesi, asfalt, kaldırımlar, bordürler, yaya geçitleri, orta şeritler, yol oku, bisiklet şeridi, rögar kapakları, çim alanlar |
| `bina_kose` | köşeyi dönen 4 katlı ana bina — güneydoğu köşesi pahlı, mansart çatı, 8 çatı penceresi, 4 ışıklık, 3 baca, balkonlar, girişte kanopi ve merdiven |
| `bina_orta`, `bina_sol` | 4 katlı komşu apartmanlar (biri kanatlı L planlı) |
| `bina_arka_sol`, `bina_arka_orta` | arka sıradaki 5 katlı kırma çatılı bloklar |
| `bina_sag` | caddenin karşısındaki 5 katlı blok |
| `ev_bati`, `ev_on_sol`, `ev_on_sag` | diorama kenarında kesilen 2 katlı evler |
| `agaclar` | 30+ sokak ağacı + arka bahçedeki büyük ağaçlar |
| `araclar` | 24 park etmiş araç (gövde, tavan, cam, 4 tekerlek, farlar) |
| `bahce` | istinat duvarları, çitler, çalılar, tarhlar |
| `mobilya` | sokak lambaları, trafik tabelaları, dubalar |

Toplam **~82.000 üçgen**, **125 düğüm**, **34 PBR malzeme**, **1.5 MB** GLB.
Ölçek 1 birim = 1 metre; sahne 92 × 68 m, Y yukarı (glTF standardı).

## Nasıl üretiliyor

`tools/build_scene.py` içinde her şey parametrik:

* `apartment(...)` — ayak izi çokgeni + kat sayısı + cephe tanımı alır; gövdeyi, taş soklu,
  saçağı, mansart/kırma çatıyı, pencere/balkon dizilimini, girişi, çatı pencerelerini ve
  bacaları üretir.
* `ring_of()` — miter iç-ofset. Köşe sayısını birebir koruduğu için çatı bandı (`band()`)
  bükülmeden kapanır; pahlı ve L planlı ayak izlerinde de doğru çalışır.
* Cephe yönü ayak izinin saat yönünün tersine normalize edilmesiyle bulunur, böylece
  pencereler her zaman dışa bakar.
* Çatı pencereleri ve ışıklıklar `(kenar_indeksi, oran)` ile verilir; eğim üzerindeki
  konumları otomatik hesaplanır.
* Malzemeler `MATS` sözlüğünde tek yerde: renk + metallic + roughness.

```bash
pip install trimesh shapely numpy scipy mapbox_earcut
python3 tools/build_scene.py        # -> scene.glb + scene-info.json
```

## Görüntüleyici

```bash
python3 -m http.server 8000     # file:// değil
# → http://localhost:8000/demo6/
```

İzometrik / kuş bakışı / sokak / köşe kamera açıları, otomatik döndürme, tel kafes,
gölge açma-kapama, katman listesinden grup gizleme ve **GLB indir** düğmesi.

## GLB'yi başka yerde kullanmak

`scene.glb` standart glTF 2.0 ikili dosyasıdır; Blender (`File → Import → glTF 2.0`),
three.js `GLTFLoader`, Unity/Unreal glTF eklentileri, Windows 3D Viewer, macOS Preview
ve <https://gltf-viewer.donmccurdy.com> ile açılır. Düğüm adları `grup__malzeme`
biçimindedir, yani Blender'da parçalar gruplarına göre kolayca seçilebilir.
