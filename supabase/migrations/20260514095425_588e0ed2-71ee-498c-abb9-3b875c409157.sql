

-- ============ ENUM ============
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'user');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ has_role / is_approved ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.has_role(_role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_approved(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE((SELECT is_approved FROM public.profiles WHERE user_id = _user_id), false) $$;

CREATE OR REPLACE FUNCTION public.is_approved()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE((SELECT is_approved FROM public.profiles WHERE user_id = auth.uid()), false) $$;

-- ============ handle_new_user TRIGGER ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_first BOOLEAN;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO is_first;
  INSERT INTO public.profiles (user_id, email, display_name, is_approved)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), is_first);
  IF is_first THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ Profiles RLS ============
CREATE POLICY "Authenticated can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners/admins update any profile" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners/admins delete profile" ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============ user_roles RLS ============
CREATE POLICY "Authenticated view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners manage roles ins" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners manage roles upd" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners manage roles del" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

-- ============ APP SETTINGS ============
CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_name TEXT DEFAULT 'DATA BRIDGE',
  app_image_url TEXT,
  default_language TEXT DEFAULT 'en',
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.app_settings (app_name) VALUES ('DATA BRIDGE');

CREATE POLICY "Auth view settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners/admins update settings" ON public.app_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners/admins insert settings" ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

-- ============ Generic table macro for approved-user CRUD ============
-- data_records
CREATE TABLE public.data_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  serial_number TEXT NOT NULL,
  model TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.data_records ENABLE ROW LEVEL SECURITY;

-- contacts
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- maintenance_names
CREATE TABLE public.maintenance_names (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.maintenance_names ENABLE ROW LEVEL SECURITY;

-- maintenance_records
CREATE TABLE public.maintenance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number TEXT NOT NULL,
  model TEXT,
  sent_to_maintenance BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;

-- approved_devices
CREATE TABLE public.approved_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number TEXT NOT NULL,
  model TEXT,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.approved_devices ENABLE ROW LEVEL SECURITY;

-- Approved-user CRUD policies on each table
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['data_records','contacts','maintenance_names','maintenance_records','approved_devices'])
  LOOP
    EXECUTE format('CREATE POLICY "approved view %I" ON public.%I FOR SELECT TO authenticated USING (public.is_approved(auth.uid()))', t, t);
    EXECUTE format('CREATE POLICY "approved insert %I" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_approved(auth.uid()))', t, t);
    EXECUTE format('CREATE POLICY "approved update %I" ON public.%I FOR UPDATE TO authenticated USING (public.is_approved(auth.uid()))', t, t);
    EXECUTE format('CREATE POLICY "approved delete %I" ON public.%I FOR DELETE TO authenticated USING (public.is_approved(auth.uid()))', t, t);
  END LOOP;
END $$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.approved_devices;

