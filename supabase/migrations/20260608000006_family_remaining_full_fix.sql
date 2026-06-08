-- Onceki versiyon "kalan ders"i sadece aile havuzunu duserek hesapliyordu;
-- kisinin KENDI (aileye bagli olmayan) paketlerindeki kullanimi toplam derslerden
-- hic dusulmuyordu — bu da kalan ders sayisini fazla gosteriyordu (Gulem orneginde
-- eski 2 kisisel paketinden kullandigi 8 ders dusulmemisti).
--
-- Dogru formul iki ayri havuzun toplami:
--   (kisisel_toplam - kisisel_kullanim - kisisel_rezerve) + (aile_toplam - aile_kullanim - aile_rezerve)
-- "Kullanilan" gostergesi ise kisinin TUM kendi rezervasyonlari (hangi paketten olursa olsun).

CREATE OR REPLACE FUNCTION public.member_dashboard_stats(user_id uuid)
RETURNS TABLE(total_lessons bigint, used_lessons bigint, remaining_lessons bigint, reserved_lessons bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member_id uuid;
  v_family_id uuid;
  v_own_total bigint;
  v_family_total bigint;
  v_own_used_personal bigint;     -- kisisel paketlerdeki kullanim (havuz disi)
  v_own_reserved_personal bigint;
  v_own_used_total bigint;        -- gosterge: kisinin TUM kullandigi ders (kisisel + aile paketinden kendi payi)
  v_own_reserved_total bigint;
  v_family_used bigint;
  v_family_reserved bigint;
BEGIN
  SELECT id INTO v_member_id FROM members
  WHERE members.user_id = member_dashboard_stats.user_id AND deleted_at IS NULL;

  SELECT family_id INTO v_family_id FROM family_members WHERE member_id = v_member_id LIMIT 1;

  -- Kisinin kendi (aileye bagli olmayan) paketlerinin toplami
  SELECT COALESCE(SUM(mb.total_lessons), 0) INTO v_own_total
  FROM memberships mb WHERE mb.member_id = v_member_id AND mb.family_id IS NULL;

  -- "Kullanilan" gostergesi — kisinin TUM rezervasyonlari (kisisel veya aile paketi farketmez)
  SELECT COALESCE(COUNT(*), 0) INTO v_own_used_total
  FROM reservations r WHERE r.member_id = v_member_id AND r.status IN ('completed', 'no_show');
  SELECT COALESCE(COUNT(*), 0) INTO v_own_reserved_total
  FROM reservations r WHERE r.member_id = v_member_id AND r.status IN ('pending', 'approved');

  -- Kisisel havuzdan dusulecek kullanim — SADECE kendi (family_id NULL) paketine bagli rezervasyonlar
  SELECT COALESCE(COUNT(*), 0) INTO v_own_used_personal
  FROM reservations r
  JOIN memberships ms ON ms.id = r.membership_id
  WHERE r.member_id = v_member_id AND ms.family_id IS NULL AND r.status IN ('completed', 'no_show');
  SELECT COALESCE(COUNT(*), 0) INTO v_own_reserved_personal
  FROM reservations r
  JOIN memberships ms ON ms.id = r.membership_id
  WHERE r.member_id = v_member_id AND ms.family_id IS NULL AND r.status IN ('pending', 'approved');

  IF v_family_id IS NOT NULL THEN
    SELECT COALESCE(SUM(mb.total_lessons), 0) INTO v_family_total
    FROM memberships mb WHERE mb.family_id = v_family_id;

    -- Aile havuzundan dusulecek kullanim — SADECE aile paketine (family_id = bu aile) bagli rezervasyonlar
    SELECT COALESCE(COUNT(*), 0) INTO v_family_used
    FROM reservations r
    JOIN memberships ms ON ms.id = r.membership_id
    WHERE ms.family_id = v_family_id AND r.status IN ('completed', 'no_show');
    SELECT COALESCE(COUNT(*), 0) INTO v_family_reserved
    FROM reservations r
    JOIN memberships ms ON ms.id = r.membership_id
    WHERE ms.family_id = v_family_id AND r.status IN ('pending', 'approved');

    RETURN QUERY SELECT
      v_own_total + v_family_total,
      v_own_used_total,
      (v_own_total - v_own_used_personal - v_own_reserved_personal) + (v_family_total - v_family_used - v_family_reserved),
      v_own_reserved_total;
  ELSE
    RETURN QUERY SELECT
      v_own_total,
      v_own_used_total,
      v_own_total - v_own_used_personal - v_own_reserved_personal,
      v_own_reserved_total;
  END IF;
END;
$$;
