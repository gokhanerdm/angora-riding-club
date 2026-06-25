# İnceleme Kontrol Listesi

Her kod değişikliği tesliminde Reviewer bu listeyi uygular.

---

## Zorunlu Kontroller (Bunlardan biri başarısız → revizyon)

### Auth & Güvenlik
- [ ] Server page'in ilk satırı auth guard (`requireAdmin` / `requireTrainer` / `requireMember`)
- [ ] Rol kontrolü `profiles.role` üzerinden — client iddiasına güvenilmiyor
- [ ] Hassas veri client'a sızmıyor (servis key, secret)

### Veritabanı Erişimi
- [ ] Mutasyonlar RPC üzerinden — doğrudan `.insert()` / `.update()` / `.delete()` yok
- [ ] Soft delete tabloları sorgulanıyorsa `WHERE deleted_at IS NULL` mevcut
- [ ] Supabase client: server component'ta `server.ts`, client component'ta `client.ts`

### Rezervasyon İş Kuralları (rezervasyon ile ilgili değişikliklerde)
- [ ] Durum geçişleri sadece izin verilen sırada: `pending→approved→completed/no_show/cancelled`
- [ ] 12 saatlik iptal kuralı RPC'de — sadece UI'da uygulanmıyor
- [ ] Pazartesi kapalı kuralı korunuyor

### Timezone
- [ ] `new Date()` çağrılarında timezone explicit (`Europe/Istanbul`)
- [ ] `toDayKey()` ve `getWeekDays()` doğru kullanılıyor

### UI / Frontend
- [ ] Kullanıcıya görünen tüm metinler Türkçe
- [ ] `'use client'` sadece gerçekten etkileşimli bileşende
- [ ] Koyu tema renkleri tutarlı (`#0a0f2e`, `#0d1b4b`, `#f59e0b`)
- [ ] Tailwind v4 syntax — `tailwind.config.js` değil, `globals.css` içinde `@theme`

### Build / Deploy (frontend/UI değişikliğinden sonra zorunlu)
- [ ] `tsc --noEmit` veya eşdeğer tip kontrolü geçmeli
- [ ] `next build` geçmeli
- [ ] Deploy sonrası canlı ortamın güncellendiği doğrulanmalı
- [ ] Vercel build failed ise iş tamamlandı sayılmaz

### Metrik / Ground-Truth (sayı/sayaç/toplam değişikliğinde zorunlu)
- [ ] Yeni veya değişen her metrik/sayaç/toplam için: DB'den doğrudan sorguyla ground truth alınır, ekrandaki değerle karşılaştırılır, eşleşmiyorsa onay verilmez.

---

## Kalite Kontrolleri (Bunlar öneri, zorunlu değil)

- [ ] Gereksiz yorum satırı yok — WHY belli değilse yaz, WHAT değil
- [ ] TypeScript tip hataları yok
- [ ] Tekrar eden kod — soyutlama için gereksinim kanıtlanmış mı?
- [ ] Kapsam: sadece istenen iş yapıldı, ekstra eklenmedi

---

## Riskli Değişiklik İşaretleri (Security'e ilet)

- RPC `SECURITY DEFINER` kullanıyorsa
- RLS policy değişikliği
- Auth akışı değişikliği
- Migration yetki değişikliği
