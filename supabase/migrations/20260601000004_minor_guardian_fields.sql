-- 18 yaş altı üyeler için veli bilgileri
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS is_minor          BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS veli_adi_soyadi   TEXT,
  ADD COLUMN IF NOT EXISTS veli_telefon      TEXT,
  ADD COLUMN IF NOT EXISTS veli_iliskisi     TEXT;  -- Anne / Baba / Vasi

-- update_member_profile RPC'yi veli alanlarıyla güncelle
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
  p_veli_iliskisi    TEXT DEFAULT NULL
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
    profile_completed       = v_completed,
    updated_at              = NOW()
  WHERE id = v_member_id;
END;
$$;
