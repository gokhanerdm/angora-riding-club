-- 1. NULL membership_id olan rezervasyonları ilgili pakete bağla
--    (üyenin o tarihteki aktif paketini actual_start_date/end_date ile eşleştir)
UPDATE public.reservations r
SET membership_id = (
  SELECT m.id FROM public.memberships m
  WHERE m.member_id = r.member_id
    AND m.actual_start_date IS NOT NULL
    AND m.actual_start_date <= r.scheduled_date
    AND (m.end_date IS NULL OR m.end_date >= r.scheduled_date)
  ORDER BY m.actual_start_date DESC
  LIMIT 1
)
WHERE r.membership_id IS NULL
  AND r.status IN ('completed', 'no_show')
  AND r.type != 'trial';

-- 2. used_lessons sayaçlarını completed+no_show rezervasyon sayısına göre yeniden hesapla
UPDATE public.memberships ms
SET used_lessons = (
  SELECT COUNT(*) FROM public.reservations r
  WHERE r.membership_id = ms.id
    AND r.status IN ('completed', 'no_show')
    AND r.type != 'trial'
);

-- 3. trainer_create_reservation: is_current yerine tarih aralığıyla paket bul
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

  -- Kendi paketi: ders tarihinde aktif olan (actual_start_date <= tarih <= end_date)
  SELECT id INTO v_membership_id FROM memberships
  WHERE member_id = p_member_id
    AND family_id IS NULL
    AND actual_start_date IS NOT NULL
    AND actual_start_date <= p_scheduled_date
    AND (end_date IS NULL OR end_date >= p_scheduled_date)
  ORDER BY actual_start_date DESC LIMIT 1;

  -- Aile paketi
  IF NOT FOUND THEN
    SELECT ms.id INTO v_membership_id FROM memberships ms
    JOIN family_members fm ON fm.family_id = ms.family_id
    WHERE fm.member_id = p_member_id
      AND ms.family_id IS NOT NULL
      AND ms.actual_start_date IS NOT NULL
      AND ms.actual_start_date <= p_scheduled_date
      AND (ms.end_date IS NULL OR ms.end_date >= p_scheduled_date)
    ORDER BY ms.actual_start_date DESC LIMIT 1;
  END IF;

  -- Hâlâ bulunamazsa is_current=true olan ilk paketi al
  IF NOT FOUND THEN
    SELECT id INTO v_membership_id FROM memberships
    WHERE member_id = p_member_id AND family_id IS NULL AND is_current = true
    ORDER BY created_at ASC LIMIT 1;
  END IF;

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

  IF v_status = 'completed' AND v_membership_id IS NOT NULL THEN
    UPDATE memberships SET used_lessons = used_lessons + 1 WHERE id = v_membership_id;
  END IF;
END;
$$;
