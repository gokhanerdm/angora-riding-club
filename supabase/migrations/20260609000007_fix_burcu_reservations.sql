-- Burcu Kocatürk: rezervasyonlar doğru pakete taşınıyor
-- Paket1 (12 ders, c36bd8e7, 2026-03-25): ilk 12 ders
-- Paket2 (20 ders, fed4ba6c, 2026-05-15): kalan 4 tamamlanmış + 2 pending

-- Paket2'deki ilk 12 dersi (tarih sırasına göre) paket1'e taşı
UPDATE reservations
SET membership_id = 'c36bd8e7-afd9-45ca-96bf-578c1984a206'
WHERE id IN (
  '245a5486-ffe5-449b-bf98-55a9d25c5f02',  -- 2026-03-25
  'c011221e-906b-4ad7-8160-86926e5bdaad',  -- 2026-03-27
  '726721d2-7773-4131-8a5f-e12e8480a7b6',  -- 2026-04-09
  '130cc8d3-49de-4dc3-99ae-9b9215a9ed8c',  -- 2026-04-21
  '36a4df78-6ef2-47a4-afd3-a53982a04420',  -- 2026-04-24
  '76831428-a8bc-4f34-9f62-c5404ceffe3a',  -- 2026-04-28
  '74b10e4d-90ec-4665-a308-84060adce599',  -- 2026-04-29
  'cd74ea27-02a3-4f1d-8a44-c2d81dc569f7',  -- 2026-05-06
  '910bfa35-465a-4bd5-898b-23ddcf8e9871',  -- 2026-05-08
  'f7750c82-70f6-40ad-84e2-af25c25c7d26',  -- 2026-05-13
  '7a0d7fb9-4a3b-4b1b-97c6-fdf63c084519',  -- 2026-05-15
  '76b873dd-3a39-4789-b23d-979cc46f96e7'   -- 2026-05-19 (12. ders)
);

-- Paket1'deki Jun 1 dersini paket2'ye taşı (paket1 dolunca paket2 başlıyor)
UPDATE reservations
SET membership_id = 'fed4ba6c-d562-4a22-a723-c21b442afb0b'
WHERE id = '9789e9b2-6a19-4b75-9afe-0d13b5f7ab2a';  -- 2026-06-01

-- Sayaçları güncelle
UPDATE memberships SET used_lessons = 12 WHERE id = 'c36bd8e7-afd9-45ca-96bf-578c1984a206'; -- paket1
UPDATE memberships SET used_lessons = 4  WHERE id = 'fed4ba6c-d562-4a22-a723-c21b442afb0b'; -- paket2
