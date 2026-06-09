-- trainer_create_reservation: gelecek tarihli dersler 'approved', geçmiş/bugün 'completed' olmalı
CREATE OR REPLACE FUNCTION public.trainer_create_reservation(
  p_member_id     uuid,
  p_trainer_id    uuid,
  p_scheduled_date date,
  p_start_time    time without time zone,
  p_end_time      time without time zone
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_membership_id uuid;
  v_status        text;
BEGIN
  -- Slot dolu mu kontrol et
  IF EXISTS (
    SELECT 1 FROM reservations
    WHERE trainer_id = p_trainer_id
      AND scheduled_date = p_scheduled_date
      AND start_time = p_start_time
      AND status != 'cancelled'
  ) THEN
    RAISE EXCEPTION 'Bu slot dolu';
  END IF;

  -- Paketi bul (kendi veya aile)
  SELECT id INTO v_membership_id FROM memberships
  WHERE member_id = p_member_id AND family_id IS NULL AND is_current = true
  ORDER BY created_at ASC LIMIT 1;

  IF NOT FOUND THEN
    SELECT ms.id INTO v_membership_id FROM memberships ms
    JOIN family_members fm ON fm.family_id = ms.family_id
    WHERE fm.member_id = p_member_id AND ms.family_id IS NOT NULL AND ms.is_current = true
    ORDER BY ms.created_at ASC LIMIT 1;
  END IF;

  -- Gelecek tarih → approved, geçmiş veya bugün → completed
  v_status := CASE
    WHEN p_scheduled_date > CURRENT_DATE THEN 'approved'
    ELSE 'completed'
  END;

  INSERT INTO reservations (
    member_id, membership_id, trainer_id,
    scheduled_date, start_time, end_time, status, type
  )
  VALUES (
    p_member_id, v_membership_id, p_trainer_id,
    p_scheduled_date, p_start_time, p_end_time,
    v_status, 'general'
  );

  -- Geçmiş ders ise used_lessons sayacını artır
  IF v_status = 'completed' THEN
    UPDATE memberships SET used_lessons = used_lessons + 1 WHERE id = v_membership_id;
  END IF;
END;
$function$;
