SELECT id, total_lessons, used_lessons, start_date, end_date, is_current
FROM memberships
WHERE member_id = '8ff5f105-9558-4463-88c9-3a637efb3e80'
ORDER BY start_date;
