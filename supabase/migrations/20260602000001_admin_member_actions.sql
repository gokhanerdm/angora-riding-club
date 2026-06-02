-- =============================================
-- GÖREV 3: Admin üye adına işlemler
-- =============================================

-- Ekstra ders ekleme
CREATE OR REPLACE FUNCTION public.add_bonus_lessons(
  p_member_id UUID,
  p_admin_id  UUID,
  p_lessons   INT
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
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
$$;

-- Direkt üyelik oluşturma (talep aşaması atlanır)
CREATE OR REPLACE FUNCTION public.create_direct_membership(
  p_member_id      UUID,
  p_admin_id       UUID,
  p_package_id     UUID,
  p_request_type   TEXT,
  p_payment_amount NUMERIC,
  p_payment_method TEXT,
  p_start_date     DATE DEFAULT CURRENT_DATE
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_package    membership_packages%ROWTYPE;
  v_price      NUMERIC;
  v_lesson_price NUMERIC;
  v_membership_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;
  SELECT * INTO v_package FROM membership_packages WHERE id = p_package_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paket bulunamadı'; END IF;
  v_price := CASE WHEN p_request_type = 'weekday' THEN v_package.weekday_price ELSE v_package.general_price END;
  v_lesson_price := CASE WHEN v_package.lesson_count > 0 THEN v_price / v_package.lesson_count ELSE 0 END;

  INSERT INTO memberships (member_id, package_id, type, total_lessons, used_lessons, reserved_lessons,
    original_price, final_price, price_snapshot, lesson_price_snapshot,
    payment_status, payment_amount, start_date, end_date, is_current)
  VALUES (p_member_id, p_package_id, p_request_type, v_package.lesson_count, 0, 0,
    v_price, p_payment_amount, v_price, v_lesson_price,
    'approved', p_payment_amount, p_start_date, p_start_date + INTERVAL '1 year', true)
  RETURNING id INTO v_membership_id;

  INSERT INTO payment_transactions (member_id, membership_id, amount, payment_method, payment_date, created_by)
  VALUES (p_member_id, v_membership_id, p_payment_amount, p_payment_method, CURRENT_DATE, p_admin_id);
END;
$$;

-- Admin rezervasyon oluşturma
CREATE OR REPLACE FUNCTION public.create_admin_reservation(
  p_member_id    UUID,
  p_admin_id     UUID,
  p_trainer_id   UUID,
  p_scheduled_date DATE,
  p_start_time   TIME,
  p_end_time     TIME,
  p_status       TEXT DEFAULT 'approved'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_membership_id UUID;
BEGIN
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
$$;

-- =============================================
-- GÖREV 4 & 5: Kayıtlı üyeyim + Pasif üye
-- =============================================

-- members tablosuna pasif üye ve eski üye desteği
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS is_passive BOOLEAN DEFAULT FALSE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS pending_legacy_setup BOOLEAN DEFAULT FALSE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS linked_passive_member_id UUID;

-- Pasif üye oluşturma (admin)
CREATE OR REPLACE FUNCTION public.create_passive_member(
  p_admin_id UUID,
  p_name     TEXT,
  p_surname  TEXT,
  p_phone    TEXT,
  p_email    TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member_id UUID;
  v_code TEXT;
BEGIN
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
$$;

-- Geçmiş ders toplu ekleme
CREATE OR REPLACE FUNCTION public.add_legacy_lessons(
  p_member_id    UUID,
  p_admin_id     UUID,
  p_membership_id UUID,
  p_lessons      JSONB  -- [{scheduled_date, trainer_id, status, start_time}]
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lesson JSONB;
  v_count  INT := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;
  FOR v_lesson IN SELECT * FROM jsonb_array_elements(p_lessons) LOOP
    INSERT INTO reservations (member_id, membership_id, trainer_id, scheduled_date, start_time, end_time, status, type)
    VALUES (
      p_member_id, p_membership_id,
      (v_lesson->>'trainer_id')::UUID,
      (v_lesson->>'scheduled_date')::DATE,
      COALESCE((v_lesson->>'start_time')::TIME, '10:00:00'::TIME),
      COALESCE((v_lesson->>'end_time')::TIME, '10:30:00'::TIME),
      COALESCE(v_lesson->>'status', 'completed'),
      'general'
    );
    v_count := v_count + 1;
  END LOOP;
  UPDATE memberships SET used_lessons = used_lessons + v_count WHERE id = p_membership_id;
END;
$$;

-- Kayıtlı üyeyim: üye talep açar
CREATE OR REPLACE FUNCTION public.request_legacy_setup(p_user_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE members SET pending_legacy_setup = true WHERE user_id = p_user_id AND deleted_at IS NULL;
END;
$$;

-- =============================================
-- GÖREV 6: Hesap bağlama
-- =============================================

CREATE OR REPLACE FUNCTION public.link_member_accounts(
  p_new_member_id     UUID,
  p_passive_member_id UUID,
  p_admin_id          UUID
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID;
BEGIN
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
$$;
