-- ============================================================
-- 1. VERİ DÜZELTMESİ: used_lessons > total_lessons olan paketler
--    Taşan dersler kronolojik sıradaki sonraki pakete aktarıldı.
-- ============================================================

-- Mira Kösem: 32 ders paketi (Eki 2025) 47→32, sonraki 32 ders (Ara 2025) 0→15
UPDATE memberships SET used_lessons = 32 WHERE id = '8df0800f-82fa-4b00-8165-08933fee0447';
UPDATE memberships SET used_lessons = 15 WHERE id = '662610fa-c641-406e-8a78-f13fb7661889';

-- Mahmure Esenkal: 16 ders paketi (Tem 2025) 20→16, sonraki 32 ders (Ağu 2025) 9→13
UPDATE memberships SET used_lessons = 16 WHERE id = '15eb8736-107b-46a8-befe-c4dbc5eaf7cb';
UPDATE memberships SET used_lessons = 13 WHERE id = '2b1e6295-0c8e-43f4-b60a-ea011c5b7402';

-- Feyzanur Şimşek: 12 ders paketi (Kas 2025) 13→12, sonraki 16 ders (Oca 2026) 13→14
UPDATE memberships SET used_lessons = 12 WHERE id = '0848b81c-0c94-444b-ae2f-a6f421ed6ad4';
UPDATE memberships SET used_lessons = 14 WHERE id = 'ba6e4027-267f-48db-b608-f249ffc64890';

-- ============================================================
-- 2. RPC DÜZELTMESİ: add_legacy_lessons artık paket kapasitesi
--    dolunca otomatik olarak sonraki pakete taşıyor.
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_legacy_lessons(
  p_member_id     UUID,
  p_admin_id      UUID,
  p_membership_id UUID,
  p_lessons       JSONB  -- [{scheduled_date, trainer_id, status, start_time, end_time}]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_lesson        JSONB;
  v_current_ms_id UUID := p_membership_id;
  v_remaining     INT;
  v_next_id       UUID;
  v_current_start DATE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;

  -- Dersleri tarih sırasına göre işle
  FOR v_lesson IN
    SELECT value FROM jsonb_array_elements(p_lessons) ORDER BY (value->>'scheduled_date')::date
  LOOP
    -- Mevcut paketin kalan kapasitesini kontrol et
    SELECT total_lessons - used_lessons INTO v_remaining
    FROM memberships WHERE id = v_current_ms_id;

    -- Kapasite dolmuşsa kronolojik sıradaki sonraki pakete geç
    IF v_remaining <= 0 THEN
      SELECT start_date INTO v_current_start FROM memberships WHERE id = v_current_ms_id;

      SELECT id INTO v_next_id
      FROM memberships
      WHERE member_id = p_member_id
        AND start_date > v_current_start
      ORDER BY start_date
      LIMIT 1;

      IF v_next_id IS NULL THEN
        RAISE EXCEPTION 'Paket kapasitesi doldu ve sonraki paket bulunamadı. Önce yeni paket ekleyin.';
      END IF;

      v_current_ms_id := v_next_id;
    END IF;

    INSERT INTO reservations (
      member_id, membership_id, trainer_id,
      scheduled_date, start_time, end_time, status, type
    ) VALUES (
      p_member_id,
      v_current_ms_id,
      (v_lesson->>'trainer_id')::UUID,
      (v_lesson->>'scheduled_date')::DATE,
      COALESCE((v_lesson->>'start_time')::TIME, '10:00:00'::TIME),
      COALESCE((v_lesson->>'end_time')::TIME,   '10:30:00'::TIME),
      COALESCE(v_lesson->>'status', 'completed'),
      'general'
    );

    UPDATE memberships SET used_lessons = used_lessons + 1 WHERE id = v_current_ms_id;
  END LOOP;
END;
$function$;
