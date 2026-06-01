-- =============================================
-- 1. Kırık approve_membership_request_with_payment stub'ını sil
--    (eski 3-param versiyonu, approved_by kolonu yok)
-- =============================================
DROP FUNCTION IF EXISTS public.approve_membership_request_with_payment(uuid, numeric, uuid);

-- =============================================
-- 2. Kullanılmayan, kırık get_admin_dashboard_stats sil
--    (is_refund kolonu yok, kodda çağrılmıyor)
-- =============================================
DROP FUNCTION IF EXISTS public.get_admin_dashboard_stats();

-- =============================================
-- 3. cancel_reservation: pending durumdaki iptalda da
--    reserved_lessons düşür + membership_id kullan
-- =============================================
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
  v_res RECORD;
  v_lesson_ts TIMESTAMPTZ;
BEGIN
  SELECT r.id, r.status, r.member_id, r.membership_id, r.scheduled_date, r.start_time
  INTO v_res
  FROM reservations r
  JOIN members m ON m.id = r.member_id
  WHERE r.id = p_reservation_id
    AND m.user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rezervasyon bulunamadı veya yetkiniz yok.';
  END IF;

  IF v_res.status NOT IN ('pending', 'approved') THEN
    RAISE EXCEPTION 'Bu rezervasyon % durumunda, iptal edilemez.', v_res.status;
  END IF;

  -- 12 saat kuralı
  v_lesson_ts := (v_res.scheduled_date + v_res.start_time)::TIMESTAMP AT TIME ZONE 'Europe/Istanbul';
  IF v_lesson_ts - NOW() < INTERVAL '12 hours' THEN
    RAISE EXCEPTION '12 saat kuralı: Ders başlamadan en az 12 saat önce iptal yapılmalıdır.';
  END IF;

  UPDATE reservations SET status = 'cancelled' WHERE id = p_reservation_id;

  -- Her iki durumda da (pending veya approved) reserved_lessons düşür
  IF v_res.membership_id IS NOT NULL THEN
    UPDATE memberships
    SET reserved_lessons = GREATEST(0, reserved_lessons - 1)
    WHERE id = v_res.membership_id;
  END IF;
END;
$$;

-- =============================================
-- 4. mark_attendance RPC: yoklama + counter atomik güncelleme
--    Eğitmen UI'dan çağrılır; membership sayaçlarını günceller
-- =============================================
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
    RAISE EXCEPTION 'Bu rezervasyon % durumunda, yoklama alınamaz.', v_res.status;
  END IF;

  -- Attendance kaydı
  INSERT INTO attendance (reservation_id, status, marked_by)
  VALUES (p_reservation_id, p_status, p_marked_by);

  -- Rezervasyon durumu
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
