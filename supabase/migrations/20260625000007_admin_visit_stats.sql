-- Admin anasayfa "Gelen Üye" sayıları tek kaynaktan (SQL) gelsin.
-- Önceki yöntem: client tüm completed satırları çekip JS'te dedup ediyordu; bu hem
-- 1000 satır cap'ine hem de auto_complete_past_lessons ile yarışan bayat snapshot'a
-- takılıyordu (bugün 20 yerine 4 görünüyordu). Burada COUNT(DISTINCT) ile anlık sayılır.
-- Hafta = Pazartesi başlangıç (date_trunc 'week'), ay = ayın 1'i; UI ile aynı tanım.

CREATE OR REPLACE FUNCTION public.get_admin_visit_stats(p_date date)
RETURNS TABLE(today int, week int, month int, total int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF get_my_role() <> 'admin' THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;

  RETURN QUERY
  SELECT
    count(DISTINCT member_id) FILTER (
      WHERE scheduled_date = p_date)::int,
    count(DISTINCT member_id) FILTER (
      WHERE scheduled_date >= date_trunc('week', p_date::timestamp)::date
        AND scheduled_date <= p_date)::int,
    count(DISTINCT member_id) FILTER (
      WHERE scheduled_date >= date_trunc('month', p_date::timestamp)::date
        AND scheduled_date <= p_date)::int,
    count(DISTINCT member_id) FILTER (
      WHERE scheduled_date <= p_date)::int
  FROM reservations
  WHERE status = 'completed';
END;
$$;
