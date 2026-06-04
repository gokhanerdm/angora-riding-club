-- Betül Package 2 düzelt (14→12, devir kaldırıldı)
UPDATE memberships SET total_lessons = 12
WHERE member_id = '2ce57cd6-f128-40fd-ae55-822a9f9da03b' AND is_current = true;

-- member_dashboard_stats: TÜM paketlerin toplamı
CREATE OR REPLACE FUNCTION public.member_dashboard_stats(user_id uuid)
RETURNS TABLE(total_lessons bigint, used_lessons bigint, remaining_lessons bigint, reserved_lessons bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member_id uuid;
  v_total bigint; v_used bigint; v_reserved bigint;
BEGIN
  SELECT id INTO v_member_id FROM members
  WHERE members.user_id = member_dashboard_stats.user_id AND deleted_at IS NULL;

  SELECT COALESCE(SUM(mb.total_lessons), 0) INTO v_total
  FROM memberships mb WHERE member_id = v_member_id;

  SELECT COALESCE(SUM(mb.used_lessons), 0) INTO v_used
  FROM memberships mb WHERE member_id = v_member_id;

  SELECT COALESCE(SUM(mb.reserved_lessons), 0) INTO v_reserved
  FROM memberships mb WHERE member_id = v_member_id AND is_current = true;

  RETURN QUERY SELECT v_total, v_used, v_total - v_used - v_reserved, v_reserved;
END;
$$;

-- create_direct_membership: devir YOK, sadece paketin kendi dersi
DROP FUNCTION IF EXISTS public.create_direct_membership(uuid,uuid,uuid,text,numeric,text,date,date,int);

CREATE FUNCTION public.create_direct_membership(
  p_member_id UUID, p_admin_id UUID, p_package_id UUID,
  p_request_type TEXT, p_payment_amount NUMERIC, p_payment_method TEXT,
  p_start_date DATE DEFAULT CURRENT_DATE,
  p_end_date DATE DEFAULT NULL,
  p_used_lessons INT DEFAULT 0
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_package membership_packages%ROWTYPE;
  v_existing_ms RECORD;
  v_new_end DATE;
  v_membership_id UUID;
  v_price NUMERIC;
  v_lesson_price NUMERIC;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz.';
  END IF;
  SELECT * INTO v_package FROM membership_packages WHERE id = p_package_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paket bulunamadı'; END IF;

  v_price := CASE WHEN p_request_type = 'weekday' THEN v_package.weekday_price ELSE v_package.general_price END;
  v_lesson_price := CASE WHEN v_package.lesson_count > 0 THEN v_price / v_package.lesson_count ELSE 0 END;

  SELECT id, end_date INTO v_existing_ms
  FROM memberships WHERE member_id = p_member_id AND is_current = true
  ORDER BY end_date DESC LIMIT 1;

  IF FOUND THEN
    IF p_end_date IS NULL THEN
      IF v_existing_ms.end_date >= p_start_date THEN
        v_new_end := v_existing_ms.end_date + (v_package.duration_months || ' months')::INTERVAL;
      ELSE
        v_new_end := p_start_date + (v_package.duration_months || ' months')::INTERVAL;
      END IF;
    ELSE
      v_new_end := p_end_date;
    END IF;
    UPDATE memberships SET is_current = false WHERE id = v_existing_ms.id;
  ELSE
    v_new_end := COALESCE(p_end_date, p_start_date + (v_package.duration_months || ' months')::INTERVAL);
  END IF;

  -- total_lessons = sadece bu paketin kendi dersi (devir yok)
  INSERT INTO memberships (
    member_id, package_id, type, total_lessons, used_lessons, reserved_lessons,
    original_price, final_price, price_snapshot, lesson_price_snapshot,
    payment_status, payment_amount, start_date, end_date, is_current
  ) VALUES (
    p_member_id, p_package_id, p_request_type,
    v_package.lesson_count, p_used_lessons, 0,
    v_price, p_payment_amount, v_price, v_lesson_price,
    'approved', p_payment_amount, p_start_date, v_new_end,
    v_package.lesson_count > p_used_lessons
  ) RETURNING id INTO v_membership_id;

  INSERT INTO payment_transactions (member_id, membership_id, amount, payment_method, payment_date, created_by)
  VALUES (p_member_id, v_membership_id, p_payment_amount, p_payment_method, p_start_date, p_admin_id);

  RETURN v_membership_id;
END;
$$;

-- approve_membership_request: devir YOK
DROP FUNCTION IF EXISTS public.approve_membership_request_with_payment(uuid,uuid,numeric,text,uuid);

CREATE FUNCTION public.approve_membership_request_with_payment(
  admin_user_id UUID, request_id UUID, payment_amount NUMERIC,
  p_payment_method TEXT, p_trainer_id UUID
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_request membership_requests%ROWTYPE;
  v_package membership_packages%ROWTYPE;
  v_existing_ms RECORD;
  v_new_end DATE;
  v_membership_id UUID;
  v_price NUMERIC;
  v_lesson_price NUMERIC;
  v_member_id UUID;
BEGIN
  IF p_trainer_id IS NULL THEN RAISE EXCEPTION 'Egitmen secimi zorunludur.'; END IF;
  SELECT * INTO v_request FROM membership_requests WHERE id = request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Talep bulunamadi'; END IF;
  SELECT * INTO v_package FROM membership_packages WHERE id = v_request.package_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paket bulunamadi'; END IF;

  v_member_id := v_request.member_id;
  v_price := CASE WHEN v_request.request_type = 'weekday' THEN v_package.weekday_price ELSE v_package.general_price END;
  v_lesson_price := CASE WHEN v_package.lesson_count > 0 THEN v_price / v_package.lesson_count ELSE 0 END;

  SELECT id, end_date INTO v_existing_ms
  FROM memberships WHERE member_id = v_member_id AND is_current = true
  ORDER BY end_date DESC LIMIT 1;

  IF FOUND THEN
    IF v_existing_ms.end_date >= CURRENT_DATE THEN
      v_new_end := v_existing_ms.end_date + (v_package.duration_months || ' months')::INTERVAL;
    ELSE
      v_new_end := CURRENT_DATE + (v_package.duration_months || ' months')::INTERVAL;
    END IF;
    UPDATE memberships SET is_current = false WHERE id = v_existing_ms.id;
  ELSE
    v_new_end := CURRENT_DATE + (v_package.duration_months || ' months')::INTERVAL;
  END IF;

  UPDATE membership_requests
  SET status='approved', reviewed_by=admin_user_id, reviewed_at=NOW(), updated_at=NOW()
  WHERE id = request_id;

  INSERT INTO memberships (
    member_id, package_id, type, total_lessons, used_lessons, reserved_lessons,
    original_price, final_price, price_snapshot, lesson_price_snapshot,
    payment_status, payment_amount, start_date, end_date, is_current
  ) VALUES (
    v_member_id, v_request.package_id, v_request.request_type,
    v_package.lesson_count, 0, 0,
    v_price, payment_amount, v_price, v_lesson_price,
    'approved', payment_amount, CURRENT_DATE, v_new_end, true
  ) RETURNING id INTO v_membership_id;

  INSERT INTO payment_transactions (member_id, membership_id, amount, payment_method, payment_date, created_by)
  VALUES (v_member_id, v_membership_id, payment_amount, p_payment_method, CURRENT_DATE, admin_user_id);

  UPDATE members SET default_trainer_id = p_trainer_id WHERE id = v_member_id;
  INSERT INTO member_allowed_trainers (member_id, trainer_id, created_by)
  VALUES (v_member_id, p_trainer_id, admin_user_id)
  ON CONFLICT (member_id, trainer_id) DO NOTHING;
END;
$$;

-- create_reservation: kalan ders olan herhangi paketten al (FIFO)
DROP FUNCTION IF EXISTS public.create_reservation(uuid,uuid,date,time,time,text);
CREATE FUNCTION public.create_reservation(
  user_id uuid, p_trainer_id uuid, p_scheduled_date date,
  p_start_time time, p_end_time time, p_reservation_type text
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  member_record record;
  membership_record record;
  result json;
BEGIN
  SELECT m.id INTO member_record FROM members m WHERE m.user_id = create_reservation.user_id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;

  -- Kalan ders olan en eski paketi bul (aktif önce, sonra diğerleri)
  SELECT * INTO membership_record FROM memberships
  WHERE member_id = member_record.id
    AND (total_lessons - used_lessons - reserved_lessons) > 0
  ORDER BY is_current DESC, created_at ASC LIMIT 1;

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
