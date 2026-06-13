-- Aile üyesi talebi admin tarafından "Tamamlandı" yapıldığında, üye
-- pending_club_approval durumunda kalmaya devam ediyordu ve Üyeler
-- listesinde görünmüyordu. Artık aynı adımda member_status='active' olur.

CREATE OR REPLACE FUNCTION public.resolve_family_setup(p_member_id uuid, p_admin_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz.';
  END IF;

  UPDATE members
  SET pending_family_setup = false, member_status = 'active'
  WHERE id = p_member_id AND deleted_at IS NULL;
END;
$$;
