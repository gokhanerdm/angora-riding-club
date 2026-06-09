-- Abdullah Keskin: paket dağılımı düzeltmesi
-- Toplam 38 ders → paket1(32) + paket2(6)
-- Paket1 (2025-08-16, 32 ders): used 29 → 32
UPDATE memberships SET used_lessons = 32 WHERE id = '5c2a85ed-8ca6-4293-8e82-bc2a9f5e40f4';
-- Paket2 (2025-11-25, 32 ders): used 9 → 6
UPDATE memberships SET used_lessons = 6  WHERE id = 'ff16e221-f0e8-4698-a90b-1490da0bef6f';
