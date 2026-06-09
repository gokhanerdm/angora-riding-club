-- Tek seferlik düzeltmede id = NULL → NULL döndürüyordu (false değil).
-- Tüm üyelerin is_current değerlerini doğru şekilde set et.
UPDATE memberships ms
SET is_current = COALESCE(
  ms.id = (
    SELECT id FROM memberships
    WHERE member_id = ms.member_id
      AND used_lessons < total_lessons
      AND end_date >= CURRENT_DATE
    ORDER BY start_date
    LIMIT 1
  ),
  false  -- hiçbir paket aktif koşulu sağlamıyorsa false
);

-- Trigger fonksiyonunu da güncelle: NULL koruması ekle
CREATE OR REPLACE FUNCTION public.sync_membership_is_current()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_active_id UUID;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NULL; END IF;

  SELECT id INTO v_active_id
  FROM memberships
  WHERE member_id = NEW.member_id
    AND used_lessons < total_lessons
    AND end_date >= CURRENT_DATE
  ORDER BY start_date
  LIMIT 1;

  UPDATE memberships
  SET is_current = COALESCE(id = v_active_id, false)
  WHERE member_id = NEW.member_id
    AND is_current IS DISTINCT FROM COALESCE(id = v_active_id, false);

  RETURN NULL;
END;
$$;
