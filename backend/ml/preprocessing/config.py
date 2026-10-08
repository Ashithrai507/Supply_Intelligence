from datetime import date
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_ROOT.parent
DATA_DIR = REPO_ROOT / "Data_Set"

DEMAND_PATH = DATA_DIR / "demand_history.csv"
MEDICINES_PATH = DATA_DIR / "medicines.csv"
HOSPITALS_PATH = DATA_DIR / "hospitals.csv"
BATCHES_PATH = DATA_DIR / "inventory_batches.csv"
PURCHASE_ORDERS_PATH = DATA_DIR / "purchase_orders.csv"
PURCHASE_ORDER_ITEMS_PATH = DATA_DIR / "purchase_order_items.csv"
SUPPLIER_MEDICINES_PATH = DATA_DIR / "supplier_medicines.csv"

ARTIFACTS_DIR = BACKEND_ROOT / "ml" / "artifacts"
MODELS_DIR = ARTIFACTS_DIR / "models"
OUTPUTS_DIR = ARTIFACTS_DIR / "outputs"
PLOTS_DIR = OUTPUTS_DIR / "plots"

SEED = 42
HORIZONS: tuple[int, ...] = (7, 14, 30)
GROUP = ["hospital_id", "location_id", "medicine_id"]

TRAIN_START, TRAIN_END = date(2025, 10, 9), date(2026, 6, 20)
VAL_START, VAL_END = date(2026, 6, 21), date(2026, 8, 14)
TEST_START, TEST_END = date(2026, 8, 15), date(2026, 10, 8)
SPIKE_START, SPIKE_END = date(2026, 6, 16), date(2026, 7, 13)

MODEL_NAME = "medical_demand_lightgbm"
MODEL_VERSION = "1.0.0"
