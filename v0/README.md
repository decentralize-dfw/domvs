# v0 arşivi

2026 yeniden tasarımından **önceki** MERGVS sitesinin dondurulmuş kopyası.
Bej/parşömen paletli, uzun kaydırmalı eski sürüm.

Hiçbir şey silinmedi: bu klasör yalnızca bir yedek. Canlı site kök dizinden
servis edilmeye devam ediyor.

```
v0/
  index.html          eski ana sayfa (yeniden inşadan önceki hâli, 692111e)
  about · agents · services · blog · blog-1..5
  fiyat · istanbul · luxembourg · milan · privacy · terms
  blog/<slug>/index.html      yazılar
  tr/                          Türkçe sayfalar
  mergvs-contact.js            o dönemki iletişim modalı
  mergvs-contact-tr.js
```

## Notlar

- Dosyalar **birebir** kopya; tek bir karakter değiştirilmedi.
- Görseller (`mergvs-son.png`, `blog/*.png`) kopyalanmadı, hâlâ kökte
  duruyorlar ve arşiv sayfaları onlara mutlak yolla erişiyor.
- İngilizce sayfalar modalı göreli yolla (`mergvs-contact.js`) çağırdığı için
  buradaki kopyayı kullanıyor. Türkçe sayfalar ise mutlak yolla
  (`/mergvs-contact-tr.js`) çağırıyor, yani kökteki dosyayı okurlar; o dosya
  ileride değişirse arşivdeki birebir kopya `v0/mergvs-contact-tr.js`'te duruyor.
- `robots.txt` içinde `Disallow: /v0/` var; sayfaların kendi `canonical`
  etiketleri zaten canlı URL'leri işaret ediyor, yani yinelenen içerik riski yok.
- `sitemap.xml`'e eklenmedi.

Yeni sayfalar yayına alındıkça eski sürümleri buraya taşınır.
