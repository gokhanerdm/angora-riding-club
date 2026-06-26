# İş Akışı Protokolü

Bu dosya hangi işin nasıl yürütüleceğini tanımlar.
Orchestrator her olayı sınıflandırır ve doğru ajan zincirini tetikler.

---

## Orchestrator Rolü

Orchestrator, bir talep geldiğinde devreye giren koordinasyon katmanıdır.
Kod yazmaz, araştırma yapmaz — sınıflandırır, yönlendirir, durur.

**Sorumlulukları:**
- Gelen talebi olay sınıfına ata
- Doğru ajan zincirini başlat
- Durak noktalarında kullanıcıya sor, cevap gelene kadar bekle
- Ajan zincirleri arasında bağlamı taşı

**Karar verme biçimi:**
Orchestrator yorumunu 1–2 cümlede söyler: "Bunu X olarak sınıflandırdım, şöyle ilerleyeceğim, tamam mı?"
Kullanıcı onaylamadan büyük/riskli işte bir adım atmaz.

---

## Olay Sınıfları

### S0 — Anlık Fix
**Tetikleyici:** Typo, tek satır metin değişikliği, bariz stil hatası.
**Kural:** Orchestrator devreye girmez. Developer sessizce uygular, "bitti" der.

---

### S1 — Normal İş
**Tetikleyici:** 1–3 dosya, net gereksinim, düşük risk, geri dönüşü kolay.
Örnekler: yeni form alanı, filtre ekleme, mevcut RPC'ye parametre ekleme, UI bileşeni değişikliği.

**Orchestrator kararı:** "Bunu S1 olarak aldım, Developer başlıyor — tamam mı?" (1 cümle teyit)

**Zincir:**
```
Developer → Reviewer → Bitti
```

**Durak:** Tamamlanınca kısa bildir.

---

### S2 — Büyük İş
**Tetikleyici:** Yeni özellik, yeni RPC, yeni tablo, birden fazla rol etkisi, DB şema değişikliği.

**Orchestrator kararı:** Önce Researcher'ı çalıştırır, sonra plan sunar, onay alır.

**Zincir:**
```
Researcher → Architect → [DURAK: Plan onayı] → Developer → Reviewer → [DURAK: Final onay] → Deploy
```

**Durak kuralı:** Plan onaylanmadan tek satır kod değişmez.
Plan değişirse: yeni planı sun, yeni onay al.

---

### S3 — Riskli İş
**Tetikleyici:** Geri dönüşü zor, production verisi etkili, yetki değişikliği, auth/RLS değişikliği, migration.
Örnekler: veri silme/taşıma, RPC'ye rol kontrolü ekleme, kritik iş kuralı değişikliği.

**Orchestrator kararı:** "Bu S3. Şunu yapacağız, riski şu, geri alma planı şu — devam edelim mi?" — açık onay olmadan ilerleme.

**Zincir:**
```
Researcher → Architect + Security → [DURAK: Risk onayı]
→ Developer (adım adım) → Reviewer + Security → [DURAK: Production onayı]
→ Deploy (düşük trafikli saatte)
```

**Adım kuralı:** Her adım öncesi "yapıyorum", her adım sonrası "yapıldı, durum şu".
Beklenmedik sonuç: DUR — kullanıcıya bildir, devam etme.
Geri alma planı her zaman hazırda.

---

### S4 — Güvenlik Olayı
**Tetikleyici:** Auth bypass şüphesi, RLS açığı, hassas veri sızıntısı, doğrulanmış güvenlik bulgusu.

**Orchestrator kararı:** Security'i çağır. Başka hiçbir iş paralel yürümez.

**Zincir:**
```
Security (denetim/doğrulama) → Researcher (best-practice kontrolü)
→ Architect (fix planı) → [DURAK: Plan onayı]
→ Developer → Reviewer + Security → [DURAK: Final onay]
→ Deploy
```

**Security sonrası Researcher görevi:**
Security bir açık tespit edip fix planı çıktıktan sonra Researcher şu soruları yanıtlar:
- Aynı pattern başka RPC'lerde / sayfalarda tekrar ediyor mu?
- Önerilen fix, bu projenin geri kalanıyla tutarlı mı?
- Benzer iş kuralı zaten başka bir yerde doğru uygulanmış mı? (referans al)

Bu adım, tek bir fix yapılırken sistematik açıkların atlanmasını önler.

---

## Researcher Ne Zaman Devreye Girer?

| Durum | Researcher |
|-------|-----------|
| S0, S1 | Girmez |
| S2 başında | Etkilenen dosyaları ve mevcut yapıyı tarar |
| S3 başında | Tam kapsam haritası çıkarır |
| S4'te Security'den sonra | Best-practice kontrolü ve pattern tarama yapar |
| Herhangi bir sınıfta beklenmedik bulgu | "Şunu gördüm, söyleyeyim" — araştırır, değiştirmez |

**Researcher altın kuralı:** Tahmin yürütmez. Dosyayı açar, kodu okur, DB'yi sorgular — sonra konuşur.

---

## Codex / Harici Araç Ne Zaman Devreye Girer?

Codex veya başka bir harici AI aracı yalnızca şu durumlarda:

| Durum | Codex |
|-------|-------|
| Büyük miktarda boilerplate üretimi (migration şablonu, tip dosyası) | Evet |
| Başka projelerden araştırma veya karşılaştırma | Evet |
| Bu sistemin dışında prototip denemesi | Evet |
| Rutin özellik geliştirme | Hayır |
| Güvenlik fix'i | Hayır |
| Production migration | Hayır |

**Kural:** Codex çıktısı, bu projeye girmeden önce Reviewer kontrolünden geçer.
Codex doğrudan production'a kod göndermez.

---

## Günlük İşlerde Sessizlik Kuralı

- S0 ve S1'de ajan geçişini kullanıcıya anlatma — sadece sonuç
- "Developer çalışıyor, Reviewer kontrol etti" gibi süreç raporu verme
- Beklenmedik bulgu varsa: "şunu gördüm, devam mı?" — uzun analiz değil
- Bloke olunursa: "şu nedenle devam edemiyorum, şu gerekiyor" — net ve kısa

---

## Özet Tablo

| Sınıf | Tetikleyici | Orchestrator | Zincir | Durak |
|-------|-------------|--------------|--------|-------|
| S0 | Typo / tek satır | Yok | Developer | Yok |
| S1 | 1–3 dosya, net, düşük risk | 1 cümle teyit | Dev → Rev | Tamamlanınca |
| S2 | Yeni özellik / DB değişikliği | Plan sunar, onay alır | Res → Arch → Dev → Rev | Plan + Final |
| S3 | Geri dönüşü zor / production etkili | Risk onayı alır | Res → Arch+Sec → Dev → Rev+Sec | Her kritik adım |
| S4 | Güvenlik bulgusu | Security önce, paralel iş yok | Sec → Res → Arch → Dev → Rev+Sec | Plan + Final |

---

## Model Seçim Kuralları

**Model adı değil, yetenek adı kullan.**
Protokol modelden bağımsız kalsın.

### L1 — Basit Görevler

(UI düzeni, metin değişikliği, küçük hata düzeltmeleri)

→ Hızlı Üretim Modeli

---

### L2 — Normal Geliştirme

(Yeni sayfa, yeni bileşen, standart RPC, CRUD işlemleri)

→ Hızlı Üretim Modeli

---

### L3 — Derin Düşünme Gerektiren İşler

(Mimari kararlar, yeni sistem tasarımı, büyük refactor, performans analizi, veri modeli değişiklikleri, AI işletim sistemi geliştirme)

Akış:

Derin Düşünme Modeli → planlama

↓

Hızlı Üretim Modeli → uygulama

↓

Reviewer → mimari ve uygulama tutarlılığı kontrolü

---

### L4 — Güvenlik ve Kritik Veri

(Yetkilendirme, ödeme, üyelik, RLS, SECURITY DEFINER, migration)

Akış:

Hızlı Üretim Modeli → uygulama

↓

Reviewer

↓

Security

↓

Codex → bağımsız denetim

---

## Orchestrator Kuralları (Model Seçimi)

Her görevde önce işin seviyesini belirle.

Çıktıda mutlaka göster:

* İş seviyesi (L1–L4)
* Önerilen model türü
* Bu seviyenin neden seçildiği
* Çalışacak ajan zinciri

Modeli kendisi değiştiremez.

Claude Code modeli otomatik değiştiremez; yalnızca öneride bulunabilir.

Son karar kullanıcıya aittir.

---

## Referans Notu

Model isimleri protokolün parçası değildir.

Güncel eşleştirme yalnızca referans amaçlıdır.

Örnek:

* Hızlı Üretim Modeli → Sonnet
* Derin Düşünme Modeli → Opus

İleride farklı modeller kullanıldığında yalnızca bu referans güncellenir; WORKFLOW_PROTOCOL.md değişmez.
