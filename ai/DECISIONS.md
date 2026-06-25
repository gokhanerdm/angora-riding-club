# AI Çalışma Kararları

Bu dosya AI sistemi içindeki metodoloji ve yaklaşım kararlarını kaydeder.
Teknik proje kararları için bkz. `/company/DECISIONS.md`

---

## Ajan Sistemi Kararları

### 2026-06-25 — AI İşletim Sistemi Kurulumu
**Karar:** `/company`, `/agents`, `/ai` klasörleriyle yapılandırılmış ajan sistemi
**Neden:** Ajan çalışmasını tutarlı, tekrarlanabilir ve öğretilebilir hale getirme
**Etki:** Tüm büyük işler bu yapıdan geçecek

### 2026-06-25 — Ajan Rolleri Tanımı
**Karar:** Product Owner, Architect, Developer, Reviewer, Security, Researcher
**Neden:** Her rolün sorumluluğu net olursa çakışma ve atlanma azalır
**Etki:** WORKFLOW_PROTOCOL büyük/riskli işlerde bu sırayı takip eder

### 2026-06-25 — Küçük İşlerde Hız Protokolü
**Karar:** Küçük işlerde ajan zinciri atlanır, doğrudan Developer çalışır
**Neden:** Tek satır fix için 5 ajan döngüsü overhead yaratır
**Etki:** Küçük iş tanımı WORKFLOW_PROTOCOL'de

---

## Metodoloji Kararları

### Önce Anla, Sonra Yap
Her talep için: yorumla → teyit al → uygula.
Bu iş akışı WORK_STYLE.md ve WORKFLOW_PROTOCOL.md'de zorunlu.

### Tek Kaynak Kuralı
Bir veri birden fazla yerde gösteriliyorsa hepsini aynı anda güncelle.
Araştırma adımı bu yüzden zorunlu.

---

## İş Kuralı Kararları

### 2026-06-25 — Yoklama Düzeltmesinde Ders Hakkı Geri Alınmaz
**Karar:** Bir ders 'tamamlandı' (completed) işaretlendikten sonra 'gelmedi'ye (no_show)
çevrilse bile, kullanılan ders hakkı (`used_lessons`) geri alınmaz.
**Neden:** Ders fiilen yapılmış/sayılmıştır; sonradan no_show düzeltmesi sayacı iade etmez.
Bu kasıtlı bir iş kuralıdır, bug değildir.
**Etki:** `mark_attendance` RPC'sinde `used_lessons` decrement'i yalnızca
`approved`/`pending` durumundan geçişte çalışır; `completed`'dan geçişte bilinçli olarak
çalışmaz. Bu davranışı "düzeltilmesi gereken hata" olarak ele alma.

---

## Öğrenme Kayıtları

### Öğrenme Kaydı #3 — Build/Deploy Doğrulama

Tarih: 2026-06-25

Olay:
Frontend build kırıldığı için production uzun süre eski sürümde kalmıştı. DB güncellemeleri canlıydı ama UI deploy edilemiyordu.

Kalıcı Karar:
UI/TypeScript etkileyen hiçbir iş, build/typecheck ve deploy doğrulaması yapılmadan tamamlanmış sayılmaz.

Çıkarılan Ders:
Kod değişmiş olabilir ama production güncellenmemiş olabilir. "Bitti" demek için sadece kodun yazılması değil, build'in geçmesi ve canlıda doğrulanması gerekir.
