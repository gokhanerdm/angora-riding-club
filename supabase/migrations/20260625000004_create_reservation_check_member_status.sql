-- Pasif üye ders alamasın
CREATE OR REPLACE FUNCTION public.create_reservation(
  user_id uuid,
  p_trainer_id uuid,
  p_scheduled_date date,
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_reservation_type text DEFAULT 'general'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  member_record     record;
  membership_record record;
  result            json;
BEGIN
  SELECT m.id, m.member_status INTO member_record FROM members m WHERE m.user_id = create_reservation.user_id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;

  IF member_record.member_status != 'active' THEN
    RAISE EXCEPTION 'Üyeliğiniz pasif durumdadır, ders alamazsınız.';
  END IF;

  SELECT * INTO membership_record FROM memberships
  WHERE member_id = member_record.id
    AND family_id IS NULL
    AND (total_lessons - used_lessons - reserved_lessons) > 0
  ORDER BY is_current DESC, created_at ASC LIMIT 1;

  IF NOT FOUND THEN
    SELECT ms.* INTO membership_record
    FROM memberships ms
    JOIN family_members fm ON fm.family_id = ms.family_id
    WHERE fm.member_id = member_record.id
      AND ms.family_id IS NOT NULL
      AND (ms.total_lessons - ms.used_lessons - ms.reserved_lessons) > 0
    ORDER BY ms.is_current DESC, ms.created_at ASC LIMIT 1;
  END IF;

  IF NOT FOUND THEN RAISE EXCEPTION 'No available lessons'; END IF;

  IF EXISTS (
    SELECT 1 FROM reservations
    WHERE trainer_id = p_trainer_id AND scheduled_date = p_scheduled_date
      AND start_time = p_start_time AND status != 'cancelled'
  ) THEN RAISE EXCEPTION 'Slot already reserved'; END IF;

  INSERT INTO reservations (member_id, membership_id, trainer_id, scheduled_date, start_time, end_time, status, type)
  VALUES (member_record.id, membership_record.id, p_trainer_id, p_scheduled_date, p_start_time, p_end_time, 'pending', p_reservation_type);

  UPDATE memberships SET reserved_lessons = reserved_lessons + 1 WHERE id = membership_record.id;

  SELECT json_build_object('success', true) INTO result;
  RETURN result;
END;
$$;
