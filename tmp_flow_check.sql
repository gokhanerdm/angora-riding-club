-- mark_attendance tanımı
SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'mark_attendance';

-- admin_cancel_reservation tanımı
SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'admin_cancel_reservation';

-- Şu an tarihi/saati geçmiş ama approved/pending kalan dersler (bugün dahil)
SELECT COUNT(*) AS bekleyen_gecmis,
  MIN(scheduled_date) AS en_eski_tarih,
  MAX(scheduled_date) AS en_yeni_tarih
FROM reservations
WHERE status IN ('approved', 'pending')
  AND (
    scheduled_date < CURRENT_DATE
    OR (scheduled_date = CURRENT_DATE AND end_time < (CURRENT_TIME AT TIME ZONE 'Europe/Istanbul'))
  );
