SELECT id, name, surname, member_status, created_at
FROM members
WHERE member_status = 'pending_club_approval'
  AND deleted_at IS NULL
ORDER BY created_at;
