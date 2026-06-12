-- reservations.type check constraint 'trial' değerine de izin versin
ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS reservations_type_check;
ALTER TABLE public.reservations ADD CONSTRAINT reservations_type_check CHECK (type IN ('general', 'trial'));
