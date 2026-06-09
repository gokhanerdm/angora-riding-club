SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'reservations';

SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'mark_attendance';
