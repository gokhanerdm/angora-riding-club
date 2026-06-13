-- Kendi paketi olmayan ve ailenin paylaşılan paketine dahil olacak üye, kayıt
-- ekranında "Aile Üyesiyim" diyebilir. Admin İstekler sayfasında bu kişiyi görür,
-- Aile Grupları'ndan ilgili aileye ekler ve "Tamamlandı" diyerek bayrağı kapatır.

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS pending_family_setup boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.request_family_setup(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE members SET pending_family_setup = true WHERE user_id = p_user_id AND deleted_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_family_setup(p_member_id uuid, p_admin_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz.';
  END IF;

  UPDATE members SET pending_family_setup = false WHERE id = p_member_id AND deleted_at IS NULL;
END;
$$;
