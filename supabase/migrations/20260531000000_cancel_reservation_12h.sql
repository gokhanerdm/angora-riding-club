-- cancel_reservation: 12 saatlik iptal kuralını RPC içinde zorunlu kılar.
-- Kural sadece UI'da değil, veritabanı katmanında uygulanır.
CREATE OR REPLACE FUNCTION public.cancel_reservation(
  p_reservation_id UUID,
  p_user_id        UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res           RECORD;
  v_lesson_ts     TIMESTAMPTZ;
BEGIN
  -- Rezervasyonu bul ve sahipliği doğrula
  SELECT r.id, r.status, r.member_id, r.scheduled_date, r.start_time
  INTO v_res
  FROM reservations r
  JOIN members m ON m.id = r.member_id
  WHERE r.id = p_reservation_id
    AND m.user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rezervasyon bulunamadı veya yetkiniz yok.';
  END IF;

  IF v_res.status NOT IN ('pending', 'approved') THEN
    RAISE EXCEPTION 'Bu rezervasyon zaten % durumunda, iptal edilemez.', v_res.status;
  END IF;

  -- 12 saat kuralı: ders saatini Europe/Istanbul olarak yorumla
  v_lesson_ts := (v_res.scheduled_date + v_res.start_time)::TIMESTAMP AT TIME ZONE 'Europe/Istanbul';
  IF v_lesson_ts - NOW() < INTERVAL '12 hours' THEN
    RAISE EXCEPTION '12 saat kuralı: Ders başlamadan en az 12 saat önce iptal yapılmalıdır.';
  END IF;

  UPDATE reservations
  SET status = 'cancelled'
  WHERE id = p_reservation_id;

  -- Onaylanmış rezervasyonlarda reserved_lessons sayacını düşür
  IF v_res.status = 'approved' THEN
    UPDATE memberships
    SET reserved_lessons = GREATEST(0, reserved_lessons - 1)
    WHERE id = (
      SELECT id FROM memberships
      WHERE member_id = v_res.member_id
        AND is_current = true
      ORDER BY start_date DESC
      LIMIT 1
    );
  END IF;
END;
$$;
