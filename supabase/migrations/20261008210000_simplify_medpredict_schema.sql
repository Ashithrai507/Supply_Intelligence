CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT,
  bed_capacity INTEGER CHECK (bed_capacity IS NULL OR bed_capacity >= 0),
  avg_daily_patients INTEGER CHECK (avg_daily_patients IS NULL OR avg_daily_patients >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT NOT NULL,
  criticality_level TEXT NOT NULL DEFAULT 'MEDIUM'
    CHECK (criticality_level IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supply_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source_type TEXT NOT NULL
    CHECK (source_type IN ('MANUFACTURER','DISTRIBUTOR','PHARMACY')),
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supplier_medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.supply_sources(id) ON DELETE CASCADE,
  medicine_id UUID NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  lead_time_days INTEGER NOT NULL CHECK (lead_time_days >= 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  minimum_order_quantity INTEGER NOT NULL DEFAULT 1 CHECK (minimum_order_quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_id, medicine_id)
);

CREATE TABLE IF NOT EXISTS public.demand_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  medicine_id UUID NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  quantity_consumed INTEGER NOT NULL CHECK (quantity_consumed >= 0),
  patient_load INTEGER CHECK (patient_load IS NULL OR patient_load >= 0),
  emergency_cases INTEGER CHECK (emergency_cases IS NULL OR emergency_cases >= 0),
  outbreak_signal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(hospital_id, medicine_id, date)
);

CREATE TABLE IF NOT EXISTS public.inventory_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  medicine_id UUID NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  batch_number TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  received_date DATE,
  expiry_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (reserved_quantity <= quantity),
  CHECK (received_date IS NULL OR expiry_date >= received_date),
  UNIQUE(hospital_id, medicine_id, batch_number)
);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.supply_sources(id),
  medicine_id UUID NOT NULL REFERENCES public.medicines(id),
  order_date DATE NOT NULL,
  expected_delivery_date DATE,
  ordered_quantity INTEGER NOT NULL CHECK (ordered_quantity > 0),
  received_quantity INTEGER NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','PARTIALLY_RECEIVED','RECEIVED','CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (received_quantity <= ordered_quantity),
  CHECK (expected_delivery_date IS NULL OR expected_delivery_date >= order_date)
);

CREATE INDEX IF NOT EXISTS idx_hospitals_name ON public.hospitals(name);
CREATE INDEX IF NOT EXISTS idx_hospitals_city ON public.hospitals(city);
CREATE INDEX IF NOT EXISTS idx_medicines_name ON public.medicines(name);
CREATE INDEX IF NOT EXISTS idx_medicines_category ON public.medicines(category);
CREATE INDEX IF NOT EXISTS idx_supply_sources_name ON public.supply_sources(name);
CREATE INDEX IF NOT EXISTS idx_supply_sources_type ON public.supply_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_supplier_medicines_source ON public.supplier_medicines(source_id);
CREATE INDEX IF NOT EXISTS idx_supplier_medicines_medicine ON public.supplier_medicines(medicine_id);
CREATE INDEX IF NOT EXISTS idx_demand_history_hospital ON public.demand_history(hospital_id);
CREATE INDEX IF NOT EXISTS idx_demand_history_medicine ON public.demand_history(medicine_id);
CREATE INDEX IF NOT EXISTS idx_demand_history_date ON public.demand_history(date);
CREATE INDEX IF NOT EXISTS idx_demand_history_hospital_medicine_date
  ON public.demand_history(hospital_id, medicine_id, date);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_hospital ON public.inventory_batches(hospital_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_medicine ON public.inventory_batches(medicine_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_expiry ON public.inventory_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_hospital_medicine
  ON public.inventory_batches(hospital_id, medicine_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_hospital ON public.purchase_orders(hospital_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_source ON public.purchase_orders(source_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_medicine ON public.purchase_orders(medicine_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_delivery ON public.purchase_orders(expected_delivery_date);

CREATE OR REPLACE VIEW public.hospital_inventory_summary
WITH (security_invoker = true) AS
SELECT hospital_id, medicine_id,
       SUM(quantity) AS total_quantity,
       SUM(reserved_quantity) AS total_reserved_quantity,
       SUM(quantity - reserved_quantity) AS usable_quantity,
       COUNT(*) AS batch_count,
       MIN(expiry_date) AS earliest_expiry
FROM public.inventory_batches
GROUP BY hospital_id, medicine_id;

CREATE OR REPLACE VIEW public.hospital_pending_orders
WITH (security_invoker = true) AS
SELECT po.id, po.hospital_id, po.source_id, ss.name AS source_name,
       po.medicine_id, m.name AS medicine_name, po.order_date,
       po.expected_delivery_date, po.ordered_quantity,
       po.received_quantity, po.status
FROM public.purchase_orders po
JOIN public.supply_sources ss ON ss.id = po.source_id
JOIN public.medicines m ON m.id = po.medicine_id
WHERE po.status IN ('PENDING','PARTIALLY_RECEIVED');

ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.hospital_inventory_summary TO authenticated;
GRANT SELECT ON public.hospital_pending_orders TO authenticated;
