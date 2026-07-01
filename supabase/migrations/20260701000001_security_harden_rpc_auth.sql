-- Güvenlik: SECURITY DEFINER RPC'lerin tamamı auth.uid() yerine dışarıdan
-- gönderilen p_admin_id/p_trainer_id/p_user_id/user_id parametresine güveniyordu.
-- Giriş yapmadan (anon) veya başka birinin kimliğine bürünerek bu fonksiyonlar
-- çağrılabiliyordu. Bu migration sadece fonksiyon gövdelerini değiştirir —
-- imzalar, dönüş tipleri ve iş kuralları aynen korunur.
--
-- Kalıplar:
--   A) Admin-only  -> auth.uid() = p_admin_id (veya user_id) VE profiles.role='admin'
--   B) Member self  -> auth.uid() = p_user_id (veya user_id)
--   C) Shared (self OR admin/trainer) -> get_trainer_daily_lessons ile aynı kalıp
--   D) Sıfır kontrol -> admin_cancel_reservation, trainer_create_reservation

-- =========================================================================
-- A) ADMIN-ONLY FONKSİYONLAR (auth.uid() = p_admin_id kontrolü eklendi)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.add_bonus_lessons(p_member_id uuid, p_admin_id uuid, p_lessons integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF auth.uid() <> p_admin_id THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;
  UPDATE memberships
  SET total_lessons = total_lessons + p_lessons
  WHERE member_id = p_member_id AND is_current = true
    AND id = (SELECT id FROM memberships WHERE member_id = p_member_id AND is_current = true ORDER BY start_date DESC LIMIT 1);
  -- Aktif paket yoksa beklemede say
  IF NOT FOUND THEN
    UPDATE members SET pending_referral_bonus_lessons = pending_referral_bonus_lessons + p_lessons WHERE id = p_member_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.add_family_member(p_admin_id uuid, p_family_id uuid, p_member_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_leader_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF auth.uid() <> p_admin_id THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;

  INSERT INTO family_members (family_id, member_id, is_leader)
  VALUES (p_family_id, p_member_id, false)
  ON CONFLICT (family_id, member_id) DO NOTHING;

  UPDATE members
  SET pending_family_setup = false, member_status = 'active'
  WHERE id = p_member_id AND deleted_at IS NULL;

  IF NOT EXISTS (SELECT 1 FROM memberships WHERE family_id = p_family_id) THEN
    SELECT member_id INTO v_leader_id FROM family_members
      WHERE family_id = p_family_id AND is_leader = true LIMIT 1;

    IF v_leader_id IS NOT NULL THEN
      UPDATE memberships
      SET family_id = p_family_id
      WHERE member_id = v_leader_id AND is_current = true AND family_id IS NULL;
    END IF;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.add_legacy_lessons(p_member_id uuid, p_admin_id uuid, p_membership_id uuid, p_lessons jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lesson        JSONB;
  v_current_ms_id UUID := p_membership_id;
  v_remaining     INT;
  v_next_id       UUID;
  v_current_start DATE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF auth.uid() <> p_admin_id THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;

  -- Dersleri tarih sırasına göre işle
  FOR v_lesson IN
    SELECT value FROM jsonb_array_elements(p_lessons) ORDER BY (value->>'scheduled_date')::date
  LOOP
    -- Mevcut paketin kalan kapasitesini kontrol et
    SELECT total_lessons - used_lessons INTO v_remaining
    FROM memberships WHERE id = v_current_ms_id;

    -- Kapasite dolmuşsa kronolojik sıradaki sonraki pakete geç
    IF v_remaining <= 0 THEN
      SELECT start_date INTO v_current_start FROM memberships WHERE id = v_current_ms_id;

      SELECT id INTO v_next_id
      FROM memberships
      WHERE member_id = p_member_id
        AND start_date > v_current_start
      ORDER BY start_date
      LIMIT 1;

      IF v_next_id IS NULL THEN
        RAISE EXCEPTION 'Paket kapasitesi doldu ve sonraki paket bulunamadı. Önce yeni paket ekleyin.';
      END IF;

      v_current_ms_id := v_next_id;
    END IF;

    INSERT INTO reservations (
      member_id, membership_id, trainer_id,
      scheduled_date, start_time, end_time, status, type
    ) VALUES (
      p_member_id,
      v_current_ms_id,
      (v_lesson->>'trainer_id')::UUID,
      (v_lesson->>'scheduled_date')::DATE,
      COALESCE((v_lesson->>'start_time')::TIME, '10:00:00'::TIME),
      COALESCE((v_lesson->>'end_time')::TIME,   '10:30:00'::TIME),
      COALESCE(v_lesson->>'status', 'completed'),
      'general'
    );

    UPDATE memberships SET used_lessons = used_lessons + 1 WHERE id = v_current_ms_id;

    PERFORM activate_membership_first_lesson(v_current_ms_id, (v_lesson->>'scheduled_date')::DATE);
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_cancel_completed_lesson(p_admin_id uuid, p_reservation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_res RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF auth.uid() <> p_admin_id THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;
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
$function$;

CREATE OR REPLACE FUNCTION public.admin_dashboard_stats(user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
  total_sales numeric;
  total_collected numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF auth.uid() <> admin_dashboard_stats.user_id THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = admin_dashboard_stats.user_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COALESCE(SUM(final_price), 0) INTO total_sales
  FROM memberships WHERE is_current = true;

  SELECT COALESCE(SUM(amount), 0) INTO total_collected
  FROM payment_transactions WHERE deleted_at IS NULL;

  SELECT json_build_object(
    'total_members', (SELECT COUNT(*) FROM members WHERE member_status = 'active'),
    'active_memberships', (SELECT COUNT(*) FROM memberships WHERE is_current = true),
    'pending_reservations', (SELECT COUNT(*) FROM reservations WHERE status = 'pending'),
    'total_sales', total_sales,
    'total_collected', total_collected,
    'remaining_debt', total_sales - total_collected
  ) INTO result;

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_reservation(p_admin_id uuid, p_reservation_id uuid, p_scheduled_date date DEFAULT NULL::date, p_status text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_res reservations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF auth.uid() <> p_admin_id THEN
    RAISE EXCEPTION 'Yetkisiz.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz.';
  END IF;

  SELECT * INTO v_res FROM reservations WHERE id = p_reservation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rezervasyon bulunamadı.';
  END IF;

  IF p_status IS NOT NULL AND p_status <> v_res.status THEN
    -- Yalnızca pending -> approved geçişine izin ver; iptal/tamamlandı/gelmedi
    -- ayrı RPC'ler (cancel_reservation, mark_attendance) üzerinden yapılmalı.
    IF NOT (v_res.status = 'pending' AND p_status = 'approved') THEN
      RAISE EXCEPTION 'Geçersiz durum geçişi: % -> %. Bu işlem için cancel_reservation veya mark_attendance kullanın.', v_res.status, p_status;
    END IF;
    UPDATE reservations SET status = p_status, updated_at = now() WHERE id = p_reservation_id;
    v_res.status := p_status;
  END IF;

  IF p_scheduled_date IS NOT NULL AND p_scheduled_date <> v_res.scheduled_date THEN
    UPDATE reservations SET scheduled_date = p_scheduled_date, updated_at = now() WHERE id = p_reservation_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.approve_legacy_member(p_member_id uuid, p_admin_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF auth.uid() <> p_admin_id THEN
    RAISE EXCEPTION 'Yetkisiz.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz.';
  END IF;

  UPDATE members
  SET member_status = 'active'
  WHERE id = p_member_id AND deleted_at IS NULL AND pending_legacy_setup = true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assign_membership_to_family(p_admin_id uuid, p_membership_id uuid, p_family_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF auth.uid() <> p_admin_id THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;
  UPDATE memberships SET family_id = p_family_id WHERE id = p_membership_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_admin_reservation(p_member_id uuid, p_admin_id uuid, p_trainer_id uuid, p_scheduled_date date, p_start_time time without time zone, p_end_time time without time zone, p_status text DEFAULT 'approved'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_membership_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF auth.uid() <> p_admin_id THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;
  SELECT id INTO v_membership_id FROM memberships
  WHERE member_id = p_member_id AND is_current = true
  ORDER BY start_date DESC LIMIT 1;

  IF EXISTS (SELECT 1 FROM reservations WHERE trainer_id = p_trainer_id
    AND scheduled_date = p_scheduled_date AND start_time = p_start_time AND status != 'cancelled') THEN
    RAISE EXCEPTION 'Bu slot dolu';
  END IF;

  INSERT INTO reservations (member_id, membership_id, trainer_id, scheduled_date, start_time, end_time, status, type)
  VALUES (p_member_id, v_membership_id, p_trainer_id, p_scheduled_date, p_start_time, p_end_time, p_status, 'general');

  IF p_status IN ('approved', 'completed', 'no_show') AND v_membership_id IS NOT NULL THEN
    IF p_status = 'approved' THEN
      UPDATE memberships SET reserved_lessons = reserved_lessons + 1 WHERE id = v_membership_id;
    ELSE
      UPDATE memberships SET used_lessons = used_lessons + 1 WHERE id = v_membership_id;
    END IF;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_direct_membership(p_member_id uuid, p_admin_id uuid, p_package_id uuid, p_request_type text, p_payment_amount numeric, p_payment_method text, p_start_date date DEFAULT CURRENT_DATE, p_end_date date DEFAULT NULL::date, p_used_lessons integer DEFAULT 0)
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF auth.uid() <> p_admin_id THEN
    RAISE EXCEPTION 'Yetkisiz.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz.';
  END IF;
  SELECT * INTO v_package FROM membership_packages WHERE id = p_package_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paket bulunamadi'; END IF;

  v_price       := CASE WHEN p_request_type = 'weekday' THEN v_package.weekday_price ELSE v_package.general_price END;
  v_lesson_price := CASE WHEN v_package.lesson_count > 0 THEN v_price / v_package.lesson_count ELSE 0 END;
  v_new_end     := COALESCE(p_end_date, p_start_date + (v_package.duration_months || ' months')::INTERVAL);

  SELECT family_id INTO v_family_id FROM family_members WHERE member_id = p_member_id LIMIT 1;

  SELECT id, end_date INTO v_existing_ms
  FROM memberships WHERE member_id = p_member_id AND is_current = true
  ORDER BY end_date DESC LIMIT 1;

  IF FOUND THEN
    UPDATE memberships SET is_current = false WHERE id = v_existing_ms.id;
  END IF;

  INSERT INTO memberships (
    member_id, package_id, type, total_lessons, used_lessons, reserved_lessons,
    original_price, final_price, price_snapshot, lesson_price_snapshot,
    payment_status, payment_amount, start_date, purchase_date,
    end_date, actual_start_date, is_current, family_id
  ) VALUES (
    p_member_id, p_package_id, p_request_type,
    v_package.lesson_count, p_used_lessons, 0,
    v_price, p_payment_amount, v_price, v_lesson_price,
    'approved', p_payment_amount, p_start_date, CURRENT_DATE,
    v_new_end, p_start_date,
    v_package.lesson_count > p_used_lessons, v_family_id
  ) RETURNING id INTO v_membership_id;

  INSERT INTO payment_transactions (member_id, membership_id, amount, payment_method, payment_date, created_by)
  VALUES (p_member_id, v_membership_id, p_payment_amount, p_payment_method, p_start_date, p_admin_id);

  UPDATE members SET member_status = 'active' WHERE id = p_member_id AND member_status = 'pending_club_approval';

  RETURN v_membership_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_family_group(p_admin_id uuid, p_name text, p_leader_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_family_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF auth.uid() <> p_admin_id THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;
  INSERT INTO families (name) VALUES (p_name) RETURNING id INTO v_family_id;
  INSERT INTO family_members (family_id, member_id, is_leader) VALUES (v_family_id, p_leader_id, true);
  RETURN v_family_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_passive_member(p_admin_id uuid, p_name text, p_surname text, p_phone text, p_email text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_member_id UUID;
  v_code TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF auth.uid() <> p_admin_id THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;
  LOOP
    v_code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM members WHERE referral_code = v_code);
  END LOOP;
  INSERT INTO members (name, surname, phone, email, member_status, is_passive, referral_code)
  VALUES (p_name, p_surname, p_phone, COALESCE(p_email, ''), 'inactive', true, v_code)
  RETURNING id INTO v_member_id;
  RETURN v_member_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_membership(p_membership_id uuid, p_admin_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF auth.uid() <> p_admin_id THEN
    RAISE EXCEPTION 'Yetkisiz.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz.';
  END IF;
  -- Sadece bekleyen/onaylı rezervasyonları iptal et (geçmiş dersler korunur)
  UPDATE reservations SET status = 'cancelled'
  WHERE membership_id = p_membership_id AND status IN ('pending','approved');
  -- Ödeme kaydını sil
  DELETE FROM payment_transactions WHERE membership_id = p_membership_id;
  -- Paketi sil (FK ON DELETE SET NULL sayesinde completed/no_show dersler korunur)
  DELETE FROM memberships WHERE id = p_membership_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_stats(user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF auth.uid() <> get_admin_stats.user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = get_admin_stats.user_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT json_build_object(
    'total_members', (SELECT COUNT(*) FROM members WHERE member_status = 'active'),
    'active_memberships', (SELECT COUNT(*) FROM memberships WHERE is_current = true),
    'pending_reservations', (SELECT COUNT(*) FROM reservations WHERE status = 'pending'),
    'monthly_revenue', COALESCE(
      (SELECT SUM(amount)
       FROM payment_transactions
       WHERE created_at >= date_trunc('month', CURRENT_DATE)
      ), 0
    )
  ) INTO result;

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.link_member_accounts(p_new_member_id uuid, p_passive_member_id uuid, p_admin_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF auth.uid() <> p_admin_id THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;
  SELECT user_id INTO v_user_id FROM members WHERE id = p_new_member_id;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Yeni üye bulunamadı'; END IF;

  -- Tüm verileri pasif üyeden yeni üyeye aktar
  UPDATE memberships     SET member_id = p_new_member_id WHERE member_id = p_passive_member_id;
  UPDATE reservations    SET member_id = p_new_member_id WHERE member_id = p_passive_member_id;
  UPDATE payment_transactions SET member_id = p_new_member_id WHERE member_id = p_passive_member_id;
  UPDATE member_allowed_trainers SET member_id = p_new_member_id WHERE member_id = p_passive_member_id;

  -- Pasif üyenin bilgilerini yeni üyeye kopyala (boşsa)
  UPDATE members m SET
    default_trainer_id = COALESCE(m.default_trainer_id, p.default_trainer_id),
    linked_passive_member_id = p_passive_member_id
  FROM members p WHERE m.id = p_new_member_id AND p.id = p_passive_member_id;

  -- Pasif kaydı sil
  UPDATE members SET deleted_at = NOW() WHERE id = p_passive_member_id;
  UPDATE members SET pending_legacy_setup = false WHERE id = p_new_member_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.promote_member_to_trainer(p_member_id uuid, p_admin_id uuid, p_bonus_rate numeric DEFAULT 0, p_shift text DEFAULT 'fullday'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_member RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF auth.uid() <> p_admin_id THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;
  SELECT m.id, m.user_id, m.name, m.surname INTO v_member
  FROM members m WHERE m.id = p_member_id AND m.deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Üye bulunamadı.'; END IF;
  IF EXISTS (SELECT 1 FROM trainers WHERE user_id = v_member.user_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Bu kullanıcı zaten eğitmen.';
  END IF;
  IF p_shift NOT IN ('morning', 'evening', 'fullday') THEN
    RAISE EXCEPTION 'Geçersiz vardiya.';
  END IF;
  INSERT INTO trainers (user_id, name, surname, bonus_rate, shift)
  VALUES (v_member.user_id, v_member.name, v_member.surname, p_bonus_rate, p_shift);
  UPDATE profiles SET role = 'trainer' WHERE id = v_member.user_id;
  UPDATE members SET deleted_at = NOW() WHERE id = p_member_id;
  UPDATE reservations SET status = 'cancelled' WHERE member_id = p_member_id AND status IN ('pending', 'approved');
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_membership_request(p_admin_id uuid, p_request_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF auth.uid() <> p_admin_id THEN
    RAISE EXCEPTION 'Yetkisiz.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz.';
  END IF;

  UPDATE membership_requests
  SET status = 'rejected', reviewed_at = now(), reviewed_by = p_admin_id
  WHERE id = p_request_id AND status = 'pending';
END;
$function$;

CREATE OR REPLACE FUNCTION public.remove_family_member(p_admin_id uuid, p_family_id uuid, p_member_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF auth.uid() <> p_admin_id THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;
  DELETE FROM family_members WHERE family_id = p_family_id AND member_id = p_member_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_family_setup(p_member_id uuid, p_admin_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_family_id uuid;
  v_leader_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF auth.uid() <> p_admin_id THEN
    RAISE EXCEPTION 'Yetkisiz.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz.';
  END IF;

  UPDATE members
  SET pending_family_setup = false, member_status = 'active'
  WHERE id = p_member_id AND deleted_at IS NULL;

  SELECT family_id INTO v_family_id FROM family_members WHERE member_id = p_member_id LIMIT 1;

  IF v_family_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM memberships WHERE family_id = v_family_id) THEN
    SELECT member_id INTO v_leader_id FROM family_members
      WHERE family_id = v_family_id AND is_leader = true LIMIT 1;

    IF v_leader_id IS NOT NULL THEN
      UPDATE memberships
      SET family_id = v_family_id
      WHERE member_id = v_leader_id AND is_current = true AND family_id IS NULL;
    END IF;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_member_status(p_admin_id uuid, p_member_id uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF auth.uid() <> p_admin_id THEN
    RAISE EXCEPTION 'Yetkisiz.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz.';
  END IF;

  IF p_status NOT IN ('active', 'inactive', 'pending_club_approval') THEN
    RAISE EXCEPTION 'Geçersiz üye durumu: %', p_status;
  END IF;

  UPDATE members
  SET member_status = p_status
  WHERE id = p_member_id AND deleted_at IS NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_member_trainer(p_member_id uuid, p_trainer_id uuid, p_admin_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF auth.uid() <> p_admin_id THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;

  -- default_trainer_id güncelle
  UPDATE members SET default_trainer_id = p_trainer_id, updated_at = NOW()
  WHERE id = p_member_id;

  -- Mevcut member_allowed_trainers temizle
  DELETE FROM member_allowed_trainers WHERE member_id = p_member_id;

  -- Yeni eğitmen varsa ekle
  IF p_trainer_id IS NOT NULL THEN
    INSERT INTO member_allowed_trainers (member_id, trainer_id, created_by)
    VALUES (p_member_id, p_trainer_id, p_admin_id)
    ON CONFLICT (member_id, trainer_id) DO NOTHING;
  END IF;
END;
$function$;

-- =========================================================================
-- B) ÜYE KENDİ KENDİNE HİZMET FONKSİYONLARI (auth.uid() = p_user_id/user_id)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.cancel_reservation(p_reservation_id uuid, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_res RECORD;
  v_lesson_ts TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;

  SELECT r.id, r.status, r.member_id, r.membership_id, r.scheduled_date, r.start_time
  INTO v_res
  FROM reservations r
  JOIN members m ON m.id = r.member_id
  WHERE r.id = p_reservation_id
    AND m.user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rezervasyon bulunamadı veya yetkiniz yok.';
  END IF;

  IF v_res.status NOT IN ('pending', 'approved') THEN
    RAISE EXCEPTION 'Bu rezervasyon % durumunda, iptal edilemez.', v_res.status;
  END IF;

  -- 12 saat kuralı
  v_lesson_ts := (v_res.scheduled_date + v_res.start_time)::TIMESTAMP AT TIME ZONE 'Europe/Istanbul';
  IF v_lesson_ts - NOW() < INTERVAL '12 hours' THEN
    RAISE EXCEPTION '12 saat kuralı: Ders başlamadan en az 12 saat önce iptal yapılmalıdır.';
  END IF;

  UPDATE reservations SET status = 'cancelled' WHERE id = p_reservation_id;

  -- Her iki durumda da (pending veya approved) reserved_lessons düşür
  IF v_res.membership_id IS NOT NULL THEN
    UPDATE memberships
    SET reserved_lessons = GREATEST(0, reserved_lessons - 1)
    WHERE id = v_res.membership_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_signup(p_user_id uuid, p_name text, p_surname text, p_email text, p_phone text, p_referral_code text DEFAULT NULL::text)
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;

  -- Aynı telefon numarasıyla aktif üye var mı?
  IF EXISTS (
    SELECT 1 FROM members
    WHERE phone = p_phone AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Bu telefon numarasıyla kayıtlı bir hesap zaten mevcut. Giriş yapmayı deneyin.';
  END IF;

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

CREATE OR REPLACE FUNCTION public.complete_signup(p_user_id uuid, p_name text, p_surname text, p_email text, p_phone text, p_referral_code text DEFAULT NULL::text, p_trial boolean DEFAULT false)
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;

  -- Aynı telefon numarasıyla aktif üye var mı?
  IF EXISTS (
    SELECT 1 FROM members
    WHERE phone = p_phone AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Bu telefon numarasıyla kayıtlı bir hesap zaten mevcut. Giriş yapmayı deneyin.';
  END IF;

  LOOP
    v_new_code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM members WHERE referral_code = v_new_code);
  END LOOP;

  INSERT INTO public.profiles (id, role) VALUES (p_user_id, 'member');

  INSERT INTO public.members (user_id, name, surname, email, phone, member_status, referral_code, trial_lesson_requested)
  VALUES (p_user_id, p_name, p_surname, p_email, p_phone, 'pending_club_approval', v_new_code, p_trial);

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

CREATE OR REPLACE FUNCTION public.create_membership_request(user_id uuid, p_package_id uuid, p_request_type text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  member_record record;
  result json;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF auth.uid() <> create_membership_request.user_id THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;

  SELECT m.id INTO member_record
  FROM members m
  WHERE m.user_id = create_membership_request.user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  INSERT INTO membership_requests (
    member_id,
    package_id,
    request_type,
    status
  ) VALUES (
    member_record.id,
    p_package_id,
    p_request_type,
    'pending'
  );

  SELECT json_build_object('success', true) INTO result;
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_reservation(user_id uuid, p_trainer_id uuid, p_scheduled_date date, p_start_time time without time zone, p_end_time time without time zone, p_reservation_type text DEFAULT 'general'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  member_record     record;
  membership_record record;
  result            json;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF auth.uid() <> create_reservation.user_id THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;

  SELECT m.id, m.member_status INTO member_record FROM members m WHERE m.user_id = create_reservation.user_id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;

  IF member_record.member_status != 'active' THEN
    RAISE EXCEPTION 'Üyeliğiniz pasif durumdadır, ders alamazsınız.';
  END IF;

  -- Önce kendi paketlerine bak, sonra aile paketine
  SELECT * INTO membership_record FROM memberships
  WHERE member_id = member_record.id
    AND family_id IS NULL
    AND (total_lessons - used_lessons - reserved_lessons) > 0
  ORDER BY is_current DESC, created_at ASC LIMIT 1;

  IF NOT FOUND THEN
    SELECT ms.* INTO membership_record
    FROM memberships ms
    JOIN family_members fm ON fm.family_id = ms.family_id
    WHERE fm.member_id = member_record.id
      AND ms.family_id IS NOT NULL
      AND (ms.total_lessons - ms.used_lessons - ms.reserved_lessons) > 0
    ORDER BY ms.is_current DESC, ms.created_at ASC LIMIT 1;
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.create_trial_reservation(p_user_id uuid, p_scheduled_date date, p_start_time time without time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_trainer_id uuid := 'a59a033b-0ca9-4b38-9c95-b4474b098a3a';
  v_member_id  uuid;
  v_used       boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;

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
  VALUES (v_member_id, NULL, v_trainer_id, p_scheduled_date, p_start_time, p_start_time + INTERVAL '15 minutes', 'approved', 'trial');

  UPDATE members SET trial_lesson_used = true WHERE id = v_member_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_trial_slots(p_user_id uuid, p_selected_date date)
 RETURNS TABLE(trainer_id uuid, trainer_name text, slot_time time without time zone, is_available boolean, slot_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_trainer_id uuid := 'a59a033b-0ca9-4b38-9c95-b4474b098a3a';
  v_trainer_name text;
  member_record record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;

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
$function$;

-- =========================================================================
-- C) PAYLAŞILAN (self OR admin/trainer) OKUMA FONKSİYONLARI
--    Kalıp: get_trainer_daily_lessons ile aynı — kendi verinse otomatik izin,
--    başkasınınkiyse rol kontrolü.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.member_dashboard_stats(user_id uuid)
 RETURNS TABLE(total_lessons bigint, used_lessons bigint, remaining_lessons bigint, reserved_lessons bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF auth.uid() <> member_dashboard_stats.user_id
     AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','trainer')) THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.get_family_reservations(p_member_id uuid, p_status text[])
 RETURNS TABLE(id uuid, scheduled_date date, start_time time without time zone, end_time time without time zone, status text, member_id uuid, member_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_family_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF p_member_id <> get_my_member_id()
     AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','trainer')) THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;

  SELECT fm.family_id INTO v_family_id
  FROM family_members fm
  WHERE fm.member_id = p_member_id
  LIMIT 1;

  IF v_family_id IS NULL THEN
    -- Aile üyesi değil — sadece kendi rezervasyonlarını döndür
    RETURN QUERY
      SELECT r.id, r.scheduled_date, r.start_time, r.end_time, r.status::text,
             r.member_id, (m.name || ' ' || m.surname)::text
      FROM reservations r
      JOIN members m ON m.id = r.member_id
      WHERE r.member_id = p_member_id
        AND r.status = ANY(p_status)
      ORDER BY r.scheduled_date DESC;
  ELSE
    -- Ailenin tüm üyelerinin rezervasyonlarını döndür
    RETURN QUERY
      SELECT r.id, r.scheduled_date, r.start_time, r.end_time, r.status::text,
             r.member_id, (m.name || ' ' || m.surname)::text
      FROM reservations r
      JOIN members m ON m.id = r.member_id
      JOIN memberships ms ON ms.id = r.membership_id
      WHERE ms.family_id = v_family_id
        AND r.status = ANY(p_status)
      ORDER BY r.scheduled_date DESC;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_available_slots(user_id uuid, selected_date date)
 RETURNS TABLE(trainer_id uuid, trainer_name text, slot_time time without time zone, is_available boolean, slot_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  member_record  record;
  trainer_record record;
  v_shift        text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF auth.uid() <> get_available_slots.user_id
     AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','trainer')) THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;

  SELECT m.id, m.default_trainer_id
  INTO member_record
  FROM members m
  WHERE m.user_id = get_available_slots.user_id
    AND m.deleted_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Üye bulunamadı';
  END IF;

  IF EXTRACT(DOW FROM selected_date) = 1 THEN
    IF NOT EXISTS (
      SELECT 1 FROM trainer_schedules ts
      JOIN (
        SELECT t.id AS tid FROM trainers t
        WHERE t.deleted_at IS NULL
          AND (t.id = member_record.default_trainer_id
            OR EXISTS (SELECT 1 FROM member_allowed_trainers mat
                       WHERE mat.member_id = member_record.id AND mat.trainer_id = t.id))
        LIMIT 1
      ) tl ON ts.trainer_id = tl.tid
      WHERE ts.scheduled_date = selected_date AND ts.is_available = true
    ) THEN
      RETURN;
    END IF;
  END IF;

  SELECT t.id AS tid, t.name || ' ' || t.surname AS tname, t.shift AS tshift
  INTO trainer_record
  FROM trainers t
  WHERE t.deleted_at IS NULL
    AND (t.id = member_record.default_trainer_id
      OR EXISTS (SELECT 1 FROM member_allowed_trainers mat
                 WHERE mat.member_id = member_record.id AND mat.trainer_id = t.id))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT tds.shift INTO v_shift
  FROM trainer_daily_shifts tds
  WHERE tds.trainer_id = trainer_record.tid AND tds.scheduled_date = selected_date;

  v_shift := COALESCE(v_shift, trainer_record.tshift, 'fullday');

  RETURN QUERY
  WITH base_slots AS (
    SELECT (
      CASE v_shift
        WHEN 'evening' THEN '15:00:00'::time
        WHEN 'fullday' THEN '11:00:00'::time
        ELSE '10:30:00'::time
      END
      + (n * '00:30:00'::interval)
    )::time AS st
    FROM generate_series(0, CASE v_shift
        WHEN 'evening' THEN 14
        WHEN 'fullday' THEN 22
        ELSE 19
      END) AS n
  ),
  extra_slots AS (
    SELECT ts.start_time AS st FROM trainer_schedules ts
    WHERE ts.trainer_id = trainer_record.tid AND ts.scheduled_date = selected_date
      AND ts.is_available = true AND ts.start_time IN ('22:30:00','23:00:00')
  ),
  slots AS (
    SELECT st FROM base_slots
    UNION
    SELECT st FROM extra_slots
  )
  SELECT
    trainer_record.tid,
    trainer_record.tname,
    s.st,
    (
      (selected_date > CURRENT_DATE OR (selected_date = CURRENT_DATE AND s.st > ((CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::time + INTERVAL '4 hours')))
      AND NOT EXISTS (SELECT 1 FROM reservations r WHERE r.trainer_id = trainer_record.tid AND r.scheduled_date = selected_date AND r.start_time = s.st AND r.status != 'cancelled')
      AND NOT EXISTS (SELECT 1 FROM trainer_schedules ts WHERE ts.trainer_id = trainer_record.tid AND ts.scheduled_date = selected_date AND ts.start_time = s.st AND ts.is_available = false)
    )::boolean,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM reservations r
        WHERE r.trainer_id = trainer_record.tid AND r.scheduled_date = selected_date
          AND r.start_time = s.st AND r.status != 'cancelled'
          AND r.member_id = member_record.id
      ) THEN 'own_reservation'
      WHEN EXISTS (
        SELECT 1 FROM trainer_schedules ts
        WHERE ts.trainer_id = trainer_record.tid AND ts.scheduled_date = selected_date
          AND ts.start_time = s.st AND ts.is_available = false
      ) THEN 'closed'
      WHEN EXISTS (
        SELECT 1 FROM reservations r
        WHERE r.trainer_id = trainer_record.tid AND r.scheduled_date = selected_date
          AND r.start_time = s.st AND r.status != 'cancelled'
      ) THEN 'reserved'
      WHEN NOT (selected_date > CURRENT_DATE OR (selected_date = CURRENT_DATE AND s.st > ((CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::time + INTERVAL '4 hours')))
        THEN 'past'
      ELSE 'available'
    END
  FROM slots s
  ORDER BY s.st;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_trainer_stats(p_trainer_id uuid)
 RETURNS TABLE(today_lessons bigint, week_lessons bigint, completed_lessons bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF p_trainer_id <> get_my_trainer_id()
     AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*) FILTER (
      WHERE r.scheduled_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date
      AND r.status != 'cancelled'
    ),
    COUNT(*) FILTER (
      WHERE r.scheduled_date >= date_trunc('week', (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date)
        AND r.scheduled_date < date_trunc('week', (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date) + INTERVAL '7 days'
      AND r.status != 'cancelled'
    ),
    COUNT(*) FILTER (
      WHERE r.status IN ('completed', 'no_show')
    )
  FROM reservations r
  WHERE r.trainer_id = p_trainer_id;
END;
$function$;

-- =========================================================================
-- D) SIFIR KONTROLLÜ FONKSİYONLAR — admin_cancel_reservation ve
--    trainer_create_reservation özel dikkat gerektiriyordu (madde 7).
--    Admin: tüm kapsamda. Trainer: sadece kendi dersleri/kendi kimliği.
--    3. kişi (anon veya başka üye) artık hiçbir şekilde çağıramaz.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.admin_cancel_reservation(p_reservation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_res RECORD;
  v_caller_role text;
  v_trainer_id  uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;

  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role NOT IN ('admin', 'trainer') THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;

  IF v_caller_role = 'trainer' THEN
    SELECT id INTO v_trainer_id FROM trainers
    WHERE user_id = auth.uid() AND deleted_at IS NULL
    LIMIT 1;

    IF v_trainer_id IS NULL THEN
      RAISE EXCEPTION 'Eğitmen kaydı bulunamadı.';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM reservations WHERE id = p_reservation_id AND trainer_id = v_trainer_id
    ) THEN
      RAISE EXCEPTION 'Bu rezervasyon size ait değil.';
    END IF;
  END IF;

  SELECT id, status, membership_id INTO v_res FROM reservations WHERE id = p_reservation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rezervasyon bulunamadı.'; END IF;
  IF v_res.status = 'cancelled' THEN RETURN; END IF;

  UPDATE reservations SET status = 'cancelled' WHERE id = p_reservation_id;

  IF v_res.membership_id IS NOT NULL THEN
    IF v_res.status IN ('pending','approved') THEN
      UPDATE memberships SET reserved_lessons = GREATEST(0, reserved_lessons - 1) WHERE id = v_res.membership_id;
    ELSIF v_res.status IN ('completed','no_show') THEN
      UPDATE memberships SET used_lessons = GREATEST(0, used_lessons - 1) WHERE id = v_res.membership_id;
    END IF;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trainer_create_reservation(p_member_id uuid, p_trainer_id uuid, p_scheduled_date date, p_start_time time without time zone, p_end_time time without time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_membership_id uuid;
  v_status        text;
  v_caller_id     uuid;
  v_is_admin      boolean;
  v_own_trainer   uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;

  SELECT (role = 'admin') INTO v_is_admin FROM profiles WHERE id = v_caller_id;

  IF NOT COALESCE(v_is_admin, false) THEN
    SELECT id INTO v_own_trainer FROM trainers WHERE user_id = v_caller_id AND deleted_at IS NULL;
    IF v_own_trainer IS NULL OR v_own_trainer <> p_trainer_id THEN
      RAISE EXCEPTION 'Yetkisiz işlem.';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM reservations
    WHERE trainer_id = p_trainer_id
      AND scheduled_date = p_scheduled_date
      AND start_time = p_start_time
      AND status != 'cancelled'
  ) THEN
    RAISE EXCEPTION 'Bu slot dolu';
  END IF;

  -- Kendi paketi: fiili baslangic bossa satin alma tarihini (start_date) kullan
  SELECT id INTO v_membership_id FROM memberships
  WHERE member_id = p_member_id
    AND family_id IS NULL
    AND COALESCE(actual_start_date, start_date) IS NOT NULL
    AND COALESCE(actual_start_date, start_date) <= p_scheduled_date
    AND (end_date IS NULL OR end_date >= p_scheduled_date)
  ORDER BY COALESCE(actual_start_date, start_date) DESC LIMIT 1;

  IF NOT FOUND THEN
    SELECT ms.id INTO v_membership_id FROM memberships ms
    JOIN family_members fm ON fm.family_id = ms.family_id
    WHERE fm.member_id = p_member_id
      AND ms.family_id IS NOT NULL
      AND COALESCE(ms.actual_start_date, ms.start_date) IS NOT NULL
      AND COALESCE(ms.actual_start_date, ms.start_date) <= p_scheduled_date
      AND (ms.end_date IS NULL OR ms.end_date >= p_scheduled_date)
    ORDER BY COALESCE(ms.actual_start_date, ms.start_date) DESC LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paketin suresi bitmistir, lutfen yenileyiniz.';
  END IF;

  v_status := CASE
    WHEN p_scheduled_date > CURRENT_DATE THEN 'approved'
    ELSE 'completed'
  END;

  INSERT INTO reservations (
    member_id, membership_id, trainer_id,
    scheduled_date, start_time, end_time, status, type
  ) VALUES (
    p_member_id, v_membership_id, p_trainer_id,
    p_scheduled_date, p_start_time, p_end_time, v_status, 'general'
  );

  IF v_status = 'completed' THEN
    UPDATE memberships SET used_lessons = used_lessons + 1 WHERE id = v_membership_id;
  END IF;
END;
$function$;

-- =========================================================================
-- E) ÜYE PROFİL GÜNCELLEME (TC kimlik / veli bilgisi gibi hassas alanlar)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.update_member_profile(p_user_id uuid, p_tc_kimlik text, p_dogum_yeri text, p_date_of_birth date, p_emergency_phone text, p_baba_adi text DEFAULT NULL::text, p_anne_adi text DEFAULT NULL::text, p_meslek text DEFAULT NULL::text, p_ogretim_durumu text DEFAULT NULL::text, p_adres text DEFAULT NULL::text, p_photo_url text DEFAULT NULL::text, p_veli_adi_soyadi text DEFAULT NULL::text, p_veli_telefon text DEFAULT NULL::text, p_veli_iliskisi text DEFAULT NULL::text, p_veli_tc_kimlik text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_member_id UUID;
  v_age       INT;
  v_is_minor  BOOLEAN;
  v_completed BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;
  IF auth.uid() <> p_user_id
     AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;

  SELECT id INTO v_member_id FROM members WHERE user_id = p_user_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Üye bulunamadı'; END IF;

  -- Aynı TC kimlik numarasıyla başka bir üye var mı?
  IF p_tc_kimlik IS NOT NULL AND p_tc_kimlik != '' THEN
    IF EXISTS (
      SELECT 1 FROM member_sensitive_data msd
      JOIN members m ON m.id = msd.member_id
      WHERE msd.tc_kimlik = p_tc_kimlik
        AND msd.member_id != v_member_id
        AND m.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Bu TC kimlik numarasıyla kayıtlı bir hesap zaten mevcut.';
    END IF;
  END IF;

  -- Yaş hesapla
  v_age      := DATE_PART('year', AGE(p_date_of_birth));
  v_is_minor := v_age <= 18;

  -- 18 yaş altı ise veli bilgileri zorunlu
  IF v_is_minor AND (p_veli_adi_soyadi IS NULL OR p_veli_adi_soyadi = '') THEN
    RAISE EXCEPTION '18 yaş altı üyeler için veli adı soyadı zorunludur.';
  END IF;
  IF v_is_minor AND (p_veli_telefon IS NULL OR p_veli_telefon = '') THEN
    RAISE EXCEPTION '18 yaş altı üyeler için veli telefonu zorunludur.';
  END IF;

  -- TC Kimlik ayrı tabloya
  INSERT INTO member_sensitive_data (member_id, tc_kimlik)
  VALUES (v_member_id, p_tc_kimlik)
  ON CONFLICT (member_id) DO UPDATE SET tc_kimlik = EXCLUDED.tc_kimlik, updated_at = NOW();

  -- Profile tamamlanma kontrolü
  v_completed := (
    p_tc_kimlik IS NOT NULL AND p_tc_kimlik != ''
    AND p_dogum_yeri IS NOT NULL AND p_dogum_yeri != ''
    AND p_date_of_birth IS NOT NULL
    AND p_emergency_phone IS NOT NULL AND p_emergency_phone != ''
    AND (NOT v_is_minor OR (p_veli_adi_soyadi IS NOT NULL AND p_veli_telefon IS NOT NULL))
  );

  UPDATE members SET
    dogum_yeri              = p_dogum_yeri,
    date_of_birth           = p_date_of_birth,
    emergency_contact_phone = p_emergency_phone,
    baba_adi                = p_baba_adi,
    anne_adi                = p_anne_adi,
    meslek                  = p_meslek,
    ogretim_durumu          = p_ogretim_durumu,
    adres                   = p_adres,
    profile_photo_url       = COALESCE(p_photo_url, profile_photo_url),
    is_minor                = v_is_minor,
    veli_adi_soyadi         = p_veli_adi_soyadi,
    veli_telefon            = p_veli_telefon,
    veli_iliskisi           = p_veli_iliskisi,
    veli_tc_kimlik          = p_veli_tc_kimlik,
    profile_completed       = v_completed,
    updated_at              = NOW()
  WHERE id = v_member_id;
END;
$function$;

-- =========================================================================
-- F) search_path SERTLEŞTİRME — SECURITY DEFINER yardımcı fonksiyonlar
--    (madde 6). Mantık değişmedi, sadece SET search_path eklendi.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT role FROM public.profiles WHERE id = auth.uid() $function$;

CREATE OR REPLACE FUNCTION public.get_my_member_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT id FROM public.members WHERE user_id = auth.uid() AND deleted_at IS NULL LIMIT 1 $function$;

CREATE OR REPLACE FUNCTION public.get_my_trainer_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT id FROM public.trainers WHERE user_id = auth.uid() AND deleted_at IS NULL LIMIT 1 $function$;
