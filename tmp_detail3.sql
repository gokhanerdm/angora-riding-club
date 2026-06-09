-- Burcu Kocatürk
SELECT ms.id, ms.total_lessons, ms.used_lessons, ms.start_date, ms.end_date, ms.is_current
FROM members m JOIN memberships ms ON ms.member_id = m.id
WHERE m.name ILIKE '%burcu%' AND m.surname ILIKE '%koca%'
ORDER BY ms.start_date;

-- Mahmure Esenkal
SELECT ms.id, ms.total_lessons, ms.used_lessons, ms.start_date, ms.end_date, ms.is_current
FROM members m JOIN memberships ms ON ms.member_id = m.id
WHERE m.name ILIKE '%mahmure%'
ORDER BY ms.start_date;

-- Şevval Çetintaş
SELECT ms.id, ms.total_lessons, ms.used_lessons, ms.start_date, ms.end_date, ms.is_current
FROM members m JOIN memberships ms ON ms.member_id = m.id
WHERE m.name ILIKE '%şevval%'
ORDER BY ms.start_date;
