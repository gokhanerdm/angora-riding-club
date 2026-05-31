# Skill: db-rpc

## Amaç
Yeni bir Supabase RPC geliştirmesine başlamadan önce standartları uygula ve şablonları üret.
Doğrudan tablo mutasyonu (INSERT/UPDATE/DELETE) önerme — tüm mutasyonlar RPC üzerinden geçmeli.

## Tetikleyici
Kullanıcı yeni bir veri yazma işlemi, yeni bir sayfa özelliği veya iş kuralı değişikliği tanımladığında bu skili çalıştır.

## Adımlar

### 1. İhtiyaç Analizi
Kullanıcının talebini aşağıdaki soruları yanıtlayarak analiz et:
- Bu işlem hangi tabloları etkiliyor?
- Kim çağırabilir? (admin / trainer / member)
- Transaction gerekiyor mu? (birden fazla tablo değişiyorsa evet)
- Soft delete uyumluluğu gerekiyor mu? (`deleted_at IS NULL` filtresi)

### 2. Kontrol Listesi (Çalıştırmadan Önce)

**RLS Etkileri**
- [ ] Etkilenen her tabloda RLS politikası var mı?
- [ ] RPC'yi çağıran rolün bu tablolara erişim yetkisi var mı?
- [ ] `SECURITY DEFINER` kullanılacaksa riski değerlendir (tüm tablolara tam erişim açılır).

**Yetkilendirme**
- [ ] Hangi `requireX()` guard'ı sayfada kullanılacak? (`requireAdmin` / `requireTrainer` / `requireMember`)
- [ ] RPC içinde `auth.uid()` ile sahiplik doğrulaması yapılıyor mu?

**Transaction İhtiyacı**
- [ ] Birden fazla tablo değişiyorsa `BEGIN / EXCEPTION / END` bloğu zorunlu.
- [ ] Kısmi başarı (partial success) senaryosu var mı? Varsa rollback stratejisi belirle.

**Soft Delete Uyumluluğu**
- [ ] `members`, `trainers`, `payment_transactions` sorgularında `deleted_at IS NULL` filtresi eklendi mi?
- [ ] Silinmiş kayıtlara referans veren foreign key'ler kontrol edildi mi?

### 3. Üretilecek Çıktılar

#### A — Postgres RPC Şablonu
```sql
-- Fonksiyon adı: snake_case, fiil ile başlar (create_, update_, cancel_, approve_)
CREATE OR REPLACE FUNCTION public.<fonksiyon_adi>(
  p_user_id UUID,
  -- diğer parametreler
)
RETURNS <dönüş_tipi>
LANGUAGE plpgsql
SECURITY INVOKER  -- Varsayılan; DEFINER gerekiyorsa gerekçe yaz
AS $$
DECLARE
  v_<değişken> <tip>;
BEGIN
  -- 1. Yetki kontrolü
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = p_user_id AND role = '<rol>'
  ) THEN
    RAISE EXCEPTION 'Yetkisiz erişim';
  END IF;

  -- 2. İş mantığı

  -- 3. Dönüş
  RETURN <sonuç>;

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;
```

#### B — TypeScript RPC Çağrı Örneği
```typescript
const { data, error } = await supabase.rpc('<fonksiyon_adi>', {
  p_user_id: session.user.id,
  // diğer parametreler
})

if (error) {
  console.error('<fonksiyon_adi> hatası:', error.message)
  // kullanıcıya Türkçe hata mesajı göster
  return
}
```

#### C — Auth Guard Kullanımı
```typescript
// Sayfa başında (server component):
const { user } = await requireAdmin()   // veya requireTrainer / requireMember
// user.id güvenle kullanılabilir
```

### 4. Yapılmaması Gerekenler
- Bileşen içinden doğrudan `.insert()` / `.update()` / `.delete()` çağırma.
- `SECURITY DEFINER` kullanımını gerekçesiz önerme.
- RPC dışında iş kuralı (ör. 12 saat iptal, slot uygunluğu) uygulama.

### 5. Sonuç Formatı
Analiz tamamlandığında şunu sun:
1. **RPC adı ve imzası** (parametreler + dönüş tipi)
2. **Transaction gerekli mi?** (Evet/Hayır + gerekçe)
3. **Kontrol listesi sonucu** (hangi maddeler geçti / uyarı var mı)
4. **SQL şablonu** (doldurulmuş)
5. **TypeScript çağrı örneği** (doldurulmuş)
6. **Auth guard** (hangi guard kullanılacak)
