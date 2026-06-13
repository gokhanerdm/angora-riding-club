-- Yeni paket onaylandığında/eklendiğinde memberships.family_id hiç set edilmiyordu.
-- Bu yüzden aile üyesi yeni paket aldığında, paket aile havuzuna (family_id ile
-- filtrelenen sorgulara) yansımıyor, diğer aile üyeleri bu paketi göremiyordu.
-- Üye bir aileye bağlıysa yeni memberships satırı o ailenin family_id'siyle oluşur;
-- aileye bağlı değilse family_id NULL kalır (tek üyeler için davranış değişmez).

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
    payment_status, payment_amount, start_date, end_date, is_current, family_id
  ) VALUES (
    v_member_id, v_request.package_id, v_request.request_type,
    v_package.lesson_count, 0, 0,
    v_price, payment_amount, v_price, v_lesson_price,
    'approved', payment_amount, CURRENT_DATE, v_new_end, true, v_family_id
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
    payment_status, payment_amount, start_date, end_date, is_current, family_id
  ) VALUES (
    p_member_id, p_package_id, p_request_type,
    v_package.lesson_count, p_used_lessons, 0,
    v_price, p_payment_amount, v_price, v_lesson_price,
    'approved', p_payment_amount, p_start_date, v_new_end,
    v_package.lesson_count > p_used_lessons, v_family_id
  ) RETURNING id INTO v_membership_id;

  INSERT INTO payment_transactions (member_id, membership_id, amount, payment_method, payment_date, created_by)
  VALUES (p_member_id, v_membership_id, p_payment_amount, p_payment_method, p_start_date, p_admin_id);

  -- Odemesi alinmis dogrudan/eski uye paketi kaydedildiginde uye artik "Aktif" sayilir
  UPDATE members SET member_status = 'active' WHERE id = p_member_id AND member_status = 'pending_club_approval';

  RETURN v_membership_id;
END;
$function$;

-- Veri düzeltmesi: Çınar Bütüner'in bugün onaylanan paketi family_id ile eşleşmiyordu
UPDATE memberships SET family_id = 'ea57088a-7402-48f6-bff8-16d24c5aec21'
WHERE id = '6601a94b-ea10-4373-897b-bd770b3a9e14';
