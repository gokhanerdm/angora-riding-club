-- "membership_requests" tablosuna doğrudan .update() ile reddetme işlemi iki ayrı admin
-- ekranında (membership-requests ve memberships sayfaları) tekrarlanıyordu — RPC'ye taşındı.
CREATE OR REPLACE FUNCTION public.reject_membership_request(p_admin_id uuid, p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz.';
  END IF;

  UPDATE membership_requests
  SET status = 'rejected', reviewed_at = now(), reviewed_by = p_admin_id
  WHERE id = p_request_id AND status = 'pending';
END;
$function$;
