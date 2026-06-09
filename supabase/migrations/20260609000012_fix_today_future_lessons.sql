-- Bugün zamanı henüz gelmemiş ama 'completed' yazılmış dersler 'approved'a çekildi.
-- Bu dersler eski RPC ile oluşturuldu (used_lessons artırılmamıştı), sadece status düzeltiliyor.

UPDATE reservations
SET status = 'approved'
WHERE id IN (
  'fff2af22-e9b4-4cb3-8f74-68d3c0b9cbec',  -- Zelin Aksa 13:30
  'c7709df6-d641-4ce5-b17b-9c81f308323d',  -- Sümeyye Talay 16:00
  'd7a9f82d-83fd-4acf-9892-ec289a4518cf',  -- Melisa Bal 19:00
  '1e3953ef-39fa-488f-bc11-c985e0fc550b',  -- Ezgi Altunok 19:30
  '70e1a95f-2ff4-40aa-b79b-c3e19559f9b8'   -- Talha Altunok 19:30
);
