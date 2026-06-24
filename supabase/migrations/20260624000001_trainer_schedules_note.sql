-- trainer_schedules tablosuna not alanı ekle
ALTER TABLE public.trainer_schedules
  ADD COLUMN IF NOT EXISTS note TEXT;
