-- Security fix: mark_attendance
-- Herhangi bir oturum açmış kullanıcı herhangi bir rezervasyonu completed/no_show yapabiliyordu.
-- Kural: admin her rezervasyonu işaretleyebilir.
--        trainer sadece kendi trainer_id'siyle eşleşen rezervasyonları işaretleyebilir.
--        Diğer roller reddedilir.
-- Fonksiyon gövdesi değişmiyor; sadece başa rol + sahiplik kontrolü ekleniyor.

CREATE OR REPLACE FUNCTION public.mark_attendance(
  p_reservation_id uuid,
  p_status         text,
  p_marked_by      uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res RECORD;
  v_role TEXT;
  v_trainer_id UUID;
BEGIN
  -- Rol kontrolü: admin veya trainer olmalı
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();

  IF v_role NOT IN ('admin', 'trainer') THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;

  -- Trainer kendi rezervasyonuyla sınırlı
  IF v_role = 'trainer' THEN
    SELECT id INTO v_trainer_id FROM trainers
    WHERE user_id = auth.uid() AND deleted_at IS NULL
    LIMIT 1;

    -- trainers satırı yoksa v_trainer_id NULL kalır; trainer_id = NULL hiçbir satırla
    -- eşleşmediği için aşağıdaki EXISTS sessizce false döner ve trainer kilitlenir.
    IF v_trainer_id IS NULL THEN
      RAISE EXCEPTION 'Eğitmen kaydı bulunamadı.';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM reservations
      WHERE id = p_reservation_id AND trainer_id = v_trainer_id
    ) THEN
      RAISE EXCEPTION 'Bu rezervasyon size ait değil.';
    END IF;
  END IF;

  -- Durum doğrulama
  IF p_status NOT IN ('completed', 'no_show') THEN
    RAISE EXCEPTION 'Geçersiz durum: %. Sadece completed veya no_show kabul edilir.', p_status;
  END IF;

  SELECT r.id, r.status, r.member_id, r.membership_id, r.scheduled_date
  INTO v_res
  FROM reservations r
  WHERE r.id = p_reservation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rezervasyon bulunamadı.';
  END IF;

  IF v_res.status NOT IN ('approved', 'pending', 'completed') THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM attendance WHERE reservation_id = p_reservation_id) THEN
    INSERT INTO attendance (reservation_id, status, marked_by)
    VALUES (p_reservation_id, p_status, p_marked_by);
  ELSE
    UPDATE attendance SET status = p_status, marked_by = p_marked_by
    WHERE reservation_id = p_reservation_id;
  END IF;

  UPDATE reservations SET status = p_status WHERE id = p_reservation_id;

  IF v_res.status IN ('approved', 'pending') AND v_res.membership_id IS NOT NULL THEN
    UPDATE memberships
    SET reserved_lessons = GREATEST(0, reserved_lessons - 1),
        used_lessons      = used_lessons + 1
    WHERE id = v_res.membership_id;

    PERFORM activate_membership_first_lesson(v_res.membership_id, v_res.scheduled_date);
  END IF;
END;
$$;
