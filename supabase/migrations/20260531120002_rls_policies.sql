-- RLS politikaları: tüm kritik tablolarda satır düzeyinde güvenlik aktif edilir.
-- Roller: admin (profiles.role = 'admin'), trainer (trainers tablosunda kaydı var),
--         member (profiles.role = 'member')

-- =============================================
-- Yardımcı fonksiyonlar
-- =============================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE
AS $$ SELECT role FROM public.profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.get_my_member_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE
AS $$ SELECT id FROM public.members WHERE user_id = auth.uid() AND deleted_at IS NULL LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.get_my_trainer_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE
AS $$ SELECT id FROM public.trainers WHERE user_id = auth.uid() AND deleted_at IS NULL LIMIT 1 $$;

-- =============================================
-- profiles
-- =============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin"  ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (id = auth.uid() OR public.get_my_role() = 'admin');
CREATE POLICY "profiles_admin"  ON public.profiles FOR ALL   USING (public.get_my_role() = 'admin');

-- =============================================
-- members
-- =============================================
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members_own"    ON public.members;
DROP POLICY IF EXISTS "members_admin"  ON public.members;
DROP POLICY IF EXISTS "members_trainer" ON public.members;
CREATE POLICY "members_own"     ON public.members FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "members_trainer" ON public.members FOR SELECT USING (public.get_my_role() = 'trainer');
CREATE POLICY "members_admin"   ON public.members FOR ALL   USING (public.get_my_role() = 'admin');

-- =============================================
-- trainers
-- =============================================
ALTER TABLE public.trainers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trainers_read"  ON public.trainers;
DROP POLICY IF EXISTS "trainers_admin" ON public.trainers;
CREATE POLICY "trainers_read"  ON public.trainers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "trainers_admin" ON public.trainers FOR ALL   USING (public.get_my_role() = 'admin');

-- =============================================
-- memberships
-- =============================================
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "memberships_own"   ON public.memberships;
DROP POLICY IF EXISTS "memberships_admin" ON public.memberships;
CREATE POLICY "memberships_own"   ON public.memberships FOR SELECT USING (member_id = public.get_my_member_id() OR public.get_my_role() = 'trainer');
CREATE POLICY "memberships_admin" ON public.memberships FOR ALL   USING (public.get_my_role() = 'admin');

-- =============================================
-- reservations
-- =============================================
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reservations_own"     ON public.reservations;
DROP POLICY IF EXISTS "reservations_trainer" ON public.reservations;
DROP POLICY IF EXISTS "reservations_admin"   ON public.reservations;
CREATE POLICY "reservations_own"     ON public.reservations FOR SELECT USING (member_id = public.get_my_member_id());
CREATE POLICY "reservations_trainer" ON public.reservations FOR ALL   USING (trainer_id = public.get_my_trainer_id() OR public.get_my_role() = 'trainer');
CREATE POLICY "reservations_admin"   ON public.reservations FOR ALL   USING (public.get_my_role() = 'admin');

-- =============================================
-- membership_requests
-- =============================================
ALTER TABLE public.membership_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "requests_own"   ON public.membership_requests;
DROP POLICY IF EXISTS "requests_admin" ON public.membership_requests;
CREATE POLICY "requests_own"   ON public.membership_requests FOR SELECT USING (member_id = public.get_my_member_id());
CREATE POLICY "requests_admin" ON public.membership_requests FOR ALL   USING (public.get_my_role() = 'admin');

-- =============================================
-- payment_transactions
-- =============================================
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payments_admin" ON public.payment_transactions;
CREATE POLICY "payments_admin" ON public.payment_transactions FOR ALL USING (public.get_my_role() = 'admin');

-- =============================================
-- trainer_schedules
-- =============================================
ALTER TABLE public.trainer_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "schedules_read"    ON public.trainer_schedules;
DROP POLICY IF EXISTS "schedules_trainer" ON public.trainer_schedules;
DROP POLICY IF EXISTS "schedules_admin"   ON public.trainer_schedules;
CREATE POLICY "schedules_read"    ON public.trainer_schedules FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "schedules_trainer" ON public.trainer_schedules FOR ALL   USING (trainer_id = public.get_my_trainer_id());
CREATE POLICY "schedules_admin"   ON public.trainer_schedules FOR ALL   USING (public.get_my_role() = 'admin');

-- =============================================
-- attendance
-- =============================================
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "attendance_trainer" ON public.attendance;
DROP POLICY IF EXISTS "attendance_admin"   ON public.attendance;
CREATE POLICY "attendance_trainer" ON public.attendance FOR ALL   USING (public.get_my_role() IN ('trainer', 'admin'));
CREATE POLICY "attendance_admin"   ON public.attendance FOR SELECT USING (auth.uid() IS NOT NULL);

-- =============================================
-- member_allowed_trainers
-- =============================================
ALTER TABLE public.member_allowed_trainers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allowed_read"  ON public.member_allowed_trainers;
DROP POLICY IF EXISTS "allowed_admin" ON public.member_allowed_trainers;
CREATE POLICY "allowed_read"  ON public.member_allowed_trainers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "allowed_admin" ON public.member_allowed_trainers FOR ALL   USING (public.get_my_role() = 'admin');

-- =============================================
-- membership_packages
-- =============================================
ALTER TABLE public.membership_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "packages_read"  ON public.membership_packages;
DROP POLICY IF EXISTS "packages_admin" ON public.membership_packages;
CREATE POLICY "packages_read"  ON public.membership_packages FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "packages_admin" ON public.membership_packages FOR ALL   USING (public.get_my_role() = 'admin');
