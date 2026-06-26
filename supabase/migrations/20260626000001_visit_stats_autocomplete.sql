-- get_admin_visit_stats: freshness'i RPC garanti etsin.
-- Önceki sürüm UI'da auto_complete_past_lessons'ı ayrı await ediyordu; yarışa açıktı.
-- Artık RPC başında auto_complete çağrılır (aynı transaction, sayımlar güncel veriden gelir).
-- Hafta = Pazartesi başlangıç; p_date UI tarafında Istanbul saatine göre hesaplanır.

CREATE OR REPLACE FUNCTION public.get_admin_visit_stats(p_date date)
RETURNS TABLE(today int, week int, month int, total int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- IS DISTINCT FROM: rol/profil NULL ise de yakalar (NULL <> 'admin' = NULL, guard'ı atlardı)
  IF get_my_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;

  -- Geçmiş approved/pending dersleri tamamla ki "gelen üye" sayımı güncel olsun
  PERFORM auto_complete_past_lessons();

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
