-- Geçmiş ders kayıtlarında paket dağılımı düzeltmesi (2. tur)
-- Kural: en eski paket önce dolar, toplam kullanılan ders sırayla dağıtılır.
--
-- Melisa Bal: 20+20 dolu, 60'lık paket 30→25
UPDATE memberships SET used_lessons = 25 WHERE id = '6b8877b3-477a-4d08-b300-5a05c5cbb53c';

-- Betül Akça: toplam 12 ders → paket1(12) dolar, paket2 = 0
UPDATE memberships SET used_lessons = 12 WHERE id = 'cd3eac73-ae5e-4805-9a21-4ef0f2b3315d';
UPDATE memberships SET used_lessons = 0  WHERE id = 'dd2c802e-e59f-43f6-830f-50ee078ab05f';

-- Gülem Ertürk: toplam 17 ders → paket1(4)+paket2(4)+paket3=9
UPDATE memberships SET used_lessons = 4 WHERE id = '4bea6b86-88fe-43b3-9c80-382961d10036';
UPDATE memberships SET used_lessons = 9 WHERE id = 'f2f32450-1b9a-49df-96bf-ee409d22932f';

-- Feyzanur Şimşek: toplam 53 ders → paket1(4)+paket2(12)+paket3(16)+paket4=21
UPDATE memberships SET used_lessons = 16 WHERE id = 'ba6e4027-267f-48db-b608-f249ffc64890';
UPDATE memberships SET used_lessons = 21 WHERE id = '948bbcc8-3d1c-4d31-a2c2-1ff6abc3b53b';

-- Şevval Çetintaş: gerçekten 3 ders kullanmış (overflow değil), 12'lik paket tam bitmiş
-- değişiklik yok — orijinal değerler doğru (paket1=3, paket2=12)
