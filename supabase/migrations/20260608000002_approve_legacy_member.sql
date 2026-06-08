-- "Eski uyeyim" diyen kisi gercek bir uye oldugu icin, admin bildirimden "Onayla" dedigi
-- an Uyeler listesine dusmeli (member_status = active). Gecmis paket/ders bilgisi
-- ayri bir adim olarak "Gecmis ders ekle" akisinda (legacy-lessons) girilmeye devam eder,
-- bu yuzden pending_legacy_setup bayragi BURADA degistirilmez.

CREATE OR REPLACE FUNCTION public.approve_legacy_member(
  p_member_id uuid,
  p_admin_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz.';
  END IF;

  UPDATE members
  SET member_status = 'active'
  WHERE id = p_member_id AND deleted_at IS NULL AND pending_legacy_setup = true;
END;
$function$;
