"""Script to seed MedPredict database with synthetic dataset."""

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR / "backend"))

from app.db.seed import seed_database

if __name__ == "__main__":
    seed_database()
