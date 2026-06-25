UPDATE public.reservations r
SET membership_id = (
  SELECT m.id FROM public.memberships m
  WHERE m.member_id = r.member_id
    AND m.actual_start_date IS NOT NULL
    AND m.family_id IS NULL
  ORDER BY ABS((m.actual_start_date - r.scheduled_date)::integer) ASC
  LIMIT 1
)
WHERE r.membership_id IS NULL
  AND r.status IN ('completed', 'no_show')
  AND r.type != 'trial';

UPDATE public.memberships ms
SET used_lessons = (
  SELECT COUNT(*) FROM public.reservations r
  WHERE r.membership_id = ms.id
    AND r.status IN ('completed', 'no_show')
    AND r.type != 'trial'
);
