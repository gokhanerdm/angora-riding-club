-- Deneme dersi rezervasyonu admin onayı gerektirmeden direkt 'approved' olsun
CREATE OR REPLACE FUNCTION public.create_trial_reservation(p_user_id uuid, p_scheduled_date date, p_start_time time)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trainer_id uuid := 'a59a033b-0ca9-4b38-9c95-b4474b098a3a';
  v_member_id  uuid;
  v_used       boolean;
BEGIN
  SELECT id, trial_lesson_used INTO v_member_id, v_used
  FROM members WHERE user_id = p_user_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Üye bulunamadı';
  END IF;

  IF v_used THEN
    RAISE EXCEPTION 'Deneme dersi hakkınız zaten kullanılmış.';
  END IF;

  IF EXTRACT(DOW FROM p_scheduled_date) = 1 THEN
    RAISE EXCEPTION 'Pazartesi günleri kapalıdır.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM reservations
    WHERE trainer_id = v_trainer_id AND scheduled_date = p_scheduled_date
      AND start_time = p_start_time AND status != 'cancelled'
  ) THEN
    RAISE EXCEPTION 'Bu slot dolu';
  END IF;

  INSERT INTO reservations (member_id, membership_id, trainer_id, scheduled_date, start_time, end_time, status, type)
  VALUES (v_member_id, NULL, v_trainer_id, p_scheduled_date, p_start_time, p_start_time + INTERVAL '15 minutes', 'approved', 'trial');

  UPDATE members SET trial_lesson_used = true WHERE id = v_member_id;
END;
$$;

-- Mevcut pending deneme dersi rezervasyonlarını approved'a çek
UPDATE public.reservations
SET status = 'approved'
WHERE type = 'trial' AND status = 'pending';
