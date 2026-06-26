-- get_available_slots: CURRENT_TIME + '7 hours' yerine Istanbul timezone + 4 saat buffer
-- Eski +7 saat: UTC_simdi + 7 = Istanbul_simdi + 4 (4 saatlik on rezervasyon kurali)
-- Yeni: Istanbul timezone'u dogru kullan + 4 saat buffer ekle
CREATE OR REPLACE FUNCTION public.get_available_slots(user_id uuid, selected_date date)
RETURNS TABLE(trainer_id uuid, trainer_name text, slot_time time without time zone, is_available boolean, slot_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  member_record  record;
  trainer_record record;
  v_shift        text;
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

  IF EXTRACT(DOW FROM selected_date) = 1 THEN
    IF NOT EXISTS (
      SELECT 1 FROM trainer_schedules ts
      JOIN (
        SELECT t.id AS tid FROM trainers t
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

  SELECT t.id AS tid, t.name || ' ' || t.surname AS tname, t.shift AS tshift
  INTO trainer_record
  FROM trainers t
  WHERE t.deleted_at IS NULL
    AND (t.id = member_record.default_trainer_id
      OR EXISTS (SELECT 1 FROM member_allowed_trainers mat
                 WHERE mat.member_id = member_record.id AND mat.trainer_id = t.id))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT tds.shift INTO v_shift
  FROM trainer_daily_shifts tds
  WHERE tds.trainer_id = trainer_record.tid AND tds.scheduled_date = selected_date;

  v_shift := COALESCE(v_shift, trainer_record.tshift, 'fullday');

  RETURN QUERY
  WITH base_slots AS (
    SELECT (
      CASE v_shift
        WHEN 'evening' THEN '15:00:00'::time
        WHEN 'fullday' THEN '11:00:00'::time
        ELSE '10:30:00'::time
      END
      + (n * '00:30:00'::interval)
    )::time AS st
    FROM generate_series(0, CASE v_shift
        WHEN 'evening' THEN 14
        WHEN 'fullday' THEN 22
        ELSE 19
      END) AS n
  ),
  extra_slots AS (
    SELECT ts.start_time AS st FROM trainer_schedules ts
    WHERE ts.trainer_id = trainer_record.tid AND ts.scheduled_date = selected_date
      AND ts.is_available = true AND ts.start_time IN ('22:30:00','23:00:00')
  ),
  slots AS (
    SELECT st FROM base_slots
    UNION
    SELECT st FROM extra_slots
  )
  SELECT
    trainer_record.tid,
    trainer_record.tname,
    s.st,
    (
      (selected_date > CURRENT_DATE OR (selected_date = CURRENT_DATE AND s.st > ((CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::time + INTERVAL '4 hours')))
      AND NOT EXISTS (SELECT 1 FROM reservations r WHERE r.trainer_id = trainer_record.tid AND r.scheduled_date = selected_date AND r.start_time = s.st AND r.status != 'cancelled')
      AND NOT EXISTS (SELECT 1 FROM trainer_schedules ts WHERE ts.trainer_id = trainer_record.tid AND ts.scheduled_date = selected_date AND ts.start_time = s.st AND ts.is_available = false)
    )::boolean,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM reservations r
        WHERE r.trainer_id = trainer_record.tid AND r.scheduled_date = selected_date
          AND r.start_time = s.st AND r.status != 'cancelled'
          AND r.member_id = member_record.id
      ) THEN 'own_reservation'
      WHEN EXISTS (
        SELECT 1 FROM trainer_schedules ts
        WHERE ts.trainer_id = trainer_record.tid AND ts.scheduled_date = selected_date
          AND ts.start_time = s.st AND ts.is_available = false
      ) THEN 'closed'
      WHEN EXISTS (
        SELECT 1 FROM reservations r
        WHERE r.trainer_id = trainer_record.tid AND r.scheduled_date = selected_date
          AND r.start_time = s.st AND r.status != 'cancelled'
      ) THEN 'reserved'
      WHEN NOT (selected_date > CURRENT_DATE OR (selected_date = CURRENT_DATE AND s.st > ((CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::time + INTERVAL '4 hours')))
        THEN 'past'
      ELSE 'available'
    END
  FROM slots s
  ORDER BY s.st;
END;
$$;
