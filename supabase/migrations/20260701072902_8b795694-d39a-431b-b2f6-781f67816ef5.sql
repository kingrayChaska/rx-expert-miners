
ALTER PUBLICATION supabase_realtime ADD TABLE public.master_data; ALTER PUBLICATION supabase_realtime ADD TABLE public.passing_by; ALTER TABLE public.master_data REPLICA IDENTITY FULL; ALTER TABLE public.passing_by REPLICA IDENTITY FULL;
