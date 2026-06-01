-- =============================================
-- 1. Trainer zorunluluğunu bypass eden 4-param versiyonu sil
-- =============================================
DROP FUNCTION IF EXISTS public.approve_membership_request_with_payment(
  uuid, uuid, numeric, text
);

-- =============================================
-- 2. 5-param versiyona trainer zorunluluğu ekle
--    (DEFAULT NULL kaldırılamadığı için drop + create)
-- =============================================
DROP FUNCTION IF EXISTS public.approve_membership_request_with_payment(
  uuid, uuid, numeric, text, uuid
);

CREATE FUNCTION public.approve_membership_request_with_payment(
  admin_user_id  UUID,
  request_id     UUID,
  payment_amount NUMERIC,
  p_payment_method TEXT,
  p_trainer_id   UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request    membership_requests%ROWTYPE;
  v_package    membership_packages%ROWTYPE;
  v_membership_id uuid;
  v_price      numeric;
  v_lesson_price numeric;
  v_member_id  uuid;
BEGIN
  -- Eğitmen zorunlu
  IF p_trainer_id IS NULL THEN
    RAISE EXCEPTION 'Üyelik onayı için eğitmen seçimi zorunludur.';
  END IF;

  SELECT * INTO v_request FROM membership_requests WHERE id = request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Talep bulunamadı'; END IF;

  SELECT * INTO v_package FROM membership_packages WHERE id = v_request.package_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paket bulunamadı'; END IF;

  v_member_id := v_request.member_id;

  IF v_request.request_type = 'weekday' THEN
    v_price := v_package.weekday_price;
  ELSE
    v_price := v_package.general_price;
  END IF;

  v_lesson_price := CASE WHEN v_package.lesson_count > 0 THEN v_price / v_package.lesson_count ELSE 0 END;

  -- Talebi onayla
  UPDATE membership_requests
  SET status = 'approved', reviewed_by = admin_user_id, reviewed_at = NOW(), updated_at = NOW()
  WHERE id = request_id;

  -- Üyelik oluştur
  INSERT INTO memberships (
    member_id, package_id, type, total_lessons, used_lessons, reserved_lessons,
    original_price, final_price, price_snapshot, lesson_price_snapshot,
    payment_status, payment_amount, start_date, end_date, is_current
  ) VALUES (
    v_member_id, v_request.package_id, v_request.request_type,
    v_package.lesson_count, 0, 0, v_price, payment_amount,
    v_price, v_lesson_price, 'approved', payment_amount,
    CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year', true
  ) RETURNING id INTO v_membership_id;

  -- Ödeme kaydı
  INSERT INTO payment_transactions (member_id, membership_id, amount, payment_method, payment_date, created_by)
  VALUES (v_member_id, v_membership_id, payment_amount, p_payment_method, CURRENT_DATE, admin_user_id);

  -- Eğitmen ata
  UPDATE members SET default_trainer_id = p_trainer_id WHERE id = v_member_id;

  INSERT INTO member_allowed_trainers (member_id, trainer_id, created_by)
  VALUES (v_member_id, p_trainer_id, admin_user_id)
  ON CONFLICT (member_id, trainer_id) DO NOTHING;

END;
$$;

-- =============================================
-- 3. Kullanılmayan, kırık calculate_membership_price sil
-- =============================================
DROP FUNCTION IF EXISTS public.calculate_membership_price(uuid, uuid, character varying);
