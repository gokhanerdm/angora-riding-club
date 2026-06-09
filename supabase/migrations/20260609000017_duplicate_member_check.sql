-- Telefon ve TC kimlik ile mükerrer kayıt engeli
-- complete_signup: telefon kontrolü
-- update_member_profile: TC kimlik kontrolü

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

-- update_member_profile: TC kimlik duplicate kontrolü ekle
CREATE OR REPLACE FUNCTION public.update_member_profile(
  p_user_id          UUID,
  p_tc_kimlik        TEXT,
  p_dogum_yeri       TEXT,
  p_date_of_birth    DATE,
  p_emergency_phone  TEXT,
  p_baba_adi         TEXT DEFAULT NULL,
  p_anne_adi         TEXT DEFAULT NULL,
  p_meslek           TEXT DEFAULT NULL,
  p_ogretim_durumu   TEXT DEFAULT NULL,
  p_adres            TEXT DEFAULT NULL,
  p_photo_url        TEXT DEFAULT NULL,
  p_veli_adi_soyadi  TEXT DEFAULT NULL,
  p_veli_telefon     TEXT DEFAULT NULL,
  p_veli_iliskisi    TEXT DEFAULT NULL,
  p_veli_tc_kimlik   TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id UUID;
  v_age       INT;
  v_is_minor  BOOLEAN;
  v_completed BOOLEAN;
BEGIN
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
$$;
