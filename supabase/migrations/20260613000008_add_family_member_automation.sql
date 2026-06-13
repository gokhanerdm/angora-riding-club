-- Admin "Aile Grupları" sayfasında "+ Üye Ekle" ile bir üyeyi aileye eklediğinde,
-- artık tek tıkla:
--  1) Üye family_members'a eklenir (eskiden de yapılıyordu)
--  2) Üyenin pending_family_setup bayrağı kapanır ve member_status='active' olur
--     (İstekler'de ayrıca "Tamamlandı" demeye gerek kalmaz)
--  3) Ailenin henüz bağlı bir paketi yoksa, ana üyenin aktif paketi otomatik
--     olarak bu aileye bağlanır (eskiden "Üyelik Bağla" ile elle yapılıyordu)
-- Bu sayede her aile üyesi eklemesinde tekrarlanan elle adımlar ortadan kalkar.

CREATE OR REPLACE FUNCTION public.add_family_member(p_admin_id uuid, p_family_id uuid, p_member_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_leader_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;

  INSERT INTO family_members (family_id, member_id, is_leader)
  VALUES (p_family_id, p_member_id, false)
  ON CONFLICT (family_id, member_id) DO NOTHING;

  UPDATE members
  SET pending_family_setup = false, member_status = 'active'
  WHERE id = p_member_id AND deleted_at IS NULL;

  IF NOT EXISTS (SELECT 1 FROM memberships WHERE family_id = p_family_id) THEN
    SELECT member_id INTO v_leader_id FROM family_members
      WHERE family_id = p_family_id AND is_leader = true LIMIT 1;

    IF v_leader_id IS NOT NULL THEN
      UPDATE memberships
      SET family_id = p_family_id
      WHERE member_id = v_leader_id AND is_current = true AND family_id IS NULL;
    END IF;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.debug_get_funcdef(text);
