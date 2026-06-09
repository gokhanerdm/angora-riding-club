SELECT id, name, surname, member_status, deleted_at FROM members
WHERE name ILIKE '%hac%' OR name ILIKE '%ali%ç%' OR surname ILIKE '%çiçek%'
   OR (name ILIKE '%ali%' AND surname ILIKE '%çiçek%')
ORDER BY name;

SELECT id, name, surname, member_status, deleted_at FROM members
WHERE surname ILIKE '%keskin%'
ORDER BY name;
