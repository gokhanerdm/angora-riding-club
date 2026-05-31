-- is_current bayrağını otomatik günceller.
-- used_lessons toplama ulaştığında veya end_date geçtiğinde is_current = false yapılır.
CREATE OR REPLACE FUNCTION public.sync_membership_is_current()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.used_lessons >= NEW.total_lessons OR NEW.end_date < CURRENT_DATE THEN
    NEW.is_current := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_membership_is_current ON public.memberships;
CREATE TRIGGER trg_sync_membership_is_current
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_membership_is_current();

-- Mevcut desync kayıtlarını tek seferlik düzelt
UPDATE public.memberships
SET is_current = false
WHERE is_current = true
  AND (used_lessons >= total_lessons OR end_date < CURRENT_DATE);
