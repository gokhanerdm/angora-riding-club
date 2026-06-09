-- Şevval paketleri direkt false yap (ikisi de aktif değil)
UPDATE memberships SET is_current = false
WHERE id IN ('fe7ced56-24a1-4b14-b0e2-52b852f896d7', '6dd5cb06-d4a6-410d-b9d8-af5f1bb905ea')
RETURNING id, is_current;

-- Aynı zamanda trigger'ın düzgün çalışıp çalışmadığını test et:
-- Tüm is_current=null olan paketleri bul
SELECT COUNT(*) AS null_count FROM memberships WHERE is_current IS NULL;
