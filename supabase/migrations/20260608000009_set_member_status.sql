-- "members.member_status" alanı iki ayrı admin ekranında (members listesi ve member
-- ayarları sayfası) doğrudan .update() ile değiştiriliyordu — RPC'ye taşındı (tutarlılık + yetki kontrolü).
CREATE OR REPLACE FUNCTION public.set_member_status(p_admin_id uuid, p_member_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
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
