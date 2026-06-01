-- get_available_slots v2: slot_status sütunu eklendi
-- Üye kendi rezervasyonunu, dolumu, kapalımı görebilsin
DROP FUNCTION IF EXISTS public.get_available_slots(uuid, date);

CREATE FUNCTION public.get_available_slots(user_id uuid, selected_date date)
RETURNS TABLE (
  trainer_id   uuid,
  trainer_name text,
  slot_time    time,
  is_available boolean,
  slot_status  text   -- 'available' | 'own_reservation' | 'closed' | 'reserved' | 'past'
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_record record;
BEGIN
  SELECT m.id, m.default_trainer_id
  INTO member_record
  FROM members m
  WHERE m.user_id = get_available_slots.user_id
    AND m.deleted_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Üye bulunamadı';
  END IF;

  -- Pazartesi kapalı (eğitmen özel olarak açmadıkça)
  IF EXTRACT(DOW FROM selected_date) = 1 THEN
    IF NOT EXISTS (
      SELECT 1 FROM trainer_schedules ts
      JOIN (
        SELECT t.id as tid FROM trainers t
        WHERE t.deleted_at IS NULL
          AND (t.id = member_record.default_trainer_id
            OR EXISTS (SELECT 1 FROM member_allowed_trainers mat
                       WHERE mat.member_id = member_record.id AND mat.trainer_id = t.id))
        LIMIT 1
      ) tl ON ts.trainer_id = tl.tid
      WHERE ts.scheduled_date = selected_date AND ts.is_available = true
    ) THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  WITH slots AS (
    SELECT ('10:30:00'::time + (n * '00:30:00'::interval))::time AS st
    FROM generate_series(0, 25) AS n
  ),
  trainer_list AS (
    SELECT t.id AS tid, t.name || ' ' || t.surname AS tname
    FROM trainers t
    WHERE t.deleted_at IS NULL
      AND (t.id = member_record.default_trainer_id
        OR EXISTS (SELECT 1 FROM member_allowed_trainers mat
                   WHERE mat.member_id = member_record.id AND mat.trainer_id = t.id))
    LIMIT 1
  )
  SELECT
    tl.tid,
    tl.tname,
    s.st,
    -- is_available: sadece 'available' durumunda true
    (
      (selected_date > CURRENT_DATE OR (selected_date = CURRENT_DATE AND s.st > (CURRENT_TIME + INTERVAL '7 hours')))
      AND NOT EXISTS (SELECT 1 FROM reservations r WHERE r.trainer_id = tl.tid AND r.scheduled_date = selected_date AND r.start_time = s.st AND r.status != 'cancelled')
      AND NOT EXISTS (SELECT 1 FROM trainer_schedules ts WHERE ts.trainer_id = tl.tid AND ts.scheduled_date = selected_date AND ts.start_time = s.st AND ts.is_available = false)
    )::boolean,
    -- slot_status
    CASE
      WHEN NOT (selected_date > CURRENT_DATE OR (selected_date = CURRENT_DATE AND s.st > (CURRENT_TIME + INTERVAL '7 hours')))
        THEN 'past'
      WHEN EXISTS (
        SELECT 1 FROM reservations r
        WHERE r.trainer_id = tl.tid AND r.scheduled_date = selected_date
          AND r.start_time = s.st AND r.status != 'cancelled'
          AND r.member_id = member_record.id
      ) THEN 'own_reservation'
      WHEN EXISTS (
        SELECT 1 FROM trainer_schedules ts
        WHERE ts.trainer_id = tl.tid AND ts.scheduled_date = selected_date
          AND ts.start_time = s.st AND ts.is_available = false
      ) THEN 'closed'
      WHEN EXISTS (
        SELECT 1 FROM reservations r
        WHERE r.trainer_id = tl.tid AND r.scheduled_date = selected_date
          AND r.start_time = s.st AND r.status != 'cancelled'
      ) THEN 'reserved'
      ELSE 'available'
    END
  FROM slots s
  CROSS JOIN trainer_list tl
  ORDER BY s.st;
END;
$$;
