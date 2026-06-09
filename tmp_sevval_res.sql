SELECT r.id, r.scheduled_date, r.start_time, r.end_time, r.status, r.membership_id
FROM reservations r
JOIN members m ON m.id = r.member_id
WHERE m.name ILIKE '%şevval%'
ORDER BY r.scheduled_date DESC;
