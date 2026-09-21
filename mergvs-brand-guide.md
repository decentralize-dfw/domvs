# MERGVS — Marka Kimliği & Stil Rehberi

> Bu rehber, tasarım yapan bir yapay zekâya (Claude vb.) olduğu gibi yapıştırılmak üzere yazılmıştır.
> Aşağıdaki kimliği **birebir** uygula: renkler, fontlar, harf aralıkları, doku ve grafik dil.
> Bu bir UI kütüphanesi değil, bir **marka kimliğidir** — hangi mecrada olursa olsun (sunum, web,
> sosyal görsel, PDF) aynı dünyayı kurmalıdır.

---

## 1. Kimliğin Özü

MERGVS'un dünyası: **parşömen üzerine basılmış eski bir atlas / botanik gravürü** hissi.
Dijital bir ürünü, eski dünya zarafetiyle anlatır. Sıcak, edebi, ağırbaşlı; asla "teknoloji şirketi
mavisi", asla neon, asla gradyan.

Anahtar sıfatlar: *kadim, editoryal, botanik, haritacı (kartografik), zarif, sakin.*

- Zeminler her zaman sıcak ve kâğıt tonunda; beyaz (#FFF) yalnız çerçeve içi içerikte kullanılır.
- Yüzeylerde çok hafif kâğıt dokusu (noise) vardır — kusursuz düz renk yerine hafif yaşanmışlık.
- Süsleme minimaldir: 1px ince çizgiler, küçük noktalar, ince konturlu (stroke) çizim ikonlar.
- Vurgu rengi (kızıl toprak) her zaman *italik serif* ile birlikte gelir — altını çizmek yerine
  cümlenin içinde "el yazısıyla not düşülmüş" gibi durur.

---

## 2. Renk Paleti

| Rol | İsim | Hex | Kullanım |
|---|---|---|---|
| Ana zemin | **Parchment** | `#F2EDDF` | Tüm sayfa/slayt zemini. Markanın "kâğıdı". |
| Açık yüzey | **Ivory** | `#F7F3EB` | Kartlar, çipler, butonlar — zeminden bir ton açık. |
| Ana koyu | **Forest** | `#2E3D28` | Başlıklar, wordmark, koyu zemin varyantı. Markanın "mürekkebi". |
| İkincil koyu | **Moss** | `#4A5C40` | Eyebrow etiketleri, ikon konturları, ikincil metin. |
| Soluk yeşil | **Sage** | `#8A9C7A` | Ayraç noktaları, numaralar, soluk etiketler, ince süsler. |
| Vurgu | **Siena** | `#8B4A2A` | İtalik vurgular, linkler, önemli kelimeler. Kızıl toprak / gravür mürekkebi. |
| Gövde metni | **Warm Brown** | `#7A5C3E` | Paragraf metni. Siyah asla kullanılmaz. |
| Çizgi | **Line** | `#D8CDB8` | 1px ayraçlar, kart kenarlıkları, hairline'lar. |
| Koyu zemin vurgusu | **Copper** | `#C98A5E` | Yalnız koyu (Forest) zemin üzerinde vurgu/nokta rengi. |

Kurallar:
- **Saf siyah ve saf beyaz yasak** (beyaz yalnız gömülü içerik çerçevesi zemini olabilir).
- Palet dışına çıkma; mavi, mor, kırmızı, sarı yok.
- Koyu varyant: zemin `#2E3D28`, metin `#F7F3EB`, soluk metin `#8A9C7A`, vurgu `#C98A5E`.
- Gölge kullanılacaksa yeşil tabanlı ve çok hafif: `rgba(46,61,40,.05–.10)`.

---

## 3. Tipografi

Dört aile, dört net rol. (Hepsi Google Fonts'ta ücretsiz.)

| Rol | Font | Ağırlıklar | Karakter |
|---|---|---|---|
| **Display / Logo** | Cinzel | 400–600 | Roma kitabesi havası. SADECE büyük harf, geniş harf aralığı. |
| **Başlık serifi** | IM Fell English (+ Italic) | 400 | 17. yüzyıl matbaası; hafif pürüzlü, edebi. h1/h2 ve italik vurgular. |
| **Gövde** | Lora (+ Italic) | 400–500 | Okunaklı, sıcak kitap serifi. Paragraflar. |
| **Etiket / Eyebrow** | Raleway | 400–600 | İnce, geometrik sans. SADECE büyük harf + geniş aralıklı küçük etiketler. |

CSS tanımı:

```css
--display: 'Cinzel', serif;            /* logo, numaralar, buton/URL rozetleri */
--serif:   'IM Fell English', Georgia, serif;  /* h1, h2, italik vurgu, alıntı */
--body:    'Lora', Georgia, serif;     /* paragraf, açıklama */
--eyebrow: 'Raleway', sans-serif;      /* üst etiket, kategori, dipnot */
```

Harf aralığı (letter-spacing) markanın imzasıdır:

| Öğe | Font | Tracking | Örnek |
|---|---|---|---|
| Wordmark | Cinzel 600 | `.34em` | M E R G V S |
| Eyebrow etiket | Raleway 500, uppercase | `.42em` | H İ Z M E T L E R |
| Alt etiketler / dipnot | Raleway, uppercase | `.12–.3em` | KAYNAK: ... |
| Sayaç / numara | Cinzel | `.1–.22em` | 04 / 12 |
| Başlıklar (IM Fell) | — | normal | takip eklenmez |

Tipografik desenler:
- Başlıklar **her zaman IM Fell English 400**, `line-height: 1.05`, renk Forest.
  Başlığın içindeki kilit kelime `<em>` ile *italik + Siena* yapılır:
  `Statik bir sayfa değil, <em>yaşayan bir dünya</em>.`
- Gövde Lora 400, `line-height: 1.45–1.5`, renk Warm Brown (`#7A5C3E`).
- Eyebrow her bölümün üstünde durur: Raleway, uppercase, `.42em` tracking, Moss rengi,
  küçük punto. Altına 18px boşluk, sonra başlık.
- Büyük istatistik rakamları IM Fell, çok büyük punto (başlığın ~2 katı), Forest.
- Ölçek hissi (1920px genişlik referansı): başlık 60–150px, alt başlık 40px, gövde 24–30px,
  eyebrow 18–22px. Başka tuvalde oranları koru (yaklaşık 5 : 3.3 : 2.2 : 1.6).

---

## 4. Logo

Logo tipografik bir **wordmark**'tır; sembol/amblem yoktur.

- Yazım: `MERGVS` — her zaman büyük harf, "U" yerine Roma usulü "V".
- Font: **Cinzel 600**, harf aralığı **`.34em`**, renk **Forest `#2E3D28`**
  (koyu zeminde Sage `#8A9C7A` veya Ivory).
- Slogan: *"Projenizin Dünyası"* — IM Fell English Italic (veya Georgia Italic), Siena `#8B4A2A`,
  wordmark'ın altında, normal harf aralığı.
- Altına istenirse 1px, ~200px genişliğinde Sage bir çizgi konur (imza çizgisi).

Referans SVG:

```svg
<svg viewBox="0 0 1200 800" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="800" fill="#F2EDDF"/>
  <text x="600" y="360" text-anchor="middle" font-family="Cinzel, serif"
        font-size="120" letter-spacing="28" fill="#2E3D28">MERGVS</text>
  <text x="600" y="470" text-anchor="middle" font-family="IM Fell English, Georgia, serif"
        font-style="italic" font-size="56" fill="#8B4A2A">Projenizin Dünyası</text>
  <rect x="500" y="540" width="200" height="1" fill="#8A9C7A"/>
</svg>
```

Yapma: logoya gölge/kontur ekleme, renklendirme, küçük harfe çevirme, harf aralığını daraltma.

---

## 5. Doku ve Grafik Dil

**Kâğıt dokusu** — her yüzeye çok hafif fraktal noise bindirilir (opaklık ~0.035,
`mix-blend-mode: multiply`; koyu zeminde ~0.06):

```css
.surface::before{
  content:""; position:absolute; inset:0; pointer-events:none;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='160' height='160' filter='url(%23n)' opacity='0.5'/></svg>");
  opacity:.035; mix-blend-mode:multiply;
}
```

**Çizgiler ve ayraçlar**
- Ayraçlar hep 1px ve Line renginde (`#D8CDB8`); kalın border yok.
- İkincil/destek kartlar `1px dashed` kenarlıkla ayrışır (gravür/harita lejantı hissi).
- Küçük ayraç noktaları: 5–6px daire, Sage (koyu zeminde Copper).
- Köşe süsü: 64×64px, yalnız iki kenarı çizili ince Sage köşe çizgileri.

**İkonlar** — dolgusuz, ince konturlu, elle çizilmiş harita işareti havasında:

```css
.ico     { stroke:#4A5C40; stroke-width:1.4; fill:none; }  /* Moss kontur */
.ico-acc { stroke:#8B4A2A; }                               /* Siena vurgu parçası */
```

Emoji, dolgulu (filled) ikon seti, 3D/illüstrasyon kullanılmaz.

**Yüzeyler ve köşeler**
- Kartlar: Ivory zemin, 1px Line kenarlık, 3–8px köşe yarıçapı (asla tam yuvarlak kart).
- Hap/rozet biçimi (tam yuvarlak) yalnız iki şeyde: URL/rozet (`Forest` zemin, Cinzel, Ivory yazı)
  ve küçük aksiyon butonu (Ivory zemin, 1px Sage kenarlık, Siena yazı; hover'da Siena zemin).
- Gölgeler neredeyse görünmez: `0 8px 22px rgba(46,61,40,.05)`.

---

## 6. Ses Tonu (metin yazarken)

- Türkçe; edebi ama net. Pazarlama klişesi yok, ünlem yok.
- Kilit kavram cümle içinde italikle vurgulanır, ayrı bir "badge" yapılmaz.
- Etiketler kısa ve büyük harfli: HİZMETLER, SÜREÇ, İLETİŞİM.
- Marka her zaman "MERGVS" (V ile); slogan: "Projenizin Dünyası".

---

## 7. Hazır Tasarım Token'ları (CSS)

```css
:root{
  /* renkler */
  --parchment:#F2EDDF;   /* ana zemin */
  --ivory:#F7F3EB;       /* kart / açık yüzey */
  --forest:#2E3D28;      /* başlık, wordmark, koyu zemin */
  --moss:#4A5C40;        /* eyebrow, ikon konturu */
  --sage:#8A9C7A;        /* nokta, numara, soluk etiket */
  --siena:#8B4A2A;       /* italik vurgu, link */
  --text:#7A5C3E;        /* gövde metni */
  --line:#D8CDB8;        /* 1px çizgiler */
  --copper:#C98A5E;      /* koyu zeminde vurgu */

  /* fontlar */
  --display:'Cinzel', serif;
  --serif:'IM Fell English', Georgia, serif;
  --body:'Lora', Georgia, serif;
  --eyebrow:'Raleway', sans-serif;
}

/* Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400..600&family=IM+Fell+English:ital@0;1&family=Lora:ital,wght@0,400..500;1,400&family=Raleway:wght@400..600&display=swap');

/* imza öğeleri */
.wordmark{ font-family:var(--display); letter-spacing:.34em; font-weight:600; color:var(--forest); }
.eyebrow{ font-family:var(--eyebrow); letter-spacing:.42em; text-transform:uppercase; color:var(--moss); font-weight:500; }
h1,h2{ font-family:var(--serif); font-weight:400; color:var(--forest); line-height:1.05; }
.em, em{ font-style:italic; color:var(--siena); }
body{ background:var(--parchment); color:var(--text); font-family:var(--body); }
.rule{ height:1px; background:var(--line); border:0; }
```

---

## 8. Kısa Kontrol Listesi

- [ ] Zemin parşömen (`#F2EDDF`), üzerinde hafif noise var mı?
- [ ] Başlık IM Fell English, içindeki kilit kelime italik + Siena mı?
- [ ] Bölüm üstünde Raleway uppercase `.42em` eyebrow var mı?
- [ ] MERGVS wordmark Cinzel `.34em` ile mi yazıldı?
- [ ] Tüm çizgiler 1px ve `#D8CDB8` mi; ikonlar dolgusuz 1.4px Moss kontur mu?
- [ ] Saf siyah/beyaz, mavi, gradyan, emoji, kalın gölge YOK mu?
