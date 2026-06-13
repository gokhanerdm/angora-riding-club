-- Aile üyesi talebi "Tamamlandı" yapıldığında, ailenin ana üyesinin aktif
-- paketi henüz aileye bağlanmamışsa (family_id IS NULL) otomatik bağlanır.
-- Önceden bu adım admin tarafından "Aile Grupları" sayfasından elle
-- "Üyelik Bağla" ile yapılıyordu ve unutulduğunda yeni eklenen aile
-- üyesinin takviminde ders/paket görünmüyordu.

CREATE OR REPLACE FUNCTION public.resolve_family_setup(p_member_id uuid, p_admin_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_family_id uuid;
  v_leader_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz.';
  END IF;

  UPDATE members
  SET pending_family_setup = false, member_status = 'active'
  WHERE id = p_member_id AND deleted_at IS NULL;

  SELECT family_id INTO v_family_id FROM family_members WHERE member_id = p_member_id LIMIT 1;

  IF v_family_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM memberships WHERE family_id = v_family_id) THEN
    SELECT member_id INTO v_leader_id FROM family_members
      WHERE family_id = v_family_id AND is_leader = true LIMIT 1;

    IF v_leader_id IS NOT NULL THEN
      UPDATE memberships
      SET family_id = v_family_id
      WHERE member_id = v_leader_id AND is_current = true AND family_id IS NULL;
    END IF;
  END IF;
END;
$$;
