-- Mevcut paketler icin (migration 20260615000002 oncesi girilenler) actual_start_date
-- bos kalmisti. used_lessons > 0 olan paketlerde, ilk tamamlanan/gelinmeyen dersin
-- tarihi actual_start_date olarak geriye donuk doldurulur. end_date'e dokunulmaz.
UPDATE public.memberships m
SET actual_start_date = (
  SELECT MIN(r.scheduled_date)
  FROM reservations r
  WHERE r.membership_id = m.id
    AND r.status IN ('completed', 'no_show')
)
WHERE m.used_lessons > 0
  AND m.actual_start_date IS NULL
  AND EXISTS (
    SELECT 1 FROM reservations r
    WHERE r.membership_id = m.id AND r.status IN ('completed', 'no_show')
  );
