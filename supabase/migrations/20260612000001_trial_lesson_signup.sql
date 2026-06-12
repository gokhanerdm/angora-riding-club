-- Deneme dersi akışı: kayıt sırasında "deneme dersi" talebi işaretleniyor.
-- Profil tamamlanmamış olsa da bu üyeler /member/profile-setup yerine
-- /member/trial-lesson'a yönlendirilecek.

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS trial_lesson_requested boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.complete_signup(
  p_user_id uuid,
  p_name text,
  p_surname text,
  p_email text,
  p_phone text,
  p_referral_code text DEFAULT NULL::text,
  p_trial boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_new_code   TEXT;
  v_referrer_id UUID;
  v_membership_id UUID;
BEGIN
  -- Aynı telefon numarasıyla aktif üye var mı?
  IF EXISTS (
    SELECT 1 FROM members
    WHERE phone = p_phone AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Bu telefon numarasıyla kayıtlı bir hesap zaten mevcut. Giriş yapmayı deneyin.';
  END IF;

  LOOP
    v_new_code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM members WHERE referral_code = v_new_code);
  END LOOP;

  INSERT INTO public.profiles (id, role) VALUES (p_user_id, 'member');

  INSERT INTO public.members (user_id, name, surname, email, phone, member_status, referral_code, trial_lesson_requested)
  VALUES (p_user_id, p_name, p_surname, p_email, p_phone, 'pending_club_approval', v_new_code, p_trial);

  IF p_referral_code IS NOT NULL AND p_referral_code != '' THEN
    SELECT id INTO v_referrer_id FROM members
    WHERE referral_code = upper(trim(p_referral_code)) AND deleted_at IS NULL
    LIMIT 1;

    IF v_referrer_id IS NOT NULL THEN
      SELECT id INTO v_membership_id FROM memberships
      WHERE member_id = v_referrer_id AND is_current = true
      ORDER BY start_date DESC LIMIT 1;

      IF v_membership_id IS NOT NULL THEN
        UPDATE memberships SET total_lessons = total_lessons + 1 WHERE id = v_membership_id;
      ELSE
        UPDATE members SET pending_referral_bonus_lessons = pending_referral_bonus_lessons + 1
        WHERE id = v_referrer_id;
      END IF;
    END IF;
  END IF;
END;
$function$;
