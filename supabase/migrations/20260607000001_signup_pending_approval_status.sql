-- Yeni kayıt olan üyeler artık doğrudan "active" değil, admin onayı/ödeme bekleyen
-- "pending_club_approval" durumuyla başlar. Üyelik talebi ödeme ile onaylandığında
-- (approve_membership_request_with_payment) durum otomatik "active"e çekilir.
-- Neden: ödeme yapılmadan onaylanmayan üyeler "Üyeler" listesinde Aktif görünüyordu.

CREATE OR REPLACE FUNCTION public.complete_signup(
  p_user_id uuid,
  p_name text,
  p_surname text,
  p_email text,
  p_phone text,
  p_referral_code text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_new_code   TEXT;
  v_referrer_id UUID;
  v_membership_id UUID;
BEGIN
  LOOP
    v_new_code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM members WHERE referral_code = v_new_code);
  END LOOP;

  INSERT INTO public.profiles (id, role) VALUES (p_user_id, 'member');

  INSERT INTO public.members (user_id, name, surname, email, phone, member_status, referral_code)
  VALUES (p_user_id, p_name, p_surname, p_email, p_phone, 'pending_club_approval', v_new_code);

  IF p_referral_code IS NOT NULL AND p_referral_code != '' THEN
    SELECT id INTO v_referrer_id FROM members
    WHERE referral_code = upper(trim(p_referral_code)) AND deleted_at IS NULL
    LIMIT 1;

    IF v_referrer_id IS NOT NULL THEN
      SELECT id INTO v_membership_id FROM memberships
      WHERE member_id = v_referrer_id AND is_current = true
      ORDER BY start_date DESC LIMIT 1;

      IF v_membership_id IS NOT NULL THEN
        UPDATE memberships SET total_lessons = total_lessons + 1 WHERE id = v_membership_id;
      ELSE
        UPDATE members SET pending_referral_bonus_lessons = pending_referral_bonus_lessons + 1
        WHERE id = v_referrer_id;
      END IF;
    END IF;
  END IF;
END;
$function$;

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

  -- Ödeme alınıp üyelik onaylandığında üye artık "Aktif" sayılır
  UPDATE members SET member_status = 'active' WHERE id = v_member_id AND member_status = 'pending_club_approval';
END;
$function$;
