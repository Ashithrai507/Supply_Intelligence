-- Allow read access for authenticated & anon clients to read hospitals, medicines, sources, batches, and orders
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow read hospitals' AND tablename = 'hospitals') THEN
    CREATE POLICY "Allow read hospitals" ON public.hospitals FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow read medicines' AND tablename = 'medicines') THEN
    CREATE POLICY "Allow read medicines" ON public.medicines FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow read supply_sources' AND tablename = 'supply_sources') THEN
    CREATE POLICY "Allow read supply_sources" ON public.supply_sources FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow read supplier_medicines' AND tablename = 'supplier_medicines') THEN
    CREATE POLICY "Allow read supplier_medicines" ON public.supplier_medicines FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow read inventory_batches' AND tablename = 'inventory_batches') THEN
    CREATE POLICY "Allow read inventory_batches" ON public.inventory_batches FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow read purchase_orders' AND tablename = 'purchase_orders') THEN
    CREATE POLICY "Allow read purchase_orders" ON public.purchase_orders FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow read demand_history' AND tablename = 'demand_history') THEN
    CREATE POLICY "Allow read demand_history" ON public.demand_history FOR SELECT USING (true);
  END IF;
END $$;
