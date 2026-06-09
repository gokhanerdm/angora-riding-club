SELECT id, total_lessons, used_lessons, start_date, end_date, is_current
FROM memberships
WHERE member_id = 'ba171ae3-6909-4f44-9eea-8f030e821df1'
ORDER BY start_date;
