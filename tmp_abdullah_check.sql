SELECT m.id AS member_id, m.name, m.surname,
       r.id AS reservation_id, r.scheduled_date, r.start_time, r.end_time, r.status, r.updated_at
FROM members m
JOIN reservations r ON r.member_id = m.id
WHERE m.surname ILIKE '%keskin%' AND m.name ILIKE '%abdullah%'
ORDER BY r.scheduled_date DESC;
