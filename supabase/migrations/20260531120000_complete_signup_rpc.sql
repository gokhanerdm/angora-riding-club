-- Kayıt sırasında profiles + members atomik olarak oluşturur.
-- Üç ayrı client çağrısı yerine tek RPC → partial failure riski ortadan kalkar.
CREATE OR REPLACE FUNCTION public.complete_signup(
  p_user_id UUID,
  p_name     TEXT,
  p_surname  TEXT,
  p_email    TEXT,
  p_phone    TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (p_user_id, 'member');

  INSERT INTO public.members (user_id, name, surname, email, phone, member_status)
  VALUES (p_user_id, p_name, p_surname, p_email, p_phone, 'active');
END;
$$;
