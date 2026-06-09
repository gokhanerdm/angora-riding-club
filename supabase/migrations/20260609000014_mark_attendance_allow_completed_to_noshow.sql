-- mark_attendance: completed → no_show geçişine izin ver
-- (Eğitmen aynı gün, admin her zaman "gelmedi" işaretleyebilir)
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
BEGIN
  IF p_status NOT IN ('completed', 'no_show') THEN
    RAISE EXCEPTION 'Geçersiz durum: %. Sadece completed veya no_show kabul edilir.', p_status;
  END IF;

  SELECT r.id, r.status, r.member_id, r.membership_id
  INTO v_res
  FROM reservations r
  WHERE r.id = p_reservation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rezervasyon bulunamadı.';
  END IF;

  -- approved/pending → completed/no_show: normal akış
  -- completed → no_show: eğitmen/admin düzeltmesi (used_lessons değişmez, zaten sayıldı)
  IF v_res.status NOT IN ('approved', 'pending', 'completed') THEN
    RETURN; -- zaten no_show veya cancelled, dokunma
  END IF;

  IF NOT EXISTS (SELECT 1 FROM attendance WHERE reservation_id = p_reservation_id) THEN
    INSERT INTO attendance (reservation_id, status, marked_by)
    VALUES (p_reservation_id, p_status, p_marked_by);
  ELSE
    UPDATE attendance SET status = p_status, marked_by = p_marked_by
    WHERE reservation_id = p_reservation_id;
  END IF;

  UPDATE reservations SET status = p_status WHERE id = p_reservation_id;

  -- used_lessons sadece approved/pending → completed/no_show geçişinde artar
  -- completed → no_show geçişinde used_lessons değişmez (ders zaten sayıldı)
  IF v_res.status IN ('approved', 'pending') AND v_res.membership_id IS NOT NULL THEN
    UPDATE memberships
    SET reserved_lessons = GREATEST(0, reserved_lessons - 1),
        used_lessons      = used_lessons + 1
    WHERE id = v_res.membership_id;
  END IF;
END;
$$;
