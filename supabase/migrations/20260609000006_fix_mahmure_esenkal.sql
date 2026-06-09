-- Mahmure Esenkal: paket3'teki dersler paket2'ye taşınır
-- Paket2 (2025-08-30, 32 ders): used 13 → 26
-- Paket3 (2026-03-15, 30 ders): used 13 → 0
--
-- Paket3'e bağlı rezervasyonlar paket2'ye taşınıyor (sıralı dolum kuralı):
-- Paket2 dolmadan yeni paket alınmış, derslerin paket2'de görünmesi gerekiyor.

UPDATE reservations
SET membership_id = '2b1e6295-0c8e-43f4-b60a-ea011c5b7402'  -- paket2
WHERE membership_id = '41826df1-d63b-4f08-b73f-7a58c6a9150e'; -- paket3

UPDATE memberships SET used_lessons = 26 WHERE id = '2b1e6295-0c8e-43f4-b60a-ea011c5b7402';
UPDATE memberships SET used_lessons = 0  WHERE id = '41826df1-d63b-4f08-b73f-7a58c6a9150e';
