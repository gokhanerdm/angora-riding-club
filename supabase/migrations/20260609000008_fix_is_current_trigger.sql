-- is_current trigger'ı yeniden yazılıyor.
-- Kural: üyenin en eski, kapasitesi dolmamış ve süresi geçmemiş paketi is_current=true.
-- Diğer tüm paketler is_current=false.
-- Bu kural INSERT ve UPDATE'te her iki durumda da uygulanır.

CREATE OR REPLACE FUNCTION public.sync_membership_is_current()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_active_id UUID;
BEGIN
  -- Recursive çağrıları önle (UPDATE içinde UPDATE tetiklenebilir)
  IF pg_trigger_depth() > 1 THEN RETURN NULL; END IF;

  -- Üyenin aktif olması gereken paketi bul:
  -- start_date'e göre en eski, kullanılmamış kapasitesi olan, süresi dolmamış paket
  SELECT id INTO v_active_id
  FROM memberships
  WHERE member_id = NEW.member_id
    AND used_lessons < total_lessons
    AND end_date >= CURRENT_DATE
  ORDER BY start_date
  LIMIT 1;

  -- Tüm paketleri tek seferde güncelle (değişiklik gereken satırlar)
  UPDATE memberships
  SET is_current = (id = v_active_id)
  WHERE member_id = NEW.member_id
    AND is_current IS DISTINCT FROM (id = v_active_id);

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_membership_is_current ON public.memberships;
CREATE TRIGGER trg_sync_membership_is_current
  AFTER INSERT OR UPDATE ON public.memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_membership_is_current();

-- ============================================================
-- Mevcut tüm üyelerin is_current değerlerini düzelt (tek seferlik)
-- ============================================================
UPDATE memberships ms
SET is_current = (
  ms.id = (
    SELECT id FROM memberships
    WHERE member_id = ms.member_id
      AND used_lessons < total_lessons
      AND end_date >= CURRENT_DATE
    ORDER BY start_date
    LIMIT 1
  )
);
