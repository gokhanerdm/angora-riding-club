-- Paket alim/onay tarihi ile gercek paket baslangic tarihini (uyenin ilk dersi)
-- birbirinden ayirmak icin iki yeni alan eklenir.
-- purchase_date: paket onaylandigi/satildigi tarih (raporlama icin "Yeni Kayit"/"Satilan Paket" tabanı)
-- actual_start_date: uyenin bu paketle ilk dersine geldigi tarih (paket gecerlilik suresinin gercek baslangici)
-- Mevcut kayitlarda purchase_date = start_date ile doldurulur, actual_start_date bos kalir
-- (geriye donuk doldurma ayri bir adimda ele alinacak).

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS purchase_date date,
  ADD COLUMN IF NOT EXISTS actual_start_date date;

UPDATE public.memberships
SET purchase_date = start_date
WHERE purchase_date IS NULL;
