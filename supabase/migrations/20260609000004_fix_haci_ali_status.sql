-- Hacı Ali Çiçek: member_status hatalı 'pending_club_approval' → 'active'
UPDATE members SET member_status = 'active' WHERE id = '8ff5f105-9558-4463-88c9-3a637efb3e80';
