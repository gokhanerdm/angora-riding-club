CREATE OR REPLACE FUNCTION public.get_family_reservations(
  p_member_id uuid,
  p_status    text[]
)
RETURNS TABLE(
  id             uuid,
  scheduled_date date,
  start_time     time,
  end_time       time,
  status         text,
  member_id      uuid,
  member_name    text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_family_id uuid;
BEGIN
  SELECT fm.family_id INTO v_family_id
  FROM family_members fm
  WHERE fm.member_id = p_member_id
  LIMIT 1;

  IF v_family_id IS NULL THEN
    -- Aile üyesi değil — sadece kendi rezervasyonlarını döndür
    RETURN QUERY
      SELECT r.id, r.scheduled_date, r.start_time, r.end_time, r.status::text,
             r.member_id, (m.name || ' ' || m.surname)::text
      FROM reservations r
      JOIN members m ON m.id = r.member_id
      WHERE r.member_id = p_member_id
        AND r.status = ANY(p_status)
      ORDER BY r.scheduled_date DESC;
  ELSE
    -- Ailenin tüm üyelerinin rezervasyonlarını döndür
    RETURN QUERY
      SELECT r.id, r.scheduled_date, r.start_time, r.end_time, r.status::text,
             r.member_id, (m.name || ' ' || m.surname)::text
      FROM reservations r
      JOIN members m ON m.id = r.member_id
      JOIN memberships ms ON ms.id = r.membership_id
      WHERE ms.family_id = v_family_id
        AND r.status = ANY(p_status)
      ORDER BY r.scheduled_date DESC;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_family_reservations(uuid, text[]) TO authenticated;
