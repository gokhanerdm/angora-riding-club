@AGENTS.md

# Angora Binicilik Spor Kulübü

Next.js 16 (App Router) + Supabase + TypeScript ile geliştirilmiş kulüp yönetim sistemi.
Roller: admin, trainer, member. Dil: Türkçe (tr-TR). Tema: koyu (dark-first).

## Proje Yapısı

- `/app` — Next.js App Router sayfaları (varsayılan server component)
- `/components` — Client component'lar (`'use client'` zorunlu)
- `/lib/auth` — Sunucu taraflı rol guard'ları (`requireAdmin`, `requireTrainer`, `requireMember`)
- `/lib/supabase` — Supabase client factory'leri (`client.ts` = tarayıcı, `server.ts` = SSR)
- `/lib/lessons` — Tarih/saat yardımcı fonksiyonları
- `/supabase/migrations` — Veritabanı migration SQL dosyaları

## Veritabanı Kuralları

- Tüm mutasyonlar Supabase RPC üzerinden geçer — bileşenden doğrudan `.insert()` / `.update()` / `.delete()` çağırma
- Soft delete kullanan tablolar: `members`, `trainers`, `payment_transactions` — sorgularda `WHERE deleted_at IS NULL` zorunlu
- Rezervasyon durum geçişleri yalnızca şu sırada olabilir:
  - `pending → approved → completed`
  - `pending → approved → no_show`
  - `pending → approved → cancelled` (12 saat kuralına tabi)
  - `pending → cancelled`
- `memberships.is_current` manuel set edilmez; `trg_sync_membership_is_current` trigger'ı otomatik günceller
- Onay işlemleri `approve_membership_request_with_payment` RPC ile yapılır — elle tablo güncellemesi yapma

## Auth Kuralları

- Her server page'in ilk satırı `requireAdmin()` / `requireTrainer()` / `requireMember()` olmalı
- Rol `profiles.role` sütunundan okunur — client'tan gelen rol iddiasına güvenme
- Üye kaydı `complete_signup` RPC ile atomik yapılır — ayrı `profiles` + `members` insert çağırma

## Rezervasyon Kuralları

- Tüm tarih/saat işlemlerinde `Europe/Istanbul` timezone'u açıkça belirt
- `lib/lessons/week.ts` içindeki `toDayKey()` ve `getWeekDays()` Istanbul timezone'unu kullanır
- Pazartesi kapalıdır — `get_available_slots` RPC'de ve UI'da uygulanır
- 12 saatlik iptal kuralı `cancel_reservation` RPC içinde zorunludur — sadece UI'da uygulama

## Kodlama Standartları

- Türkçe UI metinleri — kullanıcıya görünen hiçbir İngilizce metin olmaz
- Koyu tema: birincil arka plan `#0a0f2e` / `#0d1b4b`, accent amber `#f59e0b`
- Tailwind v4 — `tailwind.config.js` yok; config `globals.css` içinde `@theme` ile tanımlanır
- Yorum satırı yalnızca WHY açıkça belli değilse yazılır
- Yeni Supabase client oluşturma: `lib/supabase/` dışında yapma

## Yapılmaması Gerekenler

- `new Date()` kullanırken timezone belirtmemek
- `is_current` bayrağını elle set etmek
- Rezervasyon durumunu RPC dışından güncellemek
- `complete_signup` yerine ayrı ayrı `profiles` + `members` insert çağırmak
- Prim (bonus) hesabını etkileyen `completed` rezervasyonları geriye dönük değiştirmek
- Migration yazmadan doğrudan Supabase SQL editor'da schema değişikliği yapmak

## Custom Skill'ler

- `/db-rpc` — Yeni RPC geliştirmesi için SQL şablonu + TypeScript örneği üretir
- `/bug-hunter` — Kök neden analizi, etkilenen dosyalar, minimum değişiklik planı
- `/reservation-guardian` — Rezervasyon değişikliklerinde iş kuralı ve güvenlik denetimi
