-- "Kullanilan ders" kisinin KENDI kullandigi ders sayisini gostermeli,
-- "Kalan ders" ise ailenin TOPLAM kullanimina gore hesaplanmali (havuzdan dusulur).
-- Onceki versiyon ikisini de aile havuzundan donduruyordu; "kullanilan" yanlis gorunuyordu.

CREATE OR REPLACE FUNCTION public.member_dashboard_stats(user_id uuid)
RETURNS TABLE(total_lessons bigint, used_lessons bigint, remaining_lessons bigint, reserved_lessons bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member_id uuid;
  v_family_id uuid;
  v_own_total bigint;
  v_family_total bigint;
  v_total bigint;
  v_own_used bigint;
  v_family_used bigint;
  v_family_reserved bigint;
  v_own_reserved bigint;
BEGIN
  SELECT id INTO v_member_id FROM members
  WHERE members.user_id = member_dashboard_stats.user_id AND deleted_at IS NULL;

  SELECT family_id INTO v_family_id FROM family_members WHERE member_id = v_member_id LIMIT 1;

  SELECT COALESCE(SUM(mb.total_lessons), 0) INTO v_own_total
  FROM memberships mb WHERE mb.member_id = v_member_id AND mb.family_id IS NULL;

  -- Kisinin kendi kullandigi/rezerve ettigi ders sayisi (kisisel rezervasyonlari uzerinden — havuz degil)
  SELECT COALESCE(COUNT(*), 0) INTO v_own_used
  FROM reservations r WHERE r.member_id = v_member_id AND r.status IN ('completed', 'no_show');

  SELECT COALESCE(COUNT(*), 0) INTO v_own_reserved
  FROM reservations r WHERE r.member_id = v_member_id AND r.status IN ('pending', 'approved');

  IF v_family_id IS NOT NULL THEN
    SELECT COALESCE(SUM(mb.total_lessons), 0) INTO v_family_total
    FROM memberships mb WHERE mb.family_id = v_family_id;

    v_total := v_own_total + v_family_total;

    -- Kalan ders ailenin TOPLAM kullanimina gore hesaplanir (havuzdan dusulur)
    SELECT COALESCE(COUNT(*), 0) INTO v_family_used
    FROM reservations r
    JOIN family_members fm ON fm.member_id = r.member_id
    WHERE fm.family_id = v_family_id AND r.status IN ('completed', 'no_show');

    SELECT COALESCE(COUNT(*), 0) INTO v_family_reserved
    FROM reservations r
    JOIN family_members fm ON fm.member_id = r.member_id
    WHERE fm.family_id = v_family_id AND r.status IN ('pending', 'approved');

    RETURN QUERY SELECT v_total, v_own_used, v_total - v_family_used - v_family_reserved, v_own_reserved;
  ELSE
    SELECT COALESCE(SUM(mb.total_lessons), 0) INTO v_total
    FROM memberships mb WHERE mb.member_id = v_member_id;

    RETURN QUERY SELECT v_total, v_own_used, v_total - v_own_used - v_own_reserved, v_own_reserved;
  END IF;
END;
$$;
