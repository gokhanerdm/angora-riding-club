-- actual_start_date NULL kalan mevcut paketleri duzelt.
-- Bunlar create_direct_membership ile olusturulmus ama ilk ders bekleniyor
-- modunda kalmis legacy/pasif uye paketleridir.
-- start_date'i actual_start_date olarak set et, end_date'i paketin suresine gore hesapla.
UPDATE public.memberships m
SET
  actual_start_date = m.start_date,
  end_date          = m.start_date + (mp.duration_months || ' months')::INTERVAL
FROM public.membership_packages mp
WHERE m.package_id    = mp.id
  AND m.actual_start_date IS NULL
  AND m.end_date          IS NULL
  AND m.start_date        IS NOT NULL;
