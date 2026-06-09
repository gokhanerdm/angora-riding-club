-- Burcu'nun paket2 rezervasyonlarını kontrol et
SELECT r.id, r.status, r.scheduled_date, r.membership_id
FROM reservations r
WHERE r.membership_id IN (
  'c36bd8e7-afd9-45ca-96bf-578c1984a206',  -- paket1 (12 ders)
  'fed4ba6c-d562-4a22-a723-c21b442afb0b'   -- paket2 (20 ders)
)
ORDER BY r.membership_id, r.scheduled_date;
