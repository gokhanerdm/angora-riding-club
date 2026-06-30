-- actual_start_date bos olan paketlerde eğitmen ders ekleyemiyordu (88 aktif paketin 27'si)
-- Tarih kontrolunde actual_start_date yerine COALESCE(actual_start_date, start_date) kullan
CREATE OR REPLACE FUNCTION public.trainer_create_reservation(
  p_member_id      uuid,
  p_trainer_id     uuid,
  p_scheduled_date date,
  p_start_time     time without time zone,
  p_end_time       time without time zone
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_membership_id uuid;
  v_status        text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM reservations
    WHERE trainer_id = p_trainer_id
      AND scheduled_date = p_scheduled_date
      AND start_time = p_start_time
      AND status != 'cancelled'
  ) THEN
    RAISE EXCEPTION 'Bu slot dolu';
  END IF;

  SELECT id INTO v_membership_id FROM memberships
  WHERE member_id = p_member_id
    AND family_id IS NULL
    AND COALESCE(actual_start_date, start_date) IS NOT NULL
    AND COALESCE(actual_start_date, start_date) <= p_scheduled_date
    AND (end_date IS NULL OR end_date >= p_scheduled_date)
  ORDER BY COALESCE(actual_start_date, start_date) DESC LIMIT 1;

  IF NOT FOUND THEN
    SELECT ms.id INTO v_membership_id FROM memberships ms
    JOIN family_members fm ON fm.family_id = ms.family_id
    WHERE fm.member_id = p_member_id
      AND ms.family_id IS NOT NULL
      AND COALESCE(ms.actual_start_date, ms.start_date) IS NOT NULL
      AND COALESCE(ms.actual_start_date, ms.start_date) <= p_scheduled_date
      AND (ms.end_date IS NULL OR ms.end_date >= p_scheduled_date)
    ORDER BY COALESCE(ms.actual_start_date, ms.start_date) DESC LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paketin suresi bitmistir, lutfen yenileyiniz.';
  END IF;

  v_status := CASE
    WHEN p_scheduled_date > CURRENT_DATE THEN 'approved'
    ELSE 'completed'
  END;

  INSERT INTO reservations (
    member_id, membership_id, trainer_id,
    scheduled_date, start_time, end_time, status, type
  ) VALUES (
    p_member_id, v_membership_id, p_trainer_id,
    p_scheduled_date, p_start_time, p_end_time, v_status, 'general'
  );

  IF v_status = 'completed' THEN
    UPDATE memberships SET used_lessons = used_lessons + 1 WHERE id = v_membership_id;
  END IF;
END;
$$;
