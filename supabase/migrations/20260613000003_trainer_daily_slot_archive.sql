-- Bir günün slot listesi ilk görüntülendiğinde donduruluyor: o günden sonra
-- SHIFT_SLOTS, eğitmenin varsayılan mesaisi veya trainer_daily_shifts override'ı
-- değişse bile, o gün için gösterilen slot listesi bu tabloda saklanan haliyle
-- sabit kalır.

CREATE TABLE IF NOT EXISTS public.trainer_daily_slot_archive (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id     uuid NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  slots          jsonb NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trainer_id, scheduled_date)
);

ALTER TABLE public.trainer_daily_slot_archive ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "slot_archive_read"    ON public.trainer_daily_slot_archive;
DROP POLICY IF EXISTS "slot_archive_trainer" ON public.trainer_daily_slot_archive;
DROP POLICY IF EXISTS "slot_archive_admin"   ON public.trainer_daily_slot_archive;
CREATE POLICY "slot_archive_read"    ON public.trainer_daily_slot_archive FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "slot_archive_trainer" ON public.trainer_daily_slot_archive FOR ALL    USING (trainer_id = public.get_my_trainer_id());
CREATE POLICY "slot_archive_admin"   ON public.trainer_daily_slot_archive FOR ALL    USING (public.get_my_role() = 'admin');
