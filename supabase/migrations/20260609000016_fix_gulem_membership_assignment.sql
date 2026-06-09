-- Feb19 ve Feb26: aile paketinden kişisel pakete (4bea6b86) taşı
UPDATE reservations SET membership_id = '4bea6b86-88fe-43b3-9c80-382961d10036'
WHERE member_id = 'a1b18a2e-7bc5-4972-bf6e-a96bfad17afd'
  AND scheduled_date IN ('2026-02-19', '2026-02-26')
  AND status = 'completed';

-- May26: kişisel paketten (4bea6b86) aile paketine taşı
UPDATE reservations SET membership_id = 'f2f32450-1b9a-49df-96bf-ee409d22932f'
WHERE member_id = 'a1b18a2e-7bc5-4972-bf6e-a96bfad17afd'
  AND scheduled_date = '2026-05-26'
  AND status = 'completed';

-- 4bea6b86: used_lessons = 4 (zaten 4, değişmez)
-- f2f32450: used_lessons güncelle — Gülem 6 + Gizem 5 = 11
UPDATE memberships SET used_lessons = 11 WHERE id = 'f2f32450-1b9a-49df-96bf-ee409d22932f';
