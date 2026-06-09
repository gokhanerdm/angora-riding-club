-- Burcu Kocatürk: paket dağılımı düzeltmesi
-- Toplam 13 ders → paket1(12) dolar, paket2(20)'ye 1 geçer
-- Paket1 (2026-03-25, 12 ders): used 1 → 12
UPDATE memberships SET used_lessons = 12 WHERE id = 'c36bd8e7-afd9-45ca-96bf-578c1984a206';
-- Paket2 (2026-05-15, 20 ders): used 12 → 1
UPDATE memberships SET used_lessons = 1  WHERE id = 'fed4ba6c-d562-4a22-a723-c21b442afb0b';
