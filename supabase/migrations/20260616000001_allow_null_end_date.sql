-- end_date ilk ders alinana kadar NULL kalabilir (activate_membership_first_lesson tarafindan doldurulur).
ALTER TABLE public.memberships ALTER COLUMN end_date DROP NOT NULL;
