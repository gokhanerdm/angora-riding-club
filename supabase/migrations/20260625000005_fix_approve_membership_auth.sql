-- Security fix: approve_membership_request_with_payment
-- Herhangi bir oturum açmış kullanıcı geçerli bir request_id ile bu RPC'yi çağırabiliyordu.
-- Kontrol: auth.uid() = admin_user_id VE o kullanıcının rolü 'admin'.
-- Fonksiyon gövdesi değişmiyor; sadece auth kontrolü başa ekleniyor.

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
  -- Auth kontrolü: çağıran oturum sahibi admin_user_id ile örtüşmeli ve admin rolünde olmalı
  IF auth.uid() IS NULL OR auth.uid() <> admin_user_id THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;

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
