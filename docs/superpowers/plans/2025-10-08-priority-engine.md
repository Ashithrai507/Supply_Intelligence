# Priority Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Issue #6 - Priority engine with weighted score (40/25/15/10/10) and waterfall allocation.

**Architecture:** Add deterministic scoring and allocation logic in `engines/priority.py`. Pure functions, no external dependencies beyond stdlib. Tests in `backend/tests/test_priority.py`.

**Tech Stack:** Python 3.11, pytest.

## Global Constraints
- Only edit own module (`engines/priority.py`, `engines/__init__.py` if needed)
- Unit tests pass locally
- Deterministic outputs
- Weights sum to 100%
- Follow existing codebase style (ruff config)
- No LLM calls
- Match frozen contract shapes where consumed

---

### Task 1: Create failing tests for priority engine

**Files:**
- Create: `backend/tests/test_priority.py`

**Interfaces:**
- Consumes: None (TDD - write tests first)
- Produces: Test specifications for priority scoring and waterfall allocation

- [ ] **Step 1: Write failing tests**

```python
from app.engines import priority


def test_weights_sum_to_100():
    assert sum(priority.WEIGHTS.values()) == 100


def test_scoring_returns_breakdown_and_score():
    item = {
        "shortage_severity": 0.9,
        "emergency_demand": 0.8,
        "patient_load": 0.8,
        "lack_of_alternatives": True,
        "time_until_stockout": 2,
    }
    res = priority.score_priority(item)
    assert "score" in res
    assert "breakdown" in res
    assert 0 <= res["score"] <= 100
```

- [ ] **Step 2: Add worked example test from issue #6**

```python
def test_waterfall_allocation_worked_example():
    needs = {"A": 5000, "B": 3000, "C": 2000}
    scores = {"A": 91, "B": 67, "C": 84}
    result = priority.waterfall_allocate(needs, 6000, scores=scores)
    assert result["allocations"] == {"A": 3500, "C": 1800, "B": 700}
    assert result["remaining"] == 0
    assert result["unmet"] == {"A": 1500, "B": 2300, "C": 200}
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /Users/ashithrai/Documents/projects/Supply_Intelligence/backend && uv run pytest tests/test_priority.py -v
```
Expected: FAIL

- [ ] **Step 4: Commit**

```bash
cd /Users/ashithrai/Documents/projects/Supply_Intelligence && git add backend/tests/test_priority.py && git commit -m "test(priority): add failing tests for scoring and waterfall allocation"
```

---

### Task 2: Implement priority engine core

**Files:**
- Create: `backend/app/engines/priority.py`

**Interfaces:**
- Consumes: Test expectations from Task 1
- Produces: `WEIGHTS`, `score_priority()`, `waterfall_allocate()`

- [ ] **Step 1: Create priority module with weights**

```python
WEIGHTS = {
    "shortage_severity": 40,
    "emergency_demand": 25,
    "patient_load": 15,
    "lack_of_alternatives": 10,
    "time_until_stockout": 10,
}
```

- [ ] **Step 2: Implement helpers and scoring**

```python
def _clamp01(x):
    if x is None:
        return 0.0
    f = float(x)
    if f < 0.0:
        return 0.0
    if f > 1.0:
        return 1.0
    return f
```

```python
def score_priority(item):
    breakdown = {}
    # Implement all 5 components as per spec
    return {"score": 0.0, "breakdown": breakdown}
```

(Full implementation details in design; write concrete code)

- [ ] **Step 3: Implement waterfall allocation**

```python
def waterfall_allocate(needs_by_hospital, total_supply, scores=None):
    items = [(hid, int(need)) for hid, need in needs_by_hospital.items()]
    if scores:
        items.sort(key=lambda x: (-float(scores.get(x[0], 0)), str(x[0])))
    else:
        items.sort(key=lambda x: str(x[0]))
    allocations = {hid: 0 for hid, _ in items}
    remaining = int(total_supply)
    for hid, need in items:
        take = min(need, remaining)
        allocations[hid] = take
        remaining -= take
    unmet = {hid: max(0, need - allocations[hid]) for hid, need in items}
    return {"allocations": allocations, "remaining": remaining, "unmet": unmet}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/ashithrai/Documents/projects/Supply_Intelligence/backend && uv run pytest tests/test_priority.py -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/ashithrai/Documents/projects/Supply_Intelligence && git add backend/app/engines/priority.py && git commit -m "feat(priority): implement scoring and waterfall allocation"
```

---

### Task 3: Add edge cases and harden

**Files:**
- Modify: `backend/tests/test_priority.py`, `backend/app/engines/priority.py`

- [ ] **Step 1: Add tests for ties, supply>sum**

- [ ] **Step 2: Implement robust normalization**

- [ ] **Step 3: Run all tests**

```bash
cd /Users/ashithrai/Documents/projects/Supply_Intelligence/backend && uv run pytest -v
```

- [ ] **Step 4: Commit**

```bash
cd /Users/ashithrai/Documents/projects/Supply_Intelligence && git add backend/app/engines/priority.py backend/tests/test_priority.py && git commit -m "test(priority): add edge cases"
```

---

### Task 4: Verify acceptance criteria

- [ ] **Step 1:** Verify worked example matches exactly
- [ ] **Step 2:** Verify weights sum to 100
- [ ] **Step 3:** Run priority tests - all pass
- [ ] **Step 4:** Run full suite - no regressions

