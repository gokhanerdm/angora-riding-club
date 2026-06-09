-- Bugün, saati henüz gelmemiş ama completed olan dersler
SELECT r.id, r.scheduled_date, r.start_time, r.membership_id,
       m.name || ' ' || m.surname AS member_name
FROM reservations r
JOIN members m ON m.id = r.member_id
WHERE r.scheduled_date = CURRENT_DATE
  AND r.status = 'completed'
  AND r.start_time > (CURRENT_TIME AT TIME ZONE 'Europe/Istanbul')
ORDER BY r.start_time;
