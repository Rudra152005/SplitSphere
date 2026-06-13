
-- ============ PROFILES ============
CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ GROUPS ============
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_currency TEXT NOT NULL DEFAULT 'INR',
  description TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own groups" ON public.groups FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_groups_updated BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- helper: is the current user the owner of this group?
CREATE OR REPLACE FUNCTION public.is_group_owner(_group_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.groups WHERE id = _group_id AND owner_id = auth.uid())
$$;

-- ============ GROUP MEMBERS ============
CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  join_date DATE,
  leave_date DATE,
  is_guest BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, normalized_name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members via group owner" ON public.group_members FOR ALL
  USING (public.is_group_owner(group_id)) WITH CHECK (public.is_group_owner(group_id));
CREATE TRIGGER trg_members_updated BEFORE UPDATE ON public.group_members FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ EXCHANGE RATES ============
CREATE TABLE public.exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate NUMERIC(18,6) NOT NULL,
  effective_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_currency, to_currency, effective_date)
);
GRANT SELECT ON public.exchange_rates TO authenticated;
GRANT ALL ON public.exchange_rates TO service_role;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read rates" ON public.exchange_rates FOR SELECT TO authenticated USING (true);

-- Seed FX rates (USD -> INR) used by the importer
INSERT INTO public.exchange_rates (from_currency, to_currency, rate, effective_date) VALUES
  ('USD','INR',83.00,'2026-01-01'),
  ('INR','INR',1,'2026-01-01'),
  ('USD','USD',1,'2026-01-01');

-- ============ IMPORT BATCHES ============
CREATE TABLE public.import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  total_rows INT NOT NULL DEFAULT 0,
  imported_rows INT NOT NULL DEFAULT 0,
  skipped_rows INT NOT NULL DEFAULT 0,
  anomaly_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | validated | committed | rolled_back
  summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  committed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own batches" ON public.import_batches FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- ============ IMPORT ROWS ============
CREATE TABLE public.import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  row_number INT NOT NULL,
  raw JSONB NOT NULL,
  parsed JSONB,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | imported | skipped | converted_to_settlement
  expense_id UUID,
  settlement_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_rows TO authenticated;
GRANT ALL ON public.import_rows TO service_role;
ALTER TABLE public.import_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rows via batch" ON public.import_rows FOR ALL
  USING (EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = batch_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = batch_id AND b.owner_id = auth.uid()));

-- ============ ANOMALY REPORTS ============
CREATE TABLE public.anomaly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  row_number INT,
  anomaly_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning', -- info | warning | error
  message TEXT NOT NULL,
  recommendation TEXT,
  action_taken TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.anomaly_reports TO authenticated;
GRANT ALL ON public.anomaly_reports TO service_role;
ALTER TABLE public.anomaly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anomalies via batch" ON public.anomaly_reports FOR ALL
  USING (EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = batch_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = batch_id AND b.owner_id = auth.uid()));

-- ============ EXPENSES ============
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  paid_by_member_id UUID REFERENCES public.group_members(id) ON DELETE SET NULL,
  amount_original NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL,
  amount_base NUMERIC(14,2) NOT NULL,
  fx_rate NUMERIC(18,6) NOT NULL DEFAULT 1,
  split_type TEXT NOT NULL, -- equal | unequal | percentage | share
  category TEXT,
  notes TEXT,
  import_batch_id UUID REFERENCES public.import_batches(id) ON DELETE SET NULL,
  source_row_number INT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses via group owner" ON public.expenses FOR ALL
  USING (public.is_group_owner(group_id)) WITH CHECK (public.is_group_owner(group_id));
CREATE TRIGGER trg_expenses_updated BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_expenses_group_date ON public.expenses(group_id, date);

-- ============ EXPENSE SPLITS ============
CREATE TABLE public.expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.group_members(id) ON DELETE CASCADE,
  share_amount_base NUMERIC(14,2) NOT NULL,
  share_input NUMERIC(14,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(expense_id, member_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_splits TO authenticated;
GRANT ALL ON public.expense_splits TO service_role;
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "splits via expense group" ON public.expense_splits FOR ALL
  USING (EXISTS (SELECT 1 FROM public.expenses e JOIN public.groups g ON g.id = e.group_id WHERE e.id = expense_id AND g.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.expenses e JOIN public.groups g ON g.id = e.group_id WHERE e.id = expense_id AND g.owner_id = auth.uid()));

-- ============ SETTLEMENTS ============
CREATE TABLE public.settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  from_member_id UUID NOT NULL REFERENCES public.group_members(id) ON DELETE CASCADE,
  to_member_id UUID NOT NULL REFERENCES public.group_members(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL,
  amount_base NUMERIC(14,2) NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  import_batch_id UUID REFERENCES public.import_batches(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlements TO authenticated;
GRANT ALL ON public.settlements TO service_role;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settlements via group owner" ON public.settlements FOR ALL
  USING (public.is_group_owner(group_id)) WITH CHECK (public.is_group_owner(group_id));
CREATE TRIGGER trg_settlements_updated BEFORE UPDATE ON public.settlements FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ AUDIT LOG ============
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL, -- create | update | delete | import | settle | approve
  old_value JSONB,
  new_value JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit via group owner" ON public.audit_logs FOR SELECT
  USING (group_id IS NULL AND user_id = auth.uid() OR (group_id IS NOT NULL AND public.is_group_owner(group_id)));
CREATE POLICY "audit insert own" ON public.audit_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_audit_group_created ON public.audit_logs(group_id, created_at DESC);
