-- member_dashboard_stats sadece uyenin KENDI memberships kayitlarini topluyordu;
-- aile grubuna eklenen ama kendi paketi olmayan uyeler icin total=0 donuyor, panelde
-- "Paket yok / kalan -" gorunuyordu. Uyeler listesindeki (admin/members) hesaplamayla
-- AYNI mantik: aile uyesiyse kendi paketi + ailenin paylasilan paketi toplanir,
-- kullanilan/rezerve ders sayisi ailenin TUM uyelerinin rezervasyonlari uzerinden hesaplanir.

CREATE OR REPLACE FUNCTION public.member_dashboard_stats(user_id uuid)
RETURNS TABLE(total_lessons bigint, used_lessons bigint, remaining_lessons bigint, reserved_lessons bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member_id uuid;
  v_family_id uuid;
  v_own_total bigint;
  v_family_total bigint;
  v_total bigint;
  v_used bigint;
  v_reserved bigint;
BEGIN
  SELECT id INTO v_member_id FROM members
  WHERE members.user_id = member_dashboard_stats.user_id AND deleted_at IS NULL;

  SELECT family_id INTO v_family_id FROM family_members WHERE member_id = v_member_id LIMIT 1;

  SELECT COALESCE(SUM(mb.total_lessons), 0) INTO v_own_total
  FROM memberships mb WHERE mb.member_id = v_member_id AND mb.family_id IS NULL;

  IF v_family_id IS NOT NULL THEN
    SELECT COALESCE(SUM(mb.total_lessons), 0) INTO v_family_total
    FROM memberships mb WHERE mb.family_id = v_family_id;

    v_total := v_own_total + v_family_total;

    SELECT COALESCE(COUNT(*), 0) INTO v_used
    FROM reservations r
    JOIN family_members fm ON fm.member_id = r.member_id
    WHERE fm.family_id = v_family_id AND r.status IN ('completed', 'no_show');

    SELECT COALESCE(COUNT(*), 0) INTO v_reserved
    FROM reservations r
    JOIN family_members fm ON fm.member_id = r.member_id
    WHERE fm.family_id = v_family_id AND r.status IN ('pending', 'approved');
  ELSE
    v_total := v_own_total;

    SELECT COALESCE(SUM(mb.used_lessons), 0) INTO v_used
    FROM memberships mb WHERE mb.member_id = v_member_id;

    SELECT COALESCE(SUM(mb.reserved_lessons), 0) INTO v_reserved
    FROM memberships mb WHERE mb.member_id = v_member_id AND mb.is_current = true;
  END IF;

  RETURN QUERY SELECT v_total, v_used, v_total - v_used - v_reserved, v_reserved;
END;
$$;
