-- is_current kolonunun tipini kontrol et
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'memberships' AND column_name = 'is_current';

-- Şevval paketleri ham sorgu
SELECT id, used_lessons, total_lessons, end_date, is_current,
  pg_typeof(is_current) AS is_current_type
FROM memberships
WHERE member_id = (SELECT id FROM members WHERE name ILIKE '%şevval%' LIMIT 1);
