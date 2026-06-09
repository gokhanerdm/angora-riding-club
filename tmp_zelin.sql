SELECT ms.id, ms.total_lessons, ms.used_lessons, ms.start_date, ms.end_date, ms.is_current
FROM members m JOIN memberships ms ON ms.member_id = m.id
WHERE m.name ILIKE '%zelin%'
ORDER BY ms.start_date;
