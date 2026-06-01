-- Eğitmen kendi kaydını güncelleyebilsin (shift, specialization vb.)
-- RLS olmadan shift seçimi DB'ye kaydedilemiyor
CREATE POLICY "trainer_update_own" ON public.trainers
  FOR UPDATE USING (user_id = auth.uid());
