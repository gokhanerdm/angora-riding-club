-- trainer_create_reservation: bugünkü dersler için saat kontrolü eklendi.
-- Eski davranış: p_scheduled_date = CURRENT_DATE → direkt 'completed'
-- Yeni davranış: slot zamanı henüz geçmemişse → 'approved', geçmişse → 'completed'
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
AS $function$
DECLARE
  v_membership_id uuid;
  v_status        text;
  v_now_istanbul  timestamp;
BEGIN
  -- Slot dolu mu kontrol et
  IF EXISTS (
    SELECT 1 FROM reservations
    WHERE trainer_id     = p_trainer_id
      AND scheduled_date = p_scheduled_date
      AND start_time     = p_start_time
      AND status        != 'cancelled'
  ) THEN
    RAISE EXCEPTION 'Bu slot dolu';
  END IF;

  -- Paketi bul (kendi veya aile)
  SELECT id INTO v_membership_id FROM memberships
  WHERE member_id = p_member_id AND family_id IS NULL AND is_current = true
  ORDER BY created_at ASC LIMIT 1;

  IF NOT FOUND THEN
    SELECT ms.id INTO v_membership_id
    FROM memberships ms
    JOIN family_members fm ON fm.family_id = ms.family_id
    WHERE fm.member_id = p_member_id AND ms.family_id IS NOT NULL AND ms.is_current = true
    ORDER BY ms.created_at ASC LIMIT 1;
  END IF;

  -- İstanbul saatiyle şu anki zamanı al
  v_now_istanbul := (now() AT TIME ZONE 'Europe/Istanbul');

  -- Gelecek → approved, geçmiş veya bugün-slot-geçmiş → completed
  v_status := CASE
    WHEN p_scheduled_date > CURRENT_DATE THEN 'approved'
    WHEN p_scheduled_date = CURRENT_DATE
         AND p_start_time > v_now_istanbul::time THEN 'approved'
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

  -- Sadece gerçekten geçmiş ders ise used_lessons artır
  IF v_status = 'completed' THEN
    UPDATE memberships SET used_lessons = used_lessons + 1 WHERE id = v_membership_id;
  END IF;
END;
$function$;
