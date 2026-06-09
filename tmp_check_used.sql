-- Bu 5 dersin rezervasyon oluşturma zamanı
SELECT id, created_at FROM reservations
WHERE id IN (
  'fff2af22-e9b4-4cb3-8f74-68d3c0b9cbec',
  'c7709df6-d641-4ce5-b17b-9c81f308323d',
  'd7a9f82d-83fd-4acf-9892-ec289a4518cf',
  '1e3953ef-39fa-488f-bc11-c985e0fc550b',
  '70e1a95f-2ff4-40aa-b79b-c3e19559f9b8'
);
