-- Current inventory
SELECT h.name hospital, m.name medicine, s.total_quantity,
       s.total_reserved_quantity, s.usable_quantity,
       s.batch_count, s.earliest_expiry
FROM public.hospital_inventory_summary s
JOIN public.hospitals h ON h.id=s.hospital_id
JOIN public.medicines m ON m.id=s.medicine_id
WHERE s.hospital_id=:hospital_id;

-- Batch expiry
SELECT ib.*, m.name medicine_name,
       ib.quantity-ib.reserved_quantity usable_quantity,
       ib.expiry_date-CURRENT_DATE days_until_expiry
FROM public.inventory_batches ib
JOIN public.medicines m ON m.id=ib.medicine_id
WHERE ib.hospital_id=:hospital_id
ORDER BY ib.expiry_date;

-- ML demand history
SELECT date, quantity_consumed, patient_load, emergency_cases, outbreak_signal
FROM public.demand_history
WHERE hospital_id=:hospital_id AND medicine_id=:medicine_id
ORDER BY date;

-- Average daily demand baseline
SELECT AVG(quantity_consumed)::numeric(12,2) avg_daily_demand
FROM public.demand_history
WHERE hospital_id=:hospital_id AND medicine_id=:medicine_id
AND date>=CURRENT_DATE-INTERVAL '30 days';

-- Incoming orders
SELECT po.*, m.name medicine_name, ss.name source_name
FROM public.purchase_orders po
JOIN public.medicines m ON m.id=po.medicine_id
JOIN public.supply_sources ss ON ss.id=po.source_id
WHERE po.hospital_id=:hospital_id
AND po.status IN ('PENDING','PARTIALLY_RECEIVED');

-- Supplier options for FastAPI procurement engine
SELECT sm.*, ss.name source_name, ss.source_type
FROM public.supplier_medicines sm
JOIN public.supply_sources ss ON ss.id=sm.source_id
WHERE sm.medicine_id=:medicine_id
ORDER BY sm.unit_price, sm.lead_time_days;
