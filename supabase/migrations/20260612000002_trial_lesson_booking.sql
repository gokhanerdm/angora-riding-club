-- Deneme dersi rezervasyon akışı
-- - Deneme dersleri paket/üyelik gerektirmez (membership_id NULL olabilir)
-- - Sabit eğitmen: Ömer Faruk Kılıç (a59a033b-0ca9-4b38-9c95-b4474b098a3a)
-- - Her üye en fazla bir kez deneme dersi alabilir (trial_lesson_used)
-- - Deneme dersi 15 dakika sürer ve type='trial' ile işaretlenir,
--   kalan ders / prim sayımına dahil edilmez

ALTER TABLE public.reservations
  ALTER COLUMN membership_id DROP NOT NULL;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS trial_lesson_used boolean NOT NULL DEFAULT false;

-- get_trial_slots: Ömer Faruk'un takviminden müsait deneme dersi slotlarını döner
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

-- create_trial_reservation: deneme dersi rezervasyonu oluşturur (üyelik gerektirmez, 15 dk)
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
  VALUES (v_member_id, NULL, v_trainer_id, p_scheduled_date, p_start_time, p_start_time + INTERVAL '15 minutes', 'pending', 'trial');

  UPDATE members SET trial_lesson_used = true WHERE id = v_member_id;
END;
$$;

-- member_dashboard_stats: deneme dersi rezervasyonları kalan/kullanılan ders sayımına dahil edilmesin
CREATE OR REPLACE FUNCTION public.member_dashboard_stats(user_id uuid)
RETURNS TABLE(total_lessons bigint, used_lessons bigint, remaining_lessons bigint, reserved_lessons bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member_id uuid;
  v_family_id uuid;
  v_own_total bigint;
  v_family_total bigint;
  v_own_used_personal bigint;
  v_own_reserved_personal bigint;
  v_own_used_total bigint;
  v_own_reserved_total bigint;
  v_family_used bigint;
  v_family_reserved bigint;
BEGIN
  SELECT id INTO v_member_id FROM members
  WHERE members.user_id = member_dashboard_stats.user_id AND deleted_at IS NULL;

  SELECT family_id INTO v_family_id FROM family_members WHERE member_id = v_member_id LIMIT 1;

  SELECT COALESCE(SUM(mb.total_lessons), 0) INTO v_own_total
  FROM memberships mb WHERE mb.member_id = v_member_id AND mb.family_id IS NULL;

  SELECT COALESCE(COUNT(*), 0) INTO v_own_used_total
  FROM reservations r WHERE r.member_id = v_member_id AND r.status IN ('completed', 'no_show') AND r.type != 'trial';
  SELECT COALESCE(COUNT(*), 0) INTO v_own_reserved_total
  FROM reservations r WHERE r.member_id = v_member_id AND r.status IN ('pending', 'approved') AND r.type != 'trial';

  SELECT COALESCE(COUNT(*), 0) INTO v_own_used_personal
  FROM reservations r
  JOIN memberships ms ON ms.id = r.membership_id
  WHERE r.member_id = v_member_id AND ms.family_id IS NULL AND r.status IN ('completed', 'no_show');
  SELECT COALESCE(COUNT(*), 0) INTO v_own_reserved_personal
  FROM reservations r
  JOIN memberships ms ON ms.id = r.membership_id
  WHERE r.member_id = v_member_id AND ms.family_id IS NULL AND r.status IN ('pending', 'approved');

  IF v_family_id IS NOT NULL THEN
    SELECT COALESCE(SUM(mb.total_lessons), 0) INTO v_family_total
    FROM memberships mb WHERE mb.family_id = v_family_id;

    SELECT COALESCE(COUNT(*), 0) INTO v_family_used
    FROM reservations r
    JOIN memberships ms ON ms.id = r.membership_id
    WHERE ms.family_id = v_family_id AND r.status IN ('completed', 'no_show');
    SELECT COALESCE(COUNT(*), 0) INTO v_family_reserved
    FROM reservations r
    JOIN memberships ms ON ms.id = r.membership_id
    WHERE ms.family_id = v_family_id AND r.status IN ('pending', 'approved');

    RETURN QUERY SELECT
      v_own_total + v_family_total,
      v_own_used_total,
      (v_own_total - v_own_used_personal - v_own_reserved_personal) + (v_family_total - v_family_used - v_family_reserved),
      v_own_reserved_total;
  ELSE
    RETURN QUERY SELECT
      v_own_total,
      v_own_used_total,
      v_own_total - v_own_used_personal - v_own_reserved_personal,
      v_own_reserved_total;
  END IF;
END;
$$;
