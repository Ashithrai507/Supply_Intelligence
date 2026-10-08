# MedPredict Simple Synthetic Dataset

Synthetic hackathon dataset for the hospital-centric MVP.

## Core tables
- hospitals.csv
- medicines.csv
- supply_sources.csv
- supplier_medicines.csv
- demand_history.csv
- inventory_batches.csv
- purchase_orders.csv

## ML target
`demand_history.quantity_consumed` is the LightGBM target.

## Deliberate patterns
- weekly seasonality
- gradual trend
- annual seasonality
- hospital-specific scale
- medicine-specific demand
- patient and emergency activity
- respiratory/antibiotic demand surge around days 286-319
- realistic inventory, expiry and supplier lead times

Suggested MVP: demand history -> LightGBM -> 7-day forecast -> inventory projection -> stock-out/expiry risk -> procurement recommendation.

Synthetic only; no patient-identifying information. Not for real clinical, financial, or operational decisions.
