-- Security fix: request_legacy_setup ve request_family_setup
-- Herhangi bir oturum açmış kullanıcı başka bir user_id ile bu RPC'leri çağırabiliyordu.
-- Kontrol: auth.uid() = p_user_id VEYA çağıran admin rolünde.

CREATE OR REPLACE FUNCTION public.request_legacy_setup(p_user_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;

  IF auth.uid() <> p_user_id AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;

  UPDATE members SET pending_legacy_setup = true
  WHERE user_id = p_user_id AND deleted_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_family_setup(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;

  IF auth.uid() <> p_user_id AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;

  UPDATE members SET pending_family_setup = true
  WHERE user_id = p_user_id AND deleted_at IS NULL;
END;
$$;
