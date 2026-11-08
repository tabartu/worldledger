# Worldledger

*[English README](README.md)*

Worldledger, oyun geliştiricilerin oyun dünyalarının lore'unu yazıp yönettiği, veriyi kendi cihazında tutan bir wiki uygulamasıdır. Herhangi bir oyun türüne ya da oyun motoruna bağlı değildir.

İlk modül **Lore Ansiklopedisi**, dünyayı bir kaynak kitap gibi tutar: kategoriler bölüm, sayfalar maddedir ve her madde diğerlerine bağlantı verebilir. Her şey tarayıcında saklanır; sunucu yok, hesap gerekmez.

> **Durum:** geliştiriliyor. Altı aşamanın hepsi tamam: dünyalar, sayfalar, bölümler, iç bağlantılar, arama, geri bağlantılar, bilgi kutuları, zaman çizelgesi, ilişki ağı, haritalar, yapay zekâ desteği, dışa aktarma ve yedekleme ve EN/TR arayüz.

## Özellikler

Şu anda kullanılabilenler:

- **Birden fazla dünya.** Her dünyanın adı, türü, tonu, içerik dili, özeti, kapak rengi ve takvim etiketi var.
- **Markdown ile sayfalar.** Sayfalar bölümlere ayrılır: Karakter, Mekân, Fraksiyon, Olay, Eşya, Yaratık, Kavram ve kendi eklediğin bölümler.
- **İç bağlantılar.**
  - `[[Sayfa Adı]]` ya da `[[Sayfa Adı|etiket]]` yazınca bağlantı olur.
  - Henüz olmayan sayfalara giden bağlantılar kesik çizgili kırmızı görünür; tıklayınca o sayfa oluşturulur.
  - Bir sayfanın adı değişince ona giden tüm bağlantılar güncellenir.
  - Takma adlar ("diğer adları") da bağlantıları çözer.
- **Aranan sayfalar.** Dünya ana sayfası kırmızı bağlantıları, en çok kullanılandan başlayarak listeler.
- **Arama.** Bir dünyanın içindeyken Ctrl/⌘+K ile başlıklarda, takma adlarda ve metinde ara.
  - Büyük-küçük harf ve aksanlar fark etmez, Türkçe noktalı/noktasız i dahil: `istanbul` *İstanbul*'u, `isikli` *Işıklı*'yı bulur.
  - Aynı pencereden bölümlere ve ayarlara gidebilir, yazdığın adla yeni sayfa oluşturabilirsin.
- **Zaman çizelgesi.** Tarihli tüm sayfalar, dünyanın kendi takviminde sırayla görünür.
  - Dünya ayarlarından takvime ad verebilir, ay ekleyebilir, 0. yıldan önceki yıllar için bir etiket ve *Kül Çağı* gibi çağlar tanımlayabilirsin.
  - Çağlar renkli bantlar olarak görünür.
  - Bilgi kutularındaki doğum, ölüm ve kuruluş tarihleri de gösterilebilir.
  - Bölüme göre süzebilir; sıkışık aralık ("N yıl sonra" işaretleriyle) ile yakınlaştırılabilir ölçekli aralık arasında geçiş yapabilirsin.
- **İlişki ağı.** Sayfalar arasındaki tüm bağlantılar, bölüme göre renklendirilmiş bir ağ olarak çizilir.
  - Bölüme göre süzebilir, bağlantısız sayfaları gösterip gizleyebilirsin.
  - Bir sayfaya tıklayınca bağlantıları vurgulanır; çift tıklayınca sayfa açılır.
  - Liste görünümü aynı bağlantıları metin olarak gösterir.
- **Haritalar.** Kendi harita görselini yükle, yakınlaştır ve kaydır.
  - Tıklayarak işaret koy, sürükleyerek taşı. Her işareti bir sayfaya bağla: işaret o sayfanın bölüm rengini alır, henüz yazılmamış sayfalar boş halkayla görünür.
  - Her sayfada, işaretine götüren "Haritada" bağlantıları çıkar.
  - Haritanın yanındaki işaret listesi aynı bilginin metin hâlidir.
- **Yapay zekâ desteği (isteğe bağlı).** Anthropic (Claude), OpenAI, Google Gemini ve OpenRouter ile çalışır. Bilgisayarında ücretsiz çalışan Ollama ve LM Studio ile ve OpenAI uyumlu her servisle de (Groq, Mistral, DeepSeek…) çalışır.
  - **Bu sayfayı genişlet:** mevcut lore'a uyan yeni içerik önerir.
  - **Eksik sayfa taslağı:** kırmızı bir bağlantı için, ona bağlantı veren sayfalardan yola çıkarak ilk taslağı yazar.
  - **Tutarlılık kontrolü:** tarih uyuşmazlığı ya da ölen bir karakterin sonradan ortaya çıkması gibi çelişkileri bulur ve ilgili sayfalara bağlantı verir.
  - Yanıtlar yazıldıkça akar. Sen gözden geçirip düzenleyip onaylamadan hiçbir şey kaydedilmez.
  - Yapay zekâ dünyanın içerik dilinde yazar.
  - Yalnızca ilgili sayfalar gönderilir: sayfanın kendisi, bağlantı verdiği ve ona bağlantı veren sayfalar, tutarlılık kontrolünde bir halka daha. Dünyanın tamamı asla gönderilmez.
- **Dışa aktarma ve yedekleme.** Her dünyanın ayarlarında:
  - **JSON yedek**: haritalar dahil her şey. Raftaki **Yedekten geri yükle** ile geri yükleyebilir, dünyayı değiştirebilir ya da kopya olarak içe aktarabilirsin.
  - **Markdown zip**: her sayfa için YAML başlık bilgisiyle bir `.md` dosyası, her bölüm ayrı klasörde; Obsidian ile çalışır.
  - **Tek HTML sayfası**: içindekiler ve çalışan bağlantılarla okunabilir, yazdırılabilir bir dosya.
  - Dışa aktarmalar yapay zekâ anahtarlarını asla içermez.
- **Geri bağlantılar.** Her sayfa, metninde ya da bilgi kutusunda ona bağlantı veren sayfaları listeler.
- **Bilgi kutuları (infobox).** Her bölümün alanları vardır; örneğin karakterler için doğum, tür, bağlılık ve yurdu.
  - Alan türleri: kısa ve uzun metin, sayı, dünya tarihi, sayfa bağlantısı (tek ya da çok), seçim listesi, etiketler, evet/hayır.
  - Sayfa bağlantısı alanları bağlantı sayılır; geri bağlantılarda ve kırmızı bağlantılarda görünür.
  - **Bölümleri düzenle** ekranından herhangi bir bölüme kendi alanlarını ekleyebilirsin.
  - Olay sayfalarının dünyanın takviminde bir tarih aralığı vardır.
- **Düzenleyici.** CodeMirror; `[[` otomatik tamamlama, önizleme ya da yan yana görünüm, Ctrl/⌘+S ile kaydetme ve kaydedilmemiş değişikliklerin kaybolmasına karşı uyarı.
- **Çok dilli arayüz.** İngilizce ve Türkçe hazır.
  - İlk açılışta tarayıcı dili algılanır, seçimin hatırlanır.
  - Tarih ve sayılar arayüz diline göre biçimlenir.
  - Düzenler CSS logical properties kullanır, bu yüzden sağdan sola yazılan diller de çalışır.
- **İçerik dili arayüz dilinden ayrıdır.** Arayüzü İngilizce kullanıp lore'u Türkçe yazabilirsin.
- **Aydınlık ve karanlık tema**, telefonlara uygun düzenler.

## Kurulum ve çalıştırma

Gereksinim: Node.js 20 veya üstü.

```bash
npm install
npm run dev
```

Vite'ın verdiği adresi aç (genellikle http://localhost:5173). İlk açılışta birbirine bağlı sayfalardan oluşan bir örnek dünyayı incelemek için **Örnek dünyayı aç**'ı seç ya da kendi dünyanı oluştur.

### Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusunu başlatır |
| `npm run build` | Tip denetimi yapar ve `dist/` klasörüne derler |
| `npm run preview` | Derlenmiş sürümü yerelde sunar |
| `npm test` | Birim testleri (Vitest) |
| `npm run i18n:check` | Eksik, fazla ya da bilinmeyen çeviri anahtarı varsa hata verir |
| `npm run css:check` | Fiziksel CSS özelliği varsa hata verir (RTL uyumluluğunu korur) |
| `npm run check` | Yukarıdakilerin hepsi ve lint |

## GitHub Pages'e yayınlama

`.github/workflows/deploy.yml`, `main` dalına yapılan her push'ta tüm denetimleri çalıştırır, uygulamayı derler ve yayınlar. Vite `base` ayarı depo adından alınır, bu yüzden uygulama `https://<kullanıcı>.github.io/<depo>/` adresinde açılır. Hash yönlendirme sayesinde doğrudan bağlantılar sunucu ayarı gerekmeden çalışır.

Bir kerelik ayar:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. Ücretsiz GitHub planında Pages'in çalışması için deponun public olması gerekir.

## Yapay zekâ sağlayıcıları

Yapay zekâ isteğe bağlıdır; geri kalan her şey onsuz da çalışır. Bir sağlayıcı kurmak için **Ayarlar → Yapay zekâ asistanları → Sağlayıcı ekle**'ye git, sağlayıcıyı seç, sonra:

1. API anahtarını yapıştır (yerel sağlayıcılar anahtar istemez).
2. **Modelleri yükle**'ye tıklayıp birini seç ya da model adını yaz.
3. **Bağlantıyı test et**'e tıkla.

Birden fazla sağlayıcı kaydedip birini varsayılan yapabilirsin. **İşe göre model** bölümünden her iş için ayrı model seçebilirsin; örneğin tutarlılık kontrolü için güçlü, taslaklar için hızlı ve ucuz bir model.

| Sağlayıcı | Varsayılan adres | Not |
|---|---|---|
| Anthropic (Claude) | `https://api.anthropic.com` | Anahtar: console.anthropic.com. Doğrudan tarayıcıdan çalışır. |
| OpenAI | `https://api.openai.com/v1` | Anahtar: platform.openai.com. |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta` | Anahtar: aistudio.google.com. |
| OpenRouter | `https://openrouter.ai/api/v1` | Tek anahtarla birçok model; model adları `anthropic/claude-sonnet-4.5` gibi. |
| Ollama (yerel, ücretsiz) | `http://localhost:11434` | Aşağıya bak. |
| LM Studio (yerel, ücretsiz) | `http://localhost:1234/v1` | LM Studio'da: Developer sekmesi → sunucuyu başlat → **CORS**'u aç. |
| Özel (OpenAI uyumlu) | servisin `/v1` adresi | Groq, Mistral, DeepSeek, Together… yerel proxy gerektirebilir. |

**Anahtarların nereye gider?** API anahtarları yalnızca tarayıcında, `worldledger-secrets` adlı ayrı bir IndexedDB veritabanında saklanır. Dışa aktarmalara, yedeklere ya da depoya asla girmez; yalnızca ayarladığın sağlayıcıya gönderilir.

### Ollama

[ollama.com](https://ollama.com)'dan kur, bir model indir ve tarayıcıların bağlanabilmesi için şöyle başlat:

```bash
ollama pull llama3.2
```

```bash
OLLAMA_ORIGINS="*" ollama serve
```

Yayındaki uygulamayı (GitHub Pages) kullanıyorsan `OLLAMA_ORIGINS` değerine `*` yerine o adresi yaz; örneğin `https://<kullanıcı>.github.io`. Windows'ta `OLLAMA_ORIGINS`'i bir ortam değişkeni olarak ayarla ve Ollama'yı yeniden başlat.

### Yerel proxy (tarayıcıları engelleyen servisler için)

Bazı servisler doğrudan bir web sayfasından gelen istekleri (CORS) reddeder. **Bağlantıyı test et** isteğin engellendiğini söylerse:

1. Worldledger ile gelen küçük proxy'yi çalıştır. Bağımlılığı yoktur, yalnızca `127.0.0.1:8787` üzerinde dinler ve hiçbir şey saklamaz:
   ```bash
   npm run proxy
   ```
2. Ayarlar'da o sağlayıcı için **Yerel proxy kullan**'ı işaretle.

Seçenekler:

- `PORT=9000 npm run proxy` başka bir port kullanır. Bu durumda **Ayarlar → Yerel proxy** altındaki proxy adresini de güncelle.
- `ALLOW_HOSTS=api.groq.com,api.mistral.ai npm run proxy` proxy'nin istek iletebileceği servisleri sınırlar.

Safari, https üzerinden sunulan sayfaların `http://localhost`'a istek atmasını engeller. Yayındaki uygulamada yerel modeller ve proxy için Chrome, Edge ya da Firefox kullan.

### Yapay zekâ sağlayıcısı eklemek (geliştiriciler için)

`src/core/ai/providers/` klasörüne, varsayılan olarak bir `AIProvider` dışa aktaran tek bir dosya ekle; kayıt sistemi onu kendiliğinden bulur.

- OpenAI tarzı bir API için `src/core/ai/lib/openaiCompatible.ts` içindeki `openAICompatible({ id, defaultBaseUrl, needsKey, browserFriendly })` neredeyse her şeyi yapar.
- Sağlayıcının adını ve yardım metnini `src/locales/*/ai.json` içinde `provider.<id>` altına ekle.
- İstemler (prompt'lar) `src/core/ai/prompts/` içindedir ve sağlayıcıdan bağımsızdır.

## Verilerin

Tüm dünyalar tarayıcının IndexedDB'sinde, `worldledger` adlı veritabanında durur. Hiçbir şey bilgisayarından çıkmaz. Uygulamanın site verilerini silersen dünyaların da silinir; bu yüzden arada bir her dünyanın ayarlarından JSON yedek indir.

## Yeni bir dil nasıl eklenir

Arayüz dilleri `src/locales/` klasöründen otomatik olarak bulunur. Örneğin Almanca eklemek için:

1. İngilizce klasörü kopyala:
   ```bash
   cp -r src/locales/en src/locales/de
   ```
2. `src/locales/de/meta.json` dosyasını düzenle:
   ```json
   { "name": "German", "nativeName": "Deutsch", "dir": "ltr" }
   ```
   Arapça ya da İbranice gibi sağdan sola yazılan diller için `"dir": "rtl"` kullan; düzen kendiliğinden aynalanır.
3. Klasördeki diğer JSON dosyalarının değerlerini çevir. Anahtarları ve `{{yer tutucuları}}` değiştirme.
   - Çoğul anahtarlar `_one` / `_other` ile biter. Dilin gerektiriyorsa `_zero`, `_two`, `_few` ya da `_many` ekle; bkz. [i18next çoğullar](https://www.i18next.com/translation-function/plurals).
4. Denetimi çalıştır:
   ```bash
   npm run i18n:check
   ```
   Eksik ya da fazla anahtarları ve uyuşmayan yer tutucuları bildirir.

Kod değişikliği gerekmez. Yeni dil, dil menüsünde ve **Ayarlar**'da görünür; tarayıcısı o dile ayarlı kullanıcılar için de otomatik seçilir.

## Proje yapısı

```
src/
├─ app/            Uygulama kabuğu: yönlendirme, üst bant, dünya düzeni, genel ekranlar
├─ core/
│  ├─ db/          Dexie (IndexedDB) şeması
│  ├─ i18n/        i18next kurulumu, dil keşfi, Intl biçimlendiricileri
│  └─ lore/        Alan katmanı: tipler, dünyalar, sayfalar, bağlantılar, takvim
│                  api.ts tüm modüllerin kullandığı okuma arayüzü
├─ modules/
│  ├─ registry.ts  Kurulu modüller (yönlendirmeler buradan bağlanır)
│  └─ encyclopedia/  1. modül: Lore Ansiklopedisi (ekranlar, bileşenler)
├─ ui/             Tasarım değişkenleri ve ortak arayüz bileşenleri
├─ locales/        Her arayüz dili için bir klasör
└─ sample-data/    Örnek dünyalar (İngilizce ve Türkçe)
scripts/           Depo denetimleri (i18n, logical CSS)
```

### Modül eklemek

İleride gelecek *NPC Personality Lab*, *Playtest Feedback Hub* ve *Store Page Studio* gibi modüller aynı şekilde eklenir:

1. `src/modules/<ad>/manifest.tsx` dosyasında bir `WorldledgerModule` dışa aktar. Bu dosya modülün `/w/:worldId/<basePath>` altındaki yönlendirmelerini tanımlar.
2. Modülü `src/modules/registry.ts` dosyasına ekle.
3. Lore'u `src/core/lore/api.ts` üzerinden oku; örneğin `getPages(worldId, { builtIn: 'character' })` ya da `getLinkedPages(id)`.
4. Modülün kendi tablolarına ihtiyacı varsa, `src/core/db/db.ts` dosyasında yeni bir Dexie sürümüyle ad alanlı tablolar ekle.
5. Çevirilerini her dil klasöründe yeni bir ad alanı dosyasına koy ve bu ad alanını `src/core/i18n/index.ts` dosyasına kaydet.

## Teknoloji

| Alan | Kütüphane |
|---|---|
| Uygulama | Vite, React 19, TypeScript, React Router (hash yönlendirme) |
| Depolama | IndexedDB üzerinde Dexie |
| Çeviri | i18next ve react-i18next |
| Markdown | react-markdown, remark-gfm, rehype-sanitize |
| Düzenleyici | CodeMirror 6 |
| Fontlar | Literata ve Archivo, Fontsource ile projeden sunulur |
