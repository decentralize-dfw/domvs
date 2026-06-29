# MERGVS — Müşteri Sunumu için Claude Design Prompt'u

**Nasıl kullanılır:** Aşağıdaki `## PROMPT` başlığından dosyanın sonuna kadar olan metnin tamamını kopyalayıp Claude'a (design / artifact) yapıştır. Çıktı, tarayıcıda tam ekran açıp yarın müşteriye sunabileceğin tek dosyalık bir HTML sunumudur. İstersen yapıştırdıktan sonra şunları ekleyebilirsin: müşterinin/projenin adı, şehir, kaç konut/blok olduğu — sunum o bilgilere göre kişiselleşir.

---

## PROMPT

Sen uzman bir sunum ve web tasarımcısısın. Görevin: **tek dosyalık, kendi içinde çalışan (self-contained) bir HTML sunum** üretmek. Sunum **Türkçe**dir ve **yarın bir müşteriye** birebir gösterilecektir. Müşteri **konut / inşaat projeleri geliştiren bir firma** (örn. site, rezidans, villa, karma proje inşa eden bir müteahhit/geliştirici). Sunumu yapan biz: **MERGVS** — gayrimenkul için "archviz" (mimari görselleştirme) deneyim motoru kuran bir stüdyo.

### Sunumun tek cümlelik amacı
Müşteriyi şuna ikna et: Bir projeyi tanıtmanın bilgisi bugün dağınık (fotoğraf ayrı, yazı ayrı, video ayrı, varsa basit bir 3D ayrı) ve durağandır. MERGVS bunların **hepsini tek bir interaktif 3D deneyimde** birleştirir; bu deneyim **kent ölçeğinden, fareyle mobilya yerleştirme ölçeğine kadar** kesintisiz iner; **tek bir bağlantıyla**, **VR / mobil / PC** fark etmeksizin, uygulama indirmeden herkes gezer.

### Sunumun OMURGASI — "Kademeli Anlatı" (en önemli fikir)
Tüm sunumu bu fikrin üzerine kur. Klasik emlak sunumunda bilgi parça parça ve farklı yerlerdedir; çevre/mahalle, evin gerçek ölçüleri ya da "mobilyam sığar mı" sorusu çoğunlukla hiç cevaplanmaz. Biz ise **anlatıyı katman katman açan** tek bir deneyim sunuyoruz ve sunum boyunca bu katmanlar **kademe kademe yakınlaşır**:

> **KENT → MAHALLE → BİNA / PARSEL → KAT / DAİRE → ODA / İÇ MEKÂN → MOBİLYA**

Her katmanda alıcı bir şey "yapar" (gezer, ölçer, dener). En sonunda tüm katmanlar web üzerinde birleşir ve emlakçı/satışçı **kendi sözüyle gezdirerek** her şeyi basitçe ve hızlıca anlatır — biz buna **"süper anlatı"** diyoruz.

### Anlatılması gereken gerçek ürün (uydurma, bunlara sadık kal)
- **VEA motoru:** Three.js tabanlı, tarayıcıda çalışan interaktif 3D emlak sunum motoru. Kurulum yok, hesap yok, indirme yok — **tek URL her cihazda** (telefon / masaüstü / tablet / VR başlığı) açılır.
- **4 gezinme modu (basit anlat):**
  1. **Yörünge** — projeyi/binayı dışarıdan döndürerek izleme, cephe ve malzeme seçeneklerini değiştirme.
  2. **Kesit & Kameralar** — binayı "kesip" plan gibi görme; odadan odaya sabit kamera noktalarına ışınlanma.
  3. **Yürüyüş** — birinci şahıs gezinti (WASD); mobilde **çift joystick**, VR'da içeri girme.
  4. **Panorama** — 360° render/panorama gezintisi.
- **Mobilya editörü:** Alıcı **fareyle mobilya yerleştirir / taşır / döndürür / boyutlandırır**; "buraya yatağım sığar mı, kanepe nasıl durur" sorusu canlı cevaplanır. Yerleştirilen mobilya sahneler arası korunur.
- **Hotspotlar:** 3D işaretçilere tıklanınca açılan bilgi balonları (metin, görsel, video, 360°).
- **Gündüz/gece & ışık simülasyonu**, sıkıştırılmış optimize 3D modeller (hızlı yükleme), komşu sahnelerin ön-yüklenmesiyle anlık geçişler.
- **Tek kaynaktan beslenir:** Tüm sahneler bir konfigürasyon dosyasından (Excel) okunur — içerik güncellemesi koda dokunmadan yapılır.

### Servislerimiz (sunumda 5 ana başlık olarak ver)
1. **Emlak 3D Arayüzü** — yukarıdaki interaktif deneyim motoru; her işin kalbi.
2. **Reel / Kısa Film** — projenin 3D modelinden doğrudan render edilen sinematik videolar + sosyal medya için reel/kısa film. Drone yok, çekim ekibi yok.
3. **Web Sitesi / Özel Mikrosite** — projeye özel tek bir bağlantı; kendi alan adınızda, platform/marka bağımlılığı olmadan.
4. **Kent–Mahalle Ölçeği Analiz & Raporlama** — konum/çevre analizi, yakınlık (okul, ulaşım, yaşam olanakları), manzara simülasyonu, geliştiriciye sunulabilir raporlar.
5. **Marka Kimliği / Marka Stratejisi** — projenin marka kimliği ve konumlandırma stratejisi.
(Destekleyici katmanlar — kısaca değinilebilir: sanal sahneleme & döşeme, kat planı sayısallaştırma, foto→render düzenleme, malzeme/doku galerisi, etkileşim analitiği.)

### Slayt slayt içerik (bu sırayla, ~11 slayt)
1. **Kapak** — MERGVS kelime markası; başlık: *"Projenizin Dünyası"*; alt başlık: *"Kent ölçeğinden mobilyaya kadar tek bir interaktif deneyim."*; küçük bir yer: müşteri/proje adı + tarih.
2. **Bugünün Sorunu** — Bilgi dağınık, durağan ve eksik. *Basit diyagram:* solda birbirinden kopuk parçalar (Fotoğraf · Yazı · Video · PDF · Basit 3D) dağınık dururken; "Çevre/Mahalle? Gerçek ölçüler? Mobilyam sığar mı?" soruları cevapsız kalır.
3. **Önerimiz: Tek Deneyim** — Hepsi tek yerde, tek bağlantı, her cihaz. *Basit diyagram:* Telefon + Masaüstü + VR ikonları → tek URL → tek deneyim. "Uygulama yok, hesap yok, indirme yok."
4. **Kademeli Anlatı (MERKEZ SLAYT)** — Yukarıdaki zoom merdivenini görselleştir: **Kent → Mahalle → Bina/Parsel → Kat/Daire → Oda → Mobilya.** Her basamağın yanında tek satır: alıcının orada ne yaptığı (örn. "Mahalle: yakınlık ve manzara", "Daire: oda oda yürüyüş", "Mobilya: fareyle yerleştir, ölç").
5. **Deneyimin İçinde** — 4 modu basit 4 kutu/ikonla anlat (Yörünge · Kesit & Kameralar · Yürüyüş · Panorama) + öne çıkar: **Mobilya editörü** ("fareyle mobilya yerleştir") ve **hotspotlar**.
6. **Statikten Canlıya** — Video/fotoğraf durağandır; biz render düzenler, fotoğrafı render kalitesine çıkarır, **sosyal medya için reel/kısa film** üretiriz. Bu, projenin tanıtım katmanıdır.
7. **Süper Anlatı** — Tüm katmanlar web üzerinde birleşir; emlakçı/satışçı **kendi sözüyle canlı gezdirir**, her şeyi basitleştirip toparlayarak çok hızlı tanıtır. *Basit diyagram:* tüm katmanlar tek arayüzde birleşiyor.
8. **Servislerimiz** — 5 servisi 5 sade kart olarak (yukarıdaki liste).
9. **Süreç** — 4 adım: **Keşif → 3D Yeniden İnşa → Deneyim İnşası → Yayın.** (Planlardan/çizimlerden gerçek zamanlı 3D kurarız; proje inşa edilmeden önce satılabilir.)
10. **İnşaatçı İçin Değer** — Maketten/projeden satış: daha hiçbir şey inşa edilmeden alıcı içeride yürür; ölçeği ve mekânı kavrar; tek bağlantı tüm projeyi taşır; karar hızlanır. 1–2 sade istatistik kullanılabilir: sürükleyici 3D turla ~%9 daha yüksek satış fiyatı ve ~%31 daha hızlı kapanış (Texas Tech / Matterport); videolu ilan videosuza göre ~%403 daha fazla talep (NAR 2024). İstatistikleri abartma, küçük kaynak notuyla ver.
11. **Kapanış** — *"Projenizin dünyasını birlikte kuralım."* İletişim: hello@mergvs.com · mergvs.com. Kısa, net bir çağrı.

### Tasarım yönü (MERGVS marka kimliği)
- **Palet:** zemin parşömen `#F2EDDF` / fildişi `#F7F3EB`; koyu/ana orman yeşili `#2E3D28`; ikincil yosun `#4A5C40` ve adaçayı `#8A9C7A`; vurgu **siena** `#8B4A2A` (önemli kelimeler italik + siena); metin `#7A5C3E`; ince çizgiler/kenarlıklar `#D8CDB8`.
- **Yazı tipleri (Google Fonts):** başlıklar **'IM Fell English'** (zarif serif) ve kelime markası/etiketler **'Cinzel'**; gövde **'Lora'**; küçük etiketler/eyebrow **'Raleway'** (büyük harf, geniş harf aralığı). Vurgu kelimeleri italik ve siena renginde.
- **Hava:** "eski dünya prestiji + yeni dünya teknolojisi." Bol boşluk, ince yosun çizgiler, sakin ve premium. Hafif kâğıt dokusu (çok düşük opaklıkta noise) eklenebilir.

### Diyagram kuralı (ÖNEMLİ)
Tüm diyagramlar **çok basit ve net** olsun. Satır/çizgi tabanlı, sade inline **SVG** kullan; ikonlar ince çizgili ve minimal. Kalabalık, karmaşık şema yok. Bir slaytta tek bir net fikir. Az renk, çok boşluk.

### Teknik gereksinimler
- **Tek bir `.html` dosyası**, harici bağımlılık yok (yalnızca Google Fonts linki serbest). Çerçeve/framework kullanma; saf HTML + CSS + küçük bir vanilla JS.
- **16:9 slayt** mantığı; ok tuşları (← →) ve ekranda ileri/geri ile gezinme; köşede slayt sayacı (örn. 03 / 11).
- Tam ekran sunuma uygun; **yazdır → PDF** çıktısı düzgün olmalı (her slayt bir sayfa).
- Mobilde de okunur şekilde duyarlı (responsive) olsun.
- Türkçe karakterler (ç, ğ, ı, İ, ö, ş, ü) sorunsuz; `<html lang="tr">`, `<meta charset="UTF-8">`.
- Yumuşak, abartısız geçiş animasyonları.

### Ton
Premium ama anlaşılır. Teknik jargon en azda; faydayı (daha hızlı/daha pahalı satış, alıcının mekânı kavraması, tek bağlantı) öne çıkar. Kısa cümleler, güçlü başlıklar. Süslü değil; net ve güven veren.

Şimdi bu sunumun tamamını tek bir HTML dosyası olarak üret.
