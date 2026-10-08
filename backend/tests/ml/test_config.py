from datetime import date

from ml.preprocessing import config as c


def test_data_paths_exist() -> None:
    assert c.DEMAND_PATH.exists()
    assert c.MEDICINES_PATH.exists()
    assert c.HOSPITALS_PATH.exists()


def test_artifact_dirs_are_under_backend_ml() -> None:
    assert c.MODELS_DIR == c.BACKEND_ROOT / "ml" / "artifacts" / "models"
    assert c.OUTPUTS_DIR == c.ARTIFACTS_DIR / "outputs"


def test_split_is_strictly_increasing_and_covers_365_days() -> None:
    assert c.TRAIN_END < c.VAL_START
    assert c.VAL_END < c.TEST_START
    assert (c.TRAIN_END - c.TRAIN_START).days + 1 == 255
    assert (c.VAL_END - c.VAL_START).days + 1 == 55
    assert (c.TEST_END - c.TEST_START).days + 1 == 55
    assert (c.TEST_END - c.TRAIN_START).days + 1 == 365
    assert c.TEST_END == date(2026, 10, 8)


def test_constants() -> None:
    assert c.SEED == 42
    assert c.HORIZONS == (7, 14, 30)
    assert c.GROUP == ["hospital_id", "location_id", "medicine_id"]
    assert c.SPIKE_START == date(2026, 6, 16)
    assert c.SPIKE_END == date(2026, 7, 13)
