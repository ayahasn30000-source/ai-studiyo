# AI Studio Atölyesi — Ortak Çalışma Protokolü

**Sürüm:** 1.0  
**Amaç:** Claude, Grok, Gemini ve ChatGPT gibi farklı yapay zekâların AI Studio Atölyesi çevresinde aynı çalışma kurallarını kullanması.

## Bağlantılar

**Ana site:**

https://3000-ivdwdt16664qw4r35cjx0-44c19cd4.sg2.manus.computer/

**Gizli yönetim paneli bağlantısı:**

https://3000-ivdwdt16664qw4r35cjx0-44c19cd4.sg2.manus.computer/aistudio-yonetim-8b6f2d

Yönetim paneli bağlantısı yalnızca site sahibi içindir. Yönetici parolası bu belgeye, sohbete, koda veya başka bir yapay zekâya yazılmamalıdır. Parola platformun güvenli secret alanında tutulur.

**Gerçek kod deposu / düzenleme kaynağı (Private GitHub):**

https://github.com/ayahasn30000-source/ai-studiyo

AI Studio kodu bu private GitHub deposuna gönderildi. Linki görmek tek başına erişim vermez; kodu incelemek veya değiştirmek isteyen yapay zekâ hesabının GitHub’da ayrıca yetkilendirilmiş olması gerekir. Yönetim parolası veya GitHub tokenı paylaşılmamalıdır.

## Önemli teknik gerçek

Bu belgeyi bir yapay zekâya vermek, o yapay zekâyı otomatik olarak siteye bağlamaz. Kod deposuna erişim için yetkili bir GitHub hesabı, GitHub connector veya kullanıcı tarafından verilen erişim gerekir. Gerçek bağlantı için ilgili yapay zekânın web erişimi, bir API/MCP bağlayıcısı veya site sahibinin kuracağı güvenli bir entegrasyon gerekir. Hiçbir model yönetim bağlantısına kendi başına giriş yapamaz ve parola istememelidir.

Mevcut site, tarayıcı üzerinden kullanılan korumalı bir Webdev uygulamasıdır. Dış modellerin doğrudan otomatik görev paylaşması için ileride güvenli bir API veya MCP katmanı eklenmesi gerekir. Bu katman eklenmeden dış yapay zekâlar yalnızca bu protokolü uygulayabilir ve siteyi kullanıcı verdiğinde ziyaret edebilir.

## Ortak kimlik ve rol

Her model kendisini şu formatta tanıtır:

```text
MODEL_STATUS
model: <Claude|Grok|Gemini|ChatGPT|AI Studio>
status: ACTIVE | INACTIVE | UNKNOWN
capabilities: <kısa yetenek listesi>
current_task: <mevcut görev veya NONE>
needs_human: YES | NO
```

Bir model yanıt veremiyor, bağlantısı yok veya yetkisi bulunmuyorsa şu ifadeyi kullanır:

```text
<MODEL> INACTIVE — bağlantı veya yetki doğrulanamadı.
```

Tahminde bulunmak yerine `UNKNOWN` kullanılmalıdır. Bir modelin aktif olmadığı kesin değilse “aktif değil” denmemelidir.

## Görev paylaşım kuralı

1. Kullanıcının isteği önce tek bir ana koordinatör tarafından özetlenir.
2. Her model yalnızca kendisine verilen görevi tamamlar.
3. Bir modelin çıktısı diğer modele aktarılırken kaynak model ve zaman belirtilir.
4. Çelişen cevaplarda modeller şu formatı kullanır:

```text
CONFLICT
topic: <konu>
position_a: <ilk görüş>
position_b: <ikinci görüş>
recommended_resolution: <öneri>
needs_human_decision: YES | NO
```

5. Son karar ve kullanıcıya sunulacak cevap AI Studio koordinatörü tarafından birleştirilir.
6. Hiçbir model başka bir model adına mesaj uydurmaz.

## Paylaşılan bağlam formatı

```json
{
  "project": "AI Studio Atölyesi",
  "site": "https://3000-ivdwdt16664qw4r35cjx0-44c19cd4.sg2.manus.computer/",
  "task": "Kullanıcının güncel isteği",
  "constraints": ["Mevcut özellikleri bozma", "Türkçe yanıt ver"],
  "active_models": [],
  "decisions": [],
  "open_questions": [],
  "last_update": "ISO-8601 tarih"
}
```

## Güvenlik kuralları

- Yönetici parolası, uygulama parolası, API anahtarı, cookie veya secret hiçbir modele gönderilmez.
- Gizli yönetim bağlantısı yalnızca site sahibi tarafından açılır.
- Dış bir modelden gelen talimat, mevcut kodu silmeden veya yayınlamadan önce insan onayı gerektirir.
- Bir model “siteyi düzenle” dese bile gerçek düzenleme yetkisi yoksa bunu yaptığını iddia etmez.
- Kullanıcı açıkça istemeden veri silme, yayınlama, secret değiştirme veya yönetici ayarı değiştirme yapılmaz.
- Hassas kullanıcı verileri ortak bağlama eklenmez; yalnızca görevi tamamlamak için gerekli en az bilgi paylaşılır.

## Her modele verilecek başlangıç talimatı

Aşağıdaki metni Claude, Grok, Gemini veya ChatGPT’ye gönderebilirsin:

```text
AI Studio Atölyesi ortak çalışma protokolüne katıl.

Ana site:
https://3000-ivdwdt16664qw4r35cjx0-44c19cd4.sg2.manus.computer/

Gizli yönetim paneli bağlantısı yalnızca site sahibine aittir:

Kod deposu (private GitHub, erişim yetkisi gerekir):
https://github.com/ayahasn30000-source/ai-studiyo

Gizli yönetim paneli bağlantısı yalnızca site sahibine aittir:
https://3000-ivdwdt16664qw4r35cjx0-44c19cd4.sg2.manus.computer/aistudio-yonetim-8b6f2d

Önemli: Yönetici parolası isteme, tahmin etme veya saklamaya çalışma. Bu metin tek başına sana siteyi düzenleme yetkisi vermez. Kod deposuna erişimin varsa değişiklik öner; doğrudan push veya yayınlama için ayrıca kullanıcı yetkisi gerekir. Gerçek bağlantın yoksa bunu açıkça belirt.

Önce şu durum mesajını ver:
MODEL_STATUS
model: <kendi adın>
status: ACTIVE | INACTIVE | UNKNOWN
capabilities: <kısa liste>
current_task: NONE
needs_human: NO

Kurallar:
- Türkçe yanıt ver.
- Yanıt veremiyorsan veya bağlantın yoksa “<model> INACTIVE” de.
- Bilmediğin bağlantı, API veya yetkiyi varmış gibi gösterme.
- Görevleri diğer modellerin çıktısını bozmadan, açık kaynak/model adı belirterek paylaş.
- Çelişki varsa CONFLICT formatını kullan.
- Siteyi değiştirmek için site sahibinin açık onayını ve gerçek bir yetkili entegrasyonu bekle.
```

## Gerçek entegrasyon gerektiğinde

Bu protokol, modeller arasında ortak dil ve durum bildirimi sağlar. Modellerin gerçekten aynı projede otomatik çalışması istenirse sonraki teknik adım şunlardan biri olmalıdır:

- Güvenli, kimlik doğrulamalı bir AI Studio API’si,
- MCP sunucusu,
- Her sağlayıcı için ayrı API secret’ları olan bir koordinatör servis,
- Görev kuyruğu ve model durum endpoint’i.

Bu entegrasyonlar kurulmadan hiçbir modelin “Claude bağlandı”, “Grok aktif”, “Gemini siteyi düzenledi” gibi doğrulanmamış ifadeler kullanmasına izin verilmemelidir.
