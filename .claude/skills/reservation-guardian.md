# Skill: reservation-guardian

## Amaç
Rezervasyon sistemini etkileyen her değişiklikten önce güvenlik ve iş kuralı denetimi yap.
Çift rezervasyon, timezone hatası, kural ihlali veya veri tutarsızlığına yol açacak değişiklikleri engelle.

## Tetikleyici
Kullanıcı rezervasyon oluşturma, iptal, eğitmen takvimi, slot yönetimi veya üyelik ders hakkıyla ilgili bir değişiklik yapmak istediğinde bu skili çalıştır.

## Adımlar

### 1. Değişiklik Kapsamı Tanımı
Önerilen değişikliği analiz et:
- Hangi RPC fonksiyonu değişiyor veya ekleniyor?
- Hangi tablolar etkileniyor?
- Hangi kullanıcı rolü bu işlemi tetikliyor?

### 2. Denetim Kontrol Listesi

**Çift Rezervasyon Riski**
- [ ] `create_reservation` veya benzeri RPC, aynı eğitmen + tarih + saat kombinasyonu için unique constraint veya transaction-level lock kullanıyor mu?
- [ ] İki eşzamanlı istek aynı slotu çift kitleyebilir mi?
- [ ] `trainer_schedules` ve `reservations` tabloları arasında tutarlılık sağlanıyor mu?

**Timezone Kullanımı**
- [ ] Tüm tarih/saat değerleri `Europe/Istanbul` (UTC+3) ile uyumlu mu?
- [ ] JavaScript'te `new Date()` kullanılıyorsa timezone açıkça belirtilmiş mi?
- [ ] SQL'de `NOW()` kullanılıyorsa Supabase'in UTC döndürdüğü göz önünde bulundurulmuş mu?
- [ ] Hafta sonu / hafta içi ayrımı doğru timezone'da mı yapılıyor?

**12 Saat İptal Kuralı**
- [ ] `cancel_reservation` RPC, ders saatinden 12 saat öncesini kontrol ediyor mu?
- [ ] Bu kontrol sadece UI'da değil, RPC içinde `RAISE EXCEPTION` ile zorunlu mu?
- [ ] Adminlerin bu kuralı bypass etme yetkisi var mı? (kasıtlıysa belgelenmiş mi?)

**Rezervasyon Durum Geçişleri**
Sadece aşağıdaki geçişlere izin verilmeli:
```
pending   → approved    (admin onayı)
approved  → completed   (ders tamamlandı)
approved  → no_show     (üye gelmedi)
approved  → cancelled   (iptal — 12 saat kuralına tabi)
pending   → cancelled   (onay öncesi iptal)
```
- [ ] Geçersiz durum geçişleri RPC'de engelleniyor mu? (ör. `completed → pending`)
- [ ] Durum değişikliği `attendance` tablosunu güncelliyor mu?

**Eğitmen Slot Değişikliklerinde Mevcut Rezervasyon Kontrolü**
- [ ] Bir eğitmen slotu kapatılıyorsa (`is_available = false`), o slotta mevcut `approved` rezervasyon var mı kontrolü yapılıyor mu?
- [ ] Varsa kullanıcıya uyarı gösterilmeden slot kapatılıyor mu?
- [ ] Eğitmen siliniyorsa (`deleted_at`) aktif rezervasyonları ne oluyor?

**Üyelik Ders Hakkı Senkronizasyonu**
- [ ] Rezervasyon oluşturulunca `memberships.reserved_lessons` artırılıyor mu?
- [ ] Rezervasyon iptal edilince `reserved_lessons` azaltılıyor mu?
- [ ] Ders tamamlanınca `used_lessons` artırılıyor mu ve `reserved_lessons` azaltılıyor mu?
- [ ] `total_lessons = used_lessons + reserved_lessons + kalan` dengesi korunuyor mu?
- [ ] Bu sayaç güncellemeleri aynı transaction içinde mi yapılıyor?

**Eğitmen Prim (Bonus) Etkisi**
- [ ] Değişiklik tamamlanmış ders sayısını etkiliyor mu?
- [ ] `reservations.status = 'completed'` ve `lesson_price_snapshot` verileri korunuyor mu?
- [ ] Geriye dönük prim hesaplamalarını bozacak bir veri değişikliği var mı?

### 3. Pazartesi Kapalı Kuralı
- [ ] `get_available_slots` RPC, Pazartesi günlerini filtreliyor mu?
- [ ] Bu kural sadece UI'da mı uygulanıyor, RPC'de de zorunlu mu?

### 4. Denetim Sonuç Formatı

```
REZERVASYON GÜVENLİK DENETİMİ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DEĞİŞİKLİK: <kısa açıklama>

✅ GEÇTİ:
- <madde>

⚠️  UYARI:
- <madde> → <önerilen aksiyon>

❌ ENGEL:
- <madde> → <bu düzeltilmeden devam edilemez>

SONUÇ: GÜVENLİ / UYARIYLA GÜVENLİ / ENGELLENDİ
```

### 5. Yapılmaması Gerekenler
- Denetim tamamlanmadan rezervasyon koduna değişiklik önerme.
- Timezone sorununu "sonra düzeltiriz" diyerek geçiştirme.
- 12 saat kuralını sadece UI'da uygulayan bir çözüm kabul etme.
- Sayaç güncellemelerini ayrı transaction'larda bırakma.
- Mevcut `completed` rezervasyonları etkileyen geriye dönük değişiklik yapma.
