# Simple MVP Schema

## 1. hospitals
- hospital_id (PK)
- hospital_name
- city
- bed_capacity
- avg_daily_patients

## 2. medicines
- medicine_id (PK)
- medicine_name
- category
- unit
- criticality_level

## 3. supply_sources
Represents distributors, manufacturers, and pharmacies.
- source_id (PK)
- source_name
- source_type
- city

## 4. supplier_medicines
Which source can supply which medicine.
- source_id (FK)
- medicine_id (FK)
- lead_time_days
- unit_price
- minimum_order_quantity

## 5. demand_history
The main ML table.
- hospital_id (FK)
- medicine_id (FK)
- date
- quantity_consumed  <-- LightGBM target
- patient_load
- emergency_cases
- outbreak_signal

## 6. inventory_batches
Batch-level stock and expiry.
- inventory_id (PK)
- owner_type
- owner_id
- medicine_id (FK)
- batch_number
- quantity
- reserved_quantity
- received_date
- expiry_date

## 7. purchase_orders
Confirmed/incoming hospital supply.
- po_id (PK)
- hospital_id (FK)
- source_id (FK)
- medicine_id (FK)
- order_date
- expected_delivery_date
- ordered_quantity
- received_quantity
- status

## Deliberately excluded from the MVP database
- mutual-aid agreements
- partner-hospital tables
- routes/geospatial optimization
- LLM conversation tables
- separate risk/recommendation tables
- microservice-specific tables

Risk and recommendation results can be calculated by the backend from these core tables and returned through the API.
