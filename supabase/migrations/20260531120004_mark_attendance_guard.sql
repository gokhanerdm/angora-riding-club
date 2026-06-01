-- mark_attendance: duplicate çağrı koruması ekle
-- Aynı rezervasyon için iki kez çağrılırsa sadece reservation status güncellenir,
-- ikinci bir attendance kaydı eklenmez.
CREATE OR REPLACE FUNCTION public.mark_attendance(
  p_reservation_id UUID,
  p_status         TEXT,
  p_marked_by      UUID
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

  IF v_res.status NOT IN ('approved', 'pending') THEN
    -- Zaten işlenmiş, sessizce çık
    RETURN;
  END IF;

  -- Duplicate attendance guard
  IF NOT EXISTS (SELECT 1 FROM attendance WHERE reservation_id = p_reservation_id) THEN
    INSERT INTO attendance (reservation_id, status, marked_by)
    VALUES (p_reservation_id, p_status, p_marked_by);
  END IF;

  UPDATE reservations SET status = p_status WHERE id = p_reservation_id;

  -- Membership sayaçları: rezerve → kullanıldı
  IF v_res.membership_id IS NOT NULL THEN
    UPDATE memberships
    SET reserved_lessons = GREATEST(0, reserved_lessons - 1),
        used_lessons      = used_lessons + 1
    WHERE id = v_res.membership_id;
  END IF;
END;
$$;
