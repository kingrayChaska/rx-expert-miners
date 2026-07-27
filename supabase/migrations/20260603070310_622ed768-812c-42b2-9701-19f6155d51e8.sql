
CREATE TABLE IF NOT EXISTS public.passing_by (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE DEFAULT CURRENT_DATE,
  serial_number TEXT,
  model TEXT,
  name TEXT,
  location TEXT,
  note TEXT,
  comment TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.passing_by TO authenticated;
GRANT ALL ON public.passing_by TO service_role;

ALTER TABLE public.passing_by ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approved view passing_by"
ON public.passing_by
FOR SELECT
TO authenticated
USING (is_approved(auth.uid()));

CREATE POLICY "approved insert passing_by"
ON public.passing_by
FOR INSERT
TO authenticated
WITH CHECK (is_approved(auth.uid()));

CREATE POLICY "approved update passing_by"
ON public.passing_by
FOR UPDATE
TO authenticated
USING (is_approved(auth.uid()));

CREATE POLICY "owners admins delete passing_by"
ON public.passing_by
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_passing_by_updated_at
BEFORE UPDATE ON public.passing_by
FOR EACH ROW
EXECUTE FUNCTION public.update_master_data_updated_at();

CREATE INDEX IF NOT EXISTS idx_passing_by_serial_number ON public.passing_by (serial_number);
CREATE INDEX IF NOT EXISTS idx_master_data_serial_number ON public.master_data (serial_number);
CREATE INDEX IF NOT EXISTS idx_master_data_dispatch_date ON public.master_data (dispatch_date);
CREATE INDEX IF NOT EXISTS idx_master_data_receiving_date ON public.master_data (receiving_date);
