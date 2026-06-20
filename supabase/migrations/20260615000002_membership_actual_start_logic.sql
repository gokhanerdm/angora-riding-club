-- Paket onaylandiginda end_date/actual_start_date bos kalir; uye ilk dersini
-- alana kadar paket "is_current" kuralinda bitis tarihine bakilmaksizin aktif
-- sayilir. Ilk ders tamamlandiginda actual_start_date = o ders tarihi olur ve
-- end_date bu tarihten itibaren (paket suresi) hesaplanir.

-- 1) is_current kurali: actual_start_date bos olan paketler suresi dolmus
--    sayilmaz, bitis tarihine bakilmaksizin aday paket olarak degerlendirilir.
CREATE OR REPLACE FUNCTION public.sync_membership_is_current()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_active_id UUID;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NULL; END IF;

  SELECT id INTO v_active_id
  FROM memberships
  WHERE member_id = NEW.member_id
    AND used_lessons < total_lessons
    AND (actual_start_date IS NULL OR end_date >= CURRENT_DATE)
  ORDER BY start_date
  LIMIT 1;

  UPDATE memberships
  SET is_current = COALESCE(id = v_active_id, false)
  WHERE member_id = NEW.member_id
    AND is_current IS DISTINCT FROM COALESCE(id = v_active_id, false);

  RETURN NULL;
END;
$$;

-- 2) Bir paketin ilk dersi tamamlandiginda paket suresini baslatir.
CREATE OR REPLACE FUNCTION public.activate_membership_first_lesson(
  p_membership_id uuid,
  p_lesson_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duration int;
BEGIN
  SELECT mp.duration_months INTO v_duration
  FROM memberships m
  JOIN membership_packages mp ON mp.id = m.package_id
  WHERE m.id = p_membership_id AND m.actual_start_date IS NULL;

  IF FOUND THEN
    UPDATE memberships
    SET actual_start_date = p_lesson_date,
        end_date = p_lesson_date + (v_duration || ' months')::interval
    WHERE id = p_membership_id;
  END IF;
END;
$$;

-- 3) auto_complete_past_lessons: ders tamamlandiginda paketi de baslat.
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
    SELECT r.id, r.membership_id, r.scheduled_date
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

      PERFORM activate_membership_first_lesson(v_rec.membership_id, v_rec.scheduled_date);
    END IF;
  END LOOP;
END;
$$;

-- 4) mark_attendance: ders tamamlandiginda/gelmedi yazildiginda paketi de baslat.
CREATE OR REPLACE FUNCTION public.mark_attendance(
  p_reservation_id uuid,
  p_status         text,
  p_marked_by      uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res RECORD;
BEGIN
  IF p_status NOT IN ('completed', 'no_show') THEN
    RAISE EXCEPTION 'Geçersiz durum: %. Sadece completed veya no_show kabul edilir.', p_status;
  END IF;

  SELECT r.id, r.status, r.member_id, r.membership_id, r.scheduled_date
  INTO v_res
  FROM reservations r
  WHERE r.id = p_reservation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rezervasyon bulunamadı.';
  END IF;

  IF v_res.status NOT IN ('approved', 'pending', 'completed') THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM attendance WHERE reservation_id = p_reservation_id) THEN
    INSERT INTO attendance (reservation_id, status, marked_by)
    VALUES (p_reservation_id, p_status, p_marked_by);
  ELSE
    UPDATE attendance SET status = p_status, marked_by = p_marked_by
    WHERE reservation_id = p_reservation_id;
  END IF;

  UPDATE reservations SET status = p_status WHERE id = p_reservation_id;

  IF v_res.status IN ('approved', 'pending') AND v_res.membership_id IS NOT NULL THEN
    UPDATE memberships
    SET reserved_lessons = GREATEST(0, reserved_lessons - 1),
        used_lessons      = used_lessons + 1
    WHERE id = v_res.membership_id;

    PERFORM activate_membership_first_lesson(v_res.membership_id, v_res.scheduled_date);
  END IF;
END;
$$;

-- 5) Paket onayinda actual_start_date/end_date bos birakilir, purchase_date eklenir.
CREATE OR REPLACE FUNCTION public.approve_membership_request_with_payment(
  admin_user_id uuid,
  request_id uuid,
  payment_amount numeric,
  p_payment_method text,
  p_trainer_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_request membership_requests%ROWTYPE;
  v_package membership_packages%ROWTYPE;
  v_existing_ms RECORD;
  v_membership_id UUID;
  v_price NUMERIC;
  v_lesson_price NUMERIC;
  v_member_id UUID;
  v_family_id UUID;
BEGIN
  IF p_trainer_id IS NULL THEN RAISE EXCEPTION 'Egitmen secimi zorunludur.'; END IF;
  SELECT * INTO v_request FROM membership_requests WHERE id = request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Talep bulunamadi'; END IF;
  SELECT * INTO v_package FROM membership_packages WHERE id = v_request.package_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paket bulunamadi'; END IF;

  v_member_id := v_request.member_id;
  v_price := CASE WHEN v_request.request_type = 'weekday' THEN v_package.weekday_price ELSE v_package.general_price END;
  v_lesson_price := CASE WHEN v_package.lesson_count > 0 THEN v_price / v_package.lesson_count ELSE 0 END;

  SELECT family_id INTO v_family_id FROM family_members WHERE member_id = v_member_id LIMIT 1;

  SELECT id, end_date INTO v_existing_ms
  FROM memberships WHERE member_id = v_member_id AND is_current = true
  ORDER BY end_date DESC LIMIT 1;

  IF FOUND THEN
    UPDATE memberships SET is_current = false WHERE id = v_existing_ms.id;
  END IF;

  UPDATE membership_requests
  SET status='approved', reviewed_by=admin_user_id, reviewed_at=NOW(), updated_at=NOW()
  WHERE id = request_id;

  INSERT INTO memberships (
    member_id, package_id, type, total_lessons, used_lessons, reserved_lessons,
    original_price, final_price, price_snapshot, lesson_price_snapshot,
    payment_status, payment_amount, start_date, purchase_date, end_date, actual_start_date, is_current, family_id
  ) VALUES (
    v_member_id, v_request.package_id, v_request.request_type,
    v_package.lesson_count, 0, 0,
    v_price, payment_amount, v_price, v_lesson_price,
    'approved', payment_amount, CURRENT_DATE, CURRENT_DATE, NULL, NULL, true, v_family_id
  ) RETURNING id INTO v_membership_id;

  INSERT INTO payment_transactions (member_id, membership_id, amount, payment_method, payment_date, created_by)
  VALUES (v_member_id, v_membership_id, payment_amount, p_payment_method, CURRENT_DATE, admin_user_id);

  UPDATE members SET default_trainer_id = p_trainer_id WHERE id = v_member_id;

  UPDATE members SET member_status = 'active'
  WHERE id = v_member_id AND member_status = 'pending_club_approval';
END;
$function$;

-- 6) create_direct_membership: zaten ders kullanilmis (eski uye) paketlerde
--    actual_start_date = p_start_date olarak set edilir (gecmis ders zaten var);
--    hic kullanilmamis paketlerde actual_start_date/end_date bos birakilir.
CREATE OR REPLACE FUNCTION public.create_direct_membership(
  p_member_id uuid,
  p_admin_id uuid,
  p_package_id uuid,
  p_request_type text,
  p_payment_amount numeric,
  p_payment_method text,
  p_start_date date DEFAULT CURRENT_DATE,
  p_end_date date DEFAULT NULL::date,
  p_used_lessons integer DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_package membership_packages%ROWTYPE;
  v_existing_ms RECORD;
  v_new_end DATE;
  v_membership_id UUID;
  v_price NUMERIC;
  v_lesson_price NUMERIC;
  v_family_id UUID;
  v_actual_start DATE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz.';
  END IF;
  SELECT * INTO v_package FROM membership_packages WHERE id = p_package_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paket bulunamadı'; END IF;

  v_price := CASE WHEN p_request_type = 'weekday' THEN v_package.weekday_price ELSE v_package.general_price END;
  v_lesson_price := CASE WHEN v_package.lesson_count > 0 THEN v_price / v_package.lesson_count ELSE 0 END;

  SELECT family_id INTO v_family_id FROM family_members WHERE member_id = p_member_id LIMIT 1;

  SELECT id, end_date INTO v_existing_ms
  FROM memberships WHERE member_id = p_member_id AND is_current = true
  ORDER BY end_date DESC LIMIT 1;

  IF p_used_lessons > 0 THEN
    -- Gecmis ders girisi: paket zaten kullanilmaya baslamis, suresi p_start_date'ten isler.
    v_actual_start := p_start_date;
    v_new_end := COALESCE(p_end_date, p_start_date + (v_package.duration_months || ' months')::INTERVAL);
  ELSE
    -- Henuz ders alinmamis: ilk derste baslatilacak.
    v_actual_start := NULL;
    v_new_end := NULL;
  END IF;

  IF FOUND THEN
    UPDATE memberships SET is_current = false WHERE id = v_existing_ms.id;
  END IF;

  INSERT INTO memberships (
    member_id, package_id, type, total_lessons, used_lessons, reserved_lessons,
    original_price, final_price, price_snapshot, lesson_price_snapshot,
    payment_status, payment_amount, start_date, purchase_date, end_date, actual_start_date, is_current, family_id
  ) VALUES (
    p_member_id, p_package_id, p_request_type,
    v_package.lesson_count, p_used_lessons, 0,
    v_price, p_payment_amount, v_price, v_lesson_price,
    'approved', p_payment_amount, p_start_date, CURRENT_DATE, v_new_end, v_actual_start,
    v_package.lesson_count > p_used_lessons, v_family_id
  ) RETURNING id INTO v_membership_id;

  INSERT INTO payment_transactions (member_id, membership_id, amount, payment_method, payment_date, created_by)
  VALUES (p_member_id, v_membership_id, p_payment_amount, p_payment_method, p_start_date, p_admin_id);

  UPDATE members SET member_status = 'active' WHERE id = p_member_id AND member_status = 'pending_club_approval';

  RETURN v_membership_id;
END;
$function$;
