-- Üyeyi eğitmene yükselten RPC
-- 1. trainers kaydı oluşturur
-- 2. profiles.role → 'trainer'
-- 3. members kaydını soft-delete yapar
CREATE OR REPLACE FUNCTION public.promote_member_to_trainer(
  p_member_id  UUID,
  p_admin_id   UUID,
  p_bonus_rate NUMERIC DEFAULT 0,
  p_shift      TEXT    DEFAULT 'fullday'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member  RECORD;
BEGIN
  -- Admin kontrolü
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz işlem.';
  END IF;

  -- Üye bilgilerini al
  SELECT m.id, m.user_id, m.name, m.surname
  INTO v_member
  FROM members m
  WHERE m.id = p_member_id AND m.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Üye bulunamadı.';
  END IF;

  -- Zaten eğitmen mi?
  IF EXISTS (SELECT 1 FROM trainers WHERE user_id = v_member.user_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Bu kullanıcı zaten eğitmen.';
  END IF;

  -- Shift kontrolü
  IF p_shift NOT IN ('morning', 'evening', 'fullday') THEN
    RAISE EXCEPTION 'Geçersiz vardiya. morning / evening / fullday olmalı.';
  END IF;

  -- trainers kaydı oluştur
  INSERT INTO trainers (user_id, name, surname, bonus_rate, shift)
  VALUES (v_member.user_id, v_member.name, v_member.surname, p_bonus_rate, p_shift);

  -- profiles.role → trainer
  UPDATE profiles SET role = 'trainer' WHERE id = v_member.user_id;

  -- members kaydını soft-delete et
  UPDATE members SET deleted_at = NOW() WHERE id = p_member_id;

  -- Bekleyen/onaylı rezervasyonları iptal et
  UPDATE reservations
  SET status = 'cancelled'
  WHERE member_id = p_member_id
    AND status IN ('pending', 'approved');
END;
$$;
