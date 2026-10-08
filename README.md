# AI-Powered Hospital Inventory Intelligence

> **Predict before it happens.** An intelligence layer on top of hospital operational data that forecasts medicine demand, calculates deterministic stock-out and expiry risks, and recommends procurement actions before shortages occur.

---

## 1. What MedPredict Is

MedPredict is an AI-powered hospital inventory intelligence decision-support platform designed for hospitals. Rather than replacing existing hospital information systems (HIS/ERP/pharmacy software), MedPredict functions as an **intelligence layer**:
- Ingests daily consumption, batch-level inventory, supplier lead times, and incoming purchase orders.
- Applies **LightGBM time-series forecasting** to predict future medicine demand.
- Runs **deterministic inventory simulations** to compute exact days-of-supply (DOS), stock-out dates, and expiry wastage.
- Generates transparent, actionable **procurement recommendations** and **what-if surge simulations**.

---

## 2. Problem Being Solved

Hospitals face two recurring crises:
1. **Unanticipated stock-outs** of critical medicines (antibiotics, insulin, analgesics) caused by demand surges or supplier lead times.
2. **Avoidable medication expiry** caused by ordering excess inventory with short shelf lives.

Traditional rules-of-thumb (like static reorder points) fail when patient loads fluctuate or outbreaks occur. MedPredict combines machine learning demand forecasting with multi-batch inventory simulation to answer:
> **"Will the hospital have enough medicine when it needs it, and if not, what should it do?"**

---

## 3. Architecture

```text
                  HOSPITAL
                     │
            Existing HIS / ERP
                     │
                     ▼
             MedPredict API (FastAPI)
                     │
                     ▼
           PostgreSQL / SQLite Database
                     │
            ┌────────┴────────┐
            │                 │
            ▼                 ▼
     Demand History       Inventory Batches
            │                 │
            ▼                 │
     LightGBM Model           │
            │                 │
            ▼                 │
      Future Demand ──────────┘
            │
            ▼
    Inventory Simulation (Daily Walk)
            │
     ┌──────┼──────┐
     ▼      ▼      ▼
  Shortage Expiry Overstock
     │      │
     └──────┼──────┘
            ▼
      Actionable Recommendations
      (Procurement & Transfers)
            │
            ▼
     Hospital Dashboard
```

---

## 4. Database Schema (7 Core MVP Tables)

The persistent schema consists strictly of 7 relational tables:

1. **`hospitals`**: Hospital profile (`id`, `name`, `city`, `bed_capacity`, `avg_daily_patients`).
2. **`medicines`**: Master medicine catalog (`id`, `name`, `category`, `unit`, `criticality_level`: LOW/MEDIUM/HIGH/CRITICAL).
3. **`supply_sources`**: Approved distributors, manufacturers, and pharmacies (`id`, `name`, `source_type`, `city`).
4. **`supplier_medicines`**: Supplier product catalog (`source_id`, `medicine_id`, `lead_time_days`, `unit_price`, `minimum_order_quantity`).
5. **`demand_history`**: Primary ML time-series dataset (`hospital_id`, `medicine_id`, `date`, `quantity_consumed`, `patient_load`, `emergency_cases`, `outbreak_signal`).
6. **`inventory_batches`**: Batch-level stock and expiry (`id`, `hospital_id`, `medicine_id`, `batch_number`, `quantity`, `reserved_quantity`, `received_date`, `expiry_date`).
7. **`purchase_orders`**: Confirmed and incoming hospital orders (`id`, `hospital_id`, `source_id`, `medicine_id`, `order_date`, `expected_delivery_date`, `ordered_quantity`, `received_quantity`, `status`).

---

## 5. Machine Learning Pipeline

### LightGBM's Exact Role
LightGBM has **one primary responsibility**: **PREDICT FUTURE MEDICINE DEMAND** (`quantity_consumed`). It does not predict stock-out or expiry directly; those are computed deterministically from inventory walks.

### Feature Engineering
Features are constructed strictly avoiding lookahead bias:
- **Lags:** `lag_1`, `lag_2`, `lag_3`, `lag_7`, `lag_14`, `lag_28`
- **Rolling statistics (shifted by 1 day):** `rolling_mean_7`, `rolling_mean_14`, `rolling_mean_28`, `rolling_std_7`, `rolling_std_14`, `rolling_std_28`
- **Calendar:** `day_of_week`, `day_of_month`, `month`, `week_of_year`, `is_weekend`
- **Operational:** `patient_load`, `emergency_cases`, `outbreak_signal`
- **Context:** `hospital_id`, `medicine_id` (treated as categorical features)

### Chronological Evaluation & Baseline Comparison
Splitting is strictly chronological (70% Train, 15% Validation, 15% Out-of-Time Test).

Real validation results on the test set:

| Model | MAE | RMSE | WAPE |
|---|---|---|---|
| **LightGBM** | **3.0267** | **5.4390** | **0.0670 (6.70%)** |
| **7-Day Moving Average Baseline** | 3.1672 | 5.3157 | 0.0701 (7.01%) |

*Metrics are computed directly from the test split and stored in `backend/ml/artifacts/metrics.json`.*

---

## 6. Business Logic & Decision Engines

### A. Days of Supply (DOS)
$$\text{DOS} = \frac{\text{Usable Inventory}}{\text{Expected Daily Demand}}$$
- Usable inventory excludes reserved quantities and expired batches.

### B. Deterministic Stock-Out Simulation
For each future day $t$:
$$\text{Projected Stock}(t+1) = \text{Projected Stock}(t) + \text{Incoming Supply}(t) - \text{Predicted Demand}(t)$$
Simulation stops when $\text{Projected Stock} \le \text{Safety Stock}$ (2 days buffer), yielding:
- `days_until_stockout`
- `projected_stockout_date`
- `risk_level`: CRITICAL ($\le 3$ days), HIGH ($\le 7$ days), MEDIUM ($\le 14$ days), LOW ($> 14$ days).

### C. Expiry Risk
$$\text{Potential Wastage} = \max\left(0, \text{Batch Quantity} - \text{Expected Consumption Before Expiry}\right)$$

### D. Procurement Recommendations
$$\text{Required Inventory} = (\text{Forecast Demand during Lead Time}) + \text{Safety Stock}$$
$$\text{Order Quantity} = \max(\text{Required Inventory} - \text{Usable Inventory} - \text{Incoming POs}, \text{MOQ})$$

---

## 7. How to Run

### Setup Environment
```bash
cd backend
uv sync
```

### 1. Load Synthetic Data
Seeds SQLite / PostgreSQL with the 7-table synthetic dataset (146,000 demand points):
```bash
python scripts/seed_data.py
```

### 2. Train the LightGBM Model
Trains the model, evaluates against baseline, and saves artifacts:
```bash
cd backend
uv run python -m ml.train
```

### 3. Run Backend API
```bash
cd backend
uv run uvicorn app.main:app --reload
```
API Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)

### 4. Run Test Suite
```bash
cd backend
uv run pytest
```

---

## 8. The 5-Minute Demo Flow

1. **Open Dashboard (`GET /api/v1/dashboard?hospital_id=H01`):**
   - View top operational KPIs: Total Medicines (50), Critical Stock-out Risks, Expiry Risks, Pending Orders.
   - Inspect Critical Alerts and Top Recommended Procurement Actions.
2. **Inspect Medicine Inventory (`GET /api/v1/inventory/H01/M001`):**
   - Check current stock, usable stock, average daily demand, days of supply, and batch expiry distribution.
3. **View LightGBM Demand Forecast (`POST /api/v1/forecast`):**
   - Inspect 7-day predicted demand points juxtaposed with historical demand.
   - Verify real LightGBM performance metrics (MAE: 3.03, WAPE: 6.7%) compared to the 7-day moving average baseline.
4. **Trigger Demand Surge Simulation (`POST /api/v1/simulation/run`):**
   - Select +40% demand surge scenario.
   - Observe immediate impacts:
     - Daily demand increases from 17.4 to 24.4 units/day.
     - Stock-out window accelerates from 3.5 days to 1.9 days.
     - Risk level elevates from HIGH to CRITICAL.
     - Procurement order recommendation updates in real time.

---

## 9. Known Limitations

- **Prototype Scope:** Designed as an operational decision-support tool, not a clinical prescription or dosage determination system.
- **Single Hospital Multi-Source Focus:** Optimized for individual hospital inventory intelligence, sourcing from approved commercial distributors and manufacturers rather than automated inter-hospital trade.
