# MERGVS — Animasyon (Teaser) için Claude Design Prompt'u

**Nasıl kullanılır:** Claude Design'da **Animation** template'ini seç, sonra aşağıdaki `## PROMPT` başlığından dosya sonuna kadar olan metni yapıştır. Çıktı, tarayıcıda kendi kendine oynayan, döngüye giren kısa bir tanıtım animasyonudur (motion graphics). Üretimden sonra **Tweaks** panelinden zamanlamayı ve renkleri ayarlayabilirsin. Sosyal medya/reel için paylaşmak istersen ekran kaydı al.

---

## PROMPT

Sen uzman bir motion-graphics tasarımcısısın. Görevin: **tek dosyalık, kendi kendine oynayan ve sorunsuz döngüye giren (loop) bir HTML/CSS/JS animasyonu** üretmek. Metinler **Türkçe**dir. Bu, **MERGVS** adlı bir gayrimenkul "archviz" (mimari görselleştirme) stüdyosunun **konut/inşaat projeleri geliştiren bir müşteriye** göstereceği ~**35–40 saniyelik** bir tanıtım teaser'ıdır. Aynı parça sosyal medyada kısa film/reel olarak da kullanılabilir.

### Tek fikir (animasyonun tamamı bunu anlatır): "Kademeli Anlatı"
Tek ve **kesintisiz bir zoom / push-in** hareketiyle, geniş kent ölçeğinden tek bir mobilyaya kadar iniyoruz. İzleyici, bir projeyle ilgili tüm bilginin (konum, çevre, bina, daire, iç mekân, ölçü) **tek bir akışta** birleştiğini hisseder. Kamera asla durmaz; her katmanda kısaca yavaşlayıp etiket gösterir ve içeri inmeye devam eder.

Katman sırası: **KENT → MAHALLE → BİNA / PARSEL → KAT / DAİRE → ODA / İÇ MEKÂN → MOBİLYA**

### Storyboard (yaklaşık zamanlama — kesintisiz tek bir iniş hissi ver)
- **0:00–0:04 — Açılış:** Parşömen zemin, ince çizgilerle MERGVS kelime markası belirir; başlık yazılır: *"Projenizin Dünyası"*. Hemen ardından kamera içeri doğru hareketlenmeye başlar.
- **0:04–0:09 — KENT:** Çok sade bir şehir silüeti / ızgara hattı. Etiket: **Kent** · alt satır: *"konumun değeri"*.
- **0:09–0:14 — MAHALLE:** Sokak/blok hatları ve birkaç yakınlık noktası belirir (okul, ulaşım, manzara — küçük ikonlar). Etiket: **Mahalle** · *"çevre ve yaşam"*.
- **0:14–0:19 — BİNA / PARSEL:** Tek bir bina kütlesi yükselir, cephe çizgileri çizilir. Etiket: **Bina** · *"kütle ve cephe"*.
- **0:19–0:24 — KAT / DAİRE:** Bina "kesilir" (kesit hissi), bir kat planı ortaya çıkar. Etiket: **Daire** · *"oda oda"*.
- **0:24–0:29 — ODA / İÇ MEKÂN:** Bir odanın sade izometrik/iç perspektifi belirir. Etiket: **İç mekân** · *"yürü, hisset"*.
- **0:29–0:34 — MOBİLYA:** Bir mobilya (ör. kanepe ya da yatak) yumuşakça yerine yerleşir; yanında bir ölçü çizgisi belirir. Etiket: **Mobilya** · *"fareyle yerleştir, ölç"*.
- **0:34–0:40 — Birleşme & Kapanış:** Kamera hafifçe geri çekilir; tüm katmanların tek bir akış olduğu hissi verilir. Telefon · masaüstü · VR ikonları belirir ve tek bir bağlantıya akar. Kapanış metni: **"Tek bağlantı. Her cihaz."** + MERGVS markası + *mergvs.com*. Ardından açılışa yumuşak geçişle döngüye gir.

### Tasarım yönü (MERGVS marka kimliği)
- **Palet:** zemin parşömen `#F2EDDF` / fildişi `#F7F3EB`; ana koyu orman yeşili `#2E3D28`; ikincil yosun `#4A5C40`, adaçayı `#8A9C7A`; vurgu **siena** `#8B4A2A` (önemli kelimeler italik + siena); metin `#7A5C3E`; ince çizgi/kenarlık `#D8CDB8`.
- **Yazı tipleri (Google Fonts):** başlık ve etiketler **'IM Fell English'** (zarif serif) + **'Cinzel'** (marka/etiket, büyük harf geniş aralık); destek metin **'Lora'**; küçük üst-etiketler **'Raleway'** (uppercase, letter-spacing).
- **Hava:** "eski dünya prestiji + yeni dünya teknolojisi." Sakin, premium, bol boşluk. Çok düşük opaklıkta kâğıt dokusu (noise) eklenebilir.

### Hareket ve diyagram kuralı (ÖNEMLİ — basit tut)
- Her şey **çizgi tabanlı, sade inline SVG**. İkonlar ince çizgili ve minimal; gerçekçi 3D modelleme yok — **şematik** anlat.
- Tek bir net fikir akışta ilerler: **sürekli zoom / push-in.** Sahne sahne sert kesme yerine, ölçekleme + opaklık + yumuşak hareketle akıcı geçiş yap.
- Etiketler kısa sürede belirip kaybolsun (fade/slide), kamerayla senkron. Aynı anda ekranda en fazla bir ana etiket olsun.
- Yumuşak, sinematik easing (ease-in-out). Abartılı, hızlı, kalabalık hareket yok.

### Teknik gereksinimler
- **Tek `.html` dosyası**, harici bağımlılık yok (yalnızca Google Fonts linki serbest). Saf HTML + CSS + küçük vanilla JS; çerçeve kullanma.
- **Otomatik oynar, sonsuz döngüye girer.** İdeal en-boy **16:9**; mobil/dikey de bozulmadan ortalanabilsin.
- Zamanlama ve renkler kolay ayarlanabilir olsun (örn. CSS değişkenleri / JS sabitleri) ki Tweaks ile süre ve renkler oynatılabilsin.
- Türkçe karakterler (ç, ğ, ı, İ, ö, ş, ü) sorunsuz; `<html lang="tr">`, `<meta charset="UTF-8">`.
- Akıcı 60fps hissi; CSS/SVG animasyonları transform & opacity üzerinden (performanslı).

### Ton
Premium, sade, güven veren. Az kelime, güçlü hareket. Faydayı hissettir: tek akışta her şey, kent ölçeğinden mobilyaya. Süslemeden çok netlik.

Şimdi bu animasyonun tamamını tek bir HTML dosyası olarak üret.
