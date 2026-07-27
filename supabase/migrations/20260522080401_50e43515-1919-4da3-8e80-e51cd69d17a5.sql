
CREATE TABLE public.master_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receiving_date DATE,
  customer_type TEXT,
  client_name TEXT,
  miner_model_and_type TEXT,
  serial_number TEXT,
  psu_serial_number TEXT,
  hash_board_serial_number TEXT,
  receiving_location TEXT,
  warranty_status TEXT,
  column_10 TEXT,
  work_order TEXT,
  client_approval TEXT,
  repair_status TEXT,
  aging_status TEXT,
  quotation_sent TEXT,
  final_status TEXT,
  payment TEXT,
  ready_for_dispatch TEXT,
  dispatch_status TEXT,
  dispatch_date DATE,
  dispatch_location TEXT,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.master_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approved view master_data" ON public.master_data
  FOR SELECT TO authenticated USING (is_approved(auth.uid()));
CREATE POLICY "approved insert master_data" ON public.master_data
  FOR INSERT TO authenticated WITH CHECK (is_approved(auth.uid()));
CREATE POLICY "approved update master_data" ON public.master_data
  FOR UPDATE TO authenticated USING (is_approved(auth.uid()));
CREATE POLICY "approved delete master_data" ON public.master_data
  FOR DELETE TO authenticated USING (is_approved(auth.uid()));

CREATE OR REPLACE FUNCTION public.update_master_data_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_master_data_updated_at
BEFORE UPDATE ON public.master_data
FOR EACH ROW EXECUTE FUNCTION public.update_master_data_updated_at();
