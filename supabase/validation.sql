-- Table existence
SELECT table_name FROM information_schema.tables
WHERE table_schema='public'
AND table_name IN ('hospitals','medicines','supply_sources','supplier_medicines',
'demand_history','inventory_batches','purchase_orders')
ORDER BY table_name;

-- RLS status
SELECT relname, relrowsecurity
FROM pg_class
WHERE relnamespace='public'::regnamespace
AND relname IN ('hospitals','medicines','supply_sources','supplier_medicines',
'demand_history','inventory_batches','purchase_orders');

-- Seed counts
SELECT 'hospitals' table_name, count(*) FROM public.hospitals
UNION ALL SELECT 'medicines', count(*) FROM public.medicines
UNION ALL SELECT 'supply_sources', count(*) FROM public.supply_sources
UNION ALL SELECT 'supplier_medicines', count(*) FROM public.supplier_medicines
UNION ALL SELECT 'demand_history', count(*) FROM public.demand_history
UNION ALL SELECT 'inventory_batches', count(*) FROM public.inventory_batches
UNION ALL SELECT 'purchase_orders', count(*) FROM public.purchase_orders;

-- Inventory view
SELECT * FROM public.hospital_inventory_summary ORDER BY hospital_id, medicine_id;

-- Pending orders
SELECT * FROM public.hospital_pending_orders ORDER BY expected_delivery_date;
