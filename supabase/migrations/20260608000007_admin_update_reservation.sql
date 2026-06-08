-- Admin'in rezervasyon durumunu/tarihini doğrudan tablo update ile değiştirmesi yerine
-- (RPC dışından mutasyon yasağı ve geçersiz durum geçişlerinin önlenmesi için) tek RPC.
-- cancel_reservation / mark_attendance zaten cancelled / completed / no_show'u kapsıyor;
-- bu RPC sadece pending -> approved geçişini ve admin'in tarih düzeltmesini kapsar.
CREATE OR REPLACE FUNCTION public.admin_update_reservation(
  p_admin_id uuid,
  p_reservation_id uuid,
  p_scheduled_date date DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_res reservations%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz.';
  END IF;

  SELECT * INTO v_res FROM reservations WHERE id = p_reservation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rezervasyon bulunamadı.';
  END IF;

  IF p_status IS NOT NULL AND p_status <> v_res.status THEN
    -- Yalnızca pending -> approved geçişine izin ver; iptal/tamamlandı/gelmedi
    -- ayrı RPC'ler (cancel_reservation, mark_attendance) üzerinden yapılmalı.
    IF NOT (v_res.status = 'pending' AND p_status = 'approved') THEN
      RAISE EXCEPTION 'Geçersiz durum geçişi: % -> %. Bu işlem için cancel_reservation veya mark_attendance kullanın.', v_res.status, p_status;
    END IF;
    UPDATE reservations SET status = p_status, updated_at = now() WHERE id = p_reservation_id;
    v_res.status := p_status;
  END IF;

  IF p_scheduled_date IS NOT NULL AND p_scheduled_date <> v_res.scheduled_date THEN
    UPDATE reservations SET scheduled_date = p_scheduled_date, updated_at = now() WHERE id = p_reservation_id;
  END IF;
END;
$function$;
