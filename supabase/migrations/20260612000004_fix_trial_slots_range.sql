-- get_trial_slots: eğitmen takvimiyle aynı saat aralığını kullansın (15:00-22:00, 30 dk grid)
CREATE OR REPLACE FUNCTION public.get_trial_slots(p_user_id uuid, p_selected_date date)
RETURNS TABLE (
  trainer_id   uuid,
  trainer_name text,
  slot_time    time,
  is_available boolean,
  slot_status  text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trainer_id uuid := 'a59a033b-0ca9-4b38-9c95-b4474b098a3a';
  v_trainer_name text;
  member_record record;
BEGIN
  SELECT m.id INTO member_record
  FROM members m
  WHERE m.user_id = p_user_id AND m.deleted_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Üye bulunamadı';
  END IF;

  SELECT t.name || ' ' || t.surname INTO v_trainer_name
  FROM trainers t WHERE t.id = v_trainer_id;

  -- Pazartesi kapalı (eğitmen özel olarak açmadıkça)
  IF EXTRACT(DOW FROM p_selected_date) = 1 THEN
    IF NOT EXISTS (
      SELECT 1 FROM trainer_schedules ts
      WHERE ts.trainer_id = v_trainer_id
        AND ts.scheduled_date = p_selected_date AND ts.is_available = true
    ) THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  WITH slots AS (
    SELECT ('15:00:00'::time + (n * '00:30:00'::interval))::time AS st
    FROM generate_series(0, 14) AS n
  )
  SELECT
    v_trainer_id,
    v_trainer_name,
    s.st,
    (
      (p_selected_date > CURRENT_DATE OR (p_selected_date = CURRENT_DATE AND s.st > (CURRENT_TIME + INTERVAL '7 hours')))
      AND NOT EXISTS (SELECT 1 FROM reservations r WHERE r.trainer_id = v_trainer_id AND r.scheduled_date = p_selected_date AND r.start_time = s.st AND r.status != 'cancelled')
      AND NOT EXISTS (SELECT 1 FROM trainer_schedules ts WHERE ts.trainer_id = v_trainer_id AND ts.scheduled_date = p_selected_date AND ts.start_time = s.st AND ts.is_available = false)
    )::boolean,
    CASE
      WHEN NOT (p_selected_date > CURRENT_DATE OR (p_selected_date = CURRENT_DATE AND s.st > (CURRENT_TIME + INTERVAL '7 hours')))
        THEN 'past'
      WHEN EXISTS (
        SELECT 1 FROM trainer_schedules ts
        WHERE ts.trainer_id = v_trainer_id AND ts.scheduled_date = p_selected_date
          AND ts.start_time = s.st AND ts.is_available = false
      ) THEN 'closed'
      WHEN EXISTS (
        SELECT 1 FROM reservations r
        WHERE r.trainer_id = v_trainer_id AND r.scheduled_date = p_selected_date
          AND r.start_time = s.st AND r.status != 'cancelled'
      ) THEN 'reserved'
      ELSE 'available'
    END
  FROM slots s
  ORDER BY s.st;
END;
$$;

-- Test amaçlı oluşturulan, takvim aralığı dışındaki (11:00) deneme dersi rezervasyonunu temizle
DELETE FROM public.reservations
WHERE type = 'trial' AND start_time = '11:00:00';

UPDATE public.members SET trial_lesson_used = false
WHERE id = '15311f7e-e64e-483b-bab6-13082f60a219';
