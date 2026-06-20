-- add_legacy_lessons: gecmis ders eklendiginde de paketin actual_start_date/end_date
-- alanlarini ilk ders tarihine gore baslatir (activate_membership_first_lesson).
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

    PERFORM activate_membership_first_lesson(v_current_ms_id, (v_lesson->>'scheduled_date')::DATE);
  END LOOP;
END;
$function$;
