-- Şevval Çetintaş: 2 Haziran dersi ekleniyor (Ömer Faruk Kılıç, 16:00-16:30)
-- Paket1'in son boş slotu kullanılıyor (fe7ced56, 4 ders toplam, 3 kullanılmış)
INSERT INTO reservations (
  member_id, membership_id, trainer_id,
  scheduled_date, start_time, end_time, status, type
)
SELECT
  m.id,
  'fe7ced56-24a1-4b14-b0e2-52b852f896d7',
  'a59a033b-0ca9-4b38-9c95-b4474b098a3a',
  '2026-06-02',
  '16:00:00',
  '16:30:00',
  'completed',
  'general'
FROM members m
WHERE m.name ILIKE '%şevval%'
LIMIT 1;

UPDATE memberships SET used_lessons = 4 WHERE id = 'fe7ced56-24a1-4b14-b0e2-52b852f896d7';
