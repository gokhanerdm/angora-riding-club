-- family_members tablosunda trainer için SELECT policy eksikti.
-- Trainer kendi öğrencisinin aile üyeliğini (family pool) görebilmeli.
CREATE POLICY trainer_view_family_members
  ON family_members
  FOR SELECT
  USING (get_my_role() = 'trainer');
