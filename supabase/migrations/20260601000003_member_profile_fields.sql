-- =============================================
-- 1. members tablosuna yeni alanlar
-- =============================================
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS dogum_yeri        TEXT,
  ADD COLUMN IF NOT EXISTS baba_adi          TEXT,
  ADD COLUMN IF NOT EXISTS anne_adi          TEXT,
  ADD COLUMN IF NOT EXISTS meslek            TEXT,
  ADD COLUMN IF NOT EXISTS ogretim_durumu    TEXT,
  ADD COLUMN IF NOT EXISTS adres             TEXT,
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE;

-- date_of_birth ve emergency_contact_phone zaten var

-- =============================================
-- 2. TC Kimlik için ayrı kısıtlı tablo (sadece admin okuyabilir)
-- =============================================
CREATE TABLE IF NOT EXISTS public.member_sensitive_data (
  member_id   UUID PRIMARY KEY REFERENCES public.members(id) ON DELETE CASCADE,
  tc_kimlik   TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.member_sensitive_data ENABLE ROW LEVEL SECURITY;

-- Üye kendi TC'sini yazabilir, hiç kimse okuyamaz (admin hariç)
DROP POLICY IF EXISTS "sensitive_insert_own"  ON public.member_sensitive_data;
DROP POLICY IF EXISTS "sensitive_update_own"  ON public.member_sensitive_data;
DROP POLICY IF EXISTS "sensitive_admin_all"   ON public.member_sensitive_data;

CREATE POLICY "sensitive_insert_own" ON public.member_sensitive_data
  FOR INSERT WITH CHECK (
    member_id = (SELECT id FROM public.members WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "sensitive_update_own" ON public.member_sensitive_data
  FOR UPDATE USING (
    member_id = (SELECT id FROM public.members WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "sensitive_admin_all" ON public.member_sensitive_data
  FOR ALL USING (public.get_my_role() = 'admin');

-- =============================================
-- 3. Profil güncelleme RPC
-- =============================================
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
  p_photo_url        TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id UUID;
  v_completed BOOLEAN;
BEGIN
  SELECT id INTO v_member_id FROM members WHERE user_id = p_user_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Üye bulunamadı'; END IF;

  -- TC Kimlik ayrı tabloya
  INSERT INTO member_sensitive_data (member_id, tc_kimlik)
  VALUES (v_member_id, p_tc_kimlik)
  ON CONFLICT (member_id) DO UPDATE SET tc_kimlik = EXCLUDED.tc_kimlik, updated_at = NOW();

  -- Profil alanlarını güncelle
  UPDATE members SET
    dogum_yeri          = p_dogum_yeri,
    date_of_birth       = p_date_of_birth,
    emergency_contact_phone = p_emergency_phone,
    baba_adi            = p_baba_adi,
    anne_adi            = p_anne_adi,
    meslek              = p_meslek,
    ogretim_durumu      = p_ogretim_durumu,
    adres               = p_adres,
    profile_photo_url   = COALESCE(p_photo_url, profile_photo_url),
    profile_completed   = (p_tc_kimlik IS NOT NULL AND p_tc_kimlik != ''
                           AND p_dogum_yeri IS NOT NULL AND p_dogum_yeri != ''
                           AND p_date_of_birth IS NOT NULL
                           AND p_emergency_phone IS NOT NULL AND p_emergency_phone != ''),
    updated_at          = NOW()
  WHERE id = v_member_id;
END;
$$;

-- =============================================
-- 4. Supabase Storage: member-photos bucket
-- =============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('member-photos', 'member-photos', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Üye kendi fotoğrafını yükleyebilir
DROP POLICY IF EXISTS "member_photo_upload" ON storage.objects;
DROP POLICY IF EXISTS "member_photo_public_read" ON storage.objects;

CREATE POLICY "member_photo_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'member-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "member_photo_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'member-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "member_photo_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'member-photos');
