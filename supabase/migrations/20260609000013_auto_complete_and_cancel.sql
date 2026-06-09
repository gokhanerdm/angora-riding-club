-- ============================================================
-- 1. auto_complete_past_lessons
--    Saati geçmiş approved/pending dersleri completed yapar,
--    used_lessons artırır.
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_complete_past_lessons()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
  v_now TIMESTAMPTZ := NOW() AT TIME ZONE 'Europe/Istanbul';
BEGIN
  FOR v_rec IN
    SELECT r.id, r.membership_id
    FROM reservations r
    WHERE r.status IN ('approved', 'pending')
      AND (
        r.scheduled_date < (v_now::date)
        OR (
          r.scheduled_date = (v_now::date)
          AND r.end_time < v_now::time
        )
      )
  LOOP
    UPDATE reservations SET status = 'completed' WHERE id = v_rec.id;

    IF v_rec.membership_id IS NOT NULL THEN
      UPDATE memberships
      SET used_lessons = used_lessons + 1
      WHERE id = v_rec.membership_id;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================
-- 2. admin_cancel_completed_lesson
--    Admin tamamlanmış veya gelmedi dersini iptal eder,
--    used_lessons -1 yaparak dersi üyeye geri verir.
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_cancel_completed_lesson(
  p_admin_id      uuid,
  p_reservation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;

  SELECT id, status, membership_id INTO v_res
  FROM reservations WHERE id = p_reservation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rezervasyon bulunamadı.';
  END IF;

  IF v_res.status NOT IN ('completed', 'no_show') THEN
    RAISE EXCEPTION 'Sadece tamamlanmış veya gelmedi dersler iptal edilebilir.';
  END IF;

  UPDATE reservations SET status = 'cancelled' WHERE id = p_reservation_id;

  -- Ders üyeye geri döner
  IF v_res.membership_id IS NOT NULL THEN
    UPDATE memberships
    SET used_lessons = GREATEST(0, used_lessons - 1)
    WHERE id = v_res.membership_id;
  END IF;
END;
$$;
