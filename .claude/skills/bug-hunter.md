# Skill: bug-hunter

## Amaç
Kod değiştirmeden önce kök neden analizi yap. Sorunu kaynağında tespit et, etkilenecek dosyaları listele, minimum değişiklik prensibini uygula.

## Tetikleyici
Kullanıcı bir hatayı, beklenmedik davranışı veya veri tutarsızlığını raporladığında bu skili çalıştır.

## Adımlar

### 1. Semptom Tanımı
Kullanıcının tanımladığı sorunu tek cümleyle yeniden ifade et:
- Ne oluyor? (gözlemlenen davranış)
- Ne olması gerekiyor? (beklenen davranış)
- Ne zaman oluyor? (tetikleyici koşul)

### 2. Kök Neden Analizi

Aşağıdaki katmanları sırayla incele:

**Katman 1 — Veri Katmanı**
- İlgili Supabase tabloları ve sütunları neler?
- RPC fonksiyonu var mı? SQL'i doğrudan incele.
- `deleted_at` filtresi eksik olabilir mi?
- `is_current`, `reserved_lessons`, `used_lessons` gibi flag/counter'lar desync olmuş olabilir mi?

**Katman 2 — Auth / Yetki Katmanı**
- Hangi `requireX()` guard'ı devrede?
- `auth.uid()` doğru kullanıcıyı mı döndürüyor?
- RLS politikası bu senaryoyu kapsıyor mu?

**Katman 3 — Uygulama Katmanı**
- Hangi bileşen veya sayfa tetikliyor? (server component mu, client component mi?)
- State yönetimi var mı? (React state'i stale olabilir mi?)
- Supabase RPC çağrısında hata yutulmuş mu? (`error` kontrolü var mı?)

**Katman 4 — Timezone / Tarih**
- Tarih karşılaştırması var mı?
- `new Date()` veya `toISOString()` kullanılmış ama `Europe/Istanbul` belirtilmemiş mi?
- Hafta başlangıcı (Pazartesi) hesabında boundary hatası var mı?

### 3. Kontrol Listesi

**Yan Etkiler**
- [ ] Bu düzeltme başka bir sayfayı veya bileşeni kırar mı?
- [ ] Aynı RPC fonksiyonunu başka yerler çağırıyor mu?
- [ ] Veri formatı değişiyorsa TypeScript tip uyumu kontrol edildi mi?

**Kırılabilecek Akışlar**
- [ ] Admin → onay akışı etkileniyor mu?
- [ ] Üye → rezervasyon akışı etkileniyor mu?
- [ ] Eğitmen → takvim akışı etkileniyor mu?
- [ ] Ödeme kaydı etkileniyor mu?

**Veri Bütünlüğü Riskleri**
- [ ] Düzeltme mevcut kayıtları bozar mı?
- [ ] Migration veya data fix gerekiyor mu?
- [ ] Soft delete kayıtları düzeltmeden etkileniyor mu?

**Mobil Etkiler**
- [ ] Sorun masaüstünde mi, mobilede mi, ikisinde de mi görülüyor?
- [ ] Touch event'leri veya viewport boyutu tetikleyici olabilir mi?
- [ ] Bottom-sheet modal'lar veya responsive grid'ler etkileniyor mu?

**Auth Etkileri**
- [ ] Sorun sadece belirli bir rolde mi oluşuyor? (admin / trainer / member)
- [ ] Session yenileme sonrası kayboluyor mu?
- [ ] RLS politikasında rol farkı var mı?

### 4. Etkilenen Dosyalar

Analiz sonucunda şu formatla listele:

```
ETKİLENEN DOSYALAR:
- app/<path>/page.tsx        → <neden etkileniyor>
- components/<path>.tsx      → <neden etkileniyor>
- lib/auth/<file>.ts         → <neden etkileniyor>
[Supabase RPC: <fonksiyon_adi>] → <neden etkileniyor>
```

### 5. Minimum Değişiklik Planı

Şu formatla sun:

```
KÖK NEDEN: <tek cümle>

DEĞİŞTİRİLECEK: <dosya adı ve satır aralığı>
DEĞİŞTİRİLMEYECEK: <etkilenen ama dokunulmaması gereken dosyalar>

TAHMİNİ DEĞİŞİKLİK BOYUTU: <Küçük (1-5 satır) / Orta (5-20 satır) / Büyük (20+ satır)>

ÖNCE DOĞRULANMASI GEREKEN: <uygulamadan önce Supabase'de veya logda kontrol edilmesi gereken şey>
```

### 6. Yapılmaması Gerekenler
- Kök nedeni bulmadan düzeltme önerme.
- Birden fazla sorunu aynı anda çözmeye çalışma.
- "Güvenlik için" veya "ileride lazım olur" gerekçesiyle kapsam dışı değişiklik yapma.
- Semptom gizleyen workaround'lar önerme (ör. try/catch ile hatayı yutma).
