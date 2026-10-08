# Medical Supply Intelligence — Synthetic Dataset

Seed: 42. All data is synthetic.

Rows by table:
- hospitals: 8
- departments: 64
- users: 48
- inventory_locations: 64
- medicines: 100
- suppliers: 10
- supplier_medicines: 600
- inventory_batches: 2,475
- inventory_transactions: 293,732
- demand_history: 292,000
- purchase_orders: 160
- purchase_order_items: 746
- demand_forecasts: 16,800
- inventory_risk: 600
- procurement_recommendations: 260
- expiry_recommendations: 274
- internal_transfers: 120
- mutual_aid_partners: 15
- emergency_availability: 75
- integration_events: 25,000

Total rows: 633,151

Important synthetic patterns:
- 365 days of daily medicine consumption.
- Weekly and annual seasonality.
- Gradual trend.
- A 28-day respiratory/antibiotic demand spike for anomaly/outbreak testing.
- Short-expiry and expired inventory batches.
- Variable supplier lead times.
- Purchase orders including partial receipts.
- Forecasts with lower/upper bounds and confidence.
- Stock-out and expiry risk scores.
- Procurement recommendations.
- Internal transfer opportunities.
- Optional reciprocal hospital availability.
- Integration events with external_event_id for idempotent API ingestion.

Suggested experiments:
1. Forecast next 7/14/30 days from demand_history.
2. Compare against a moving-average baseline.
3. Detect the synthetic outbreak spike.
4. Predict stock-out date from stock + forecast + lead time.
5. Rank medicines by risk.
6. Evaluate expiry-risk detection.
7. Generate procurement quantities.
