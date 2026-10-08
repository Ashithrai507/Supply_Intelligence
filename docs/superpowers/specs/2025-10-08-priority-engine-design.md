# Design: Priority Engine (Issue #6)

## Context
Ashithrai507 owns `engines/priority.py`, `optimizer/`, `explain/` (WORKPLAN.md). Issue #6: M4 Priority engine — weighted score + waterfall allocation. Project uses FastAPI + OR-Tools; codebase has engines module scaffolded but priority.py missing.

## Requirements
From issue #6 and spec:
- Score = **40% shortage severity + 25% emergency demand + 15% patient load + 10% lack of alternatives + 10% time-until-stockout** (weights sum 100%)
- Components normalized to 0–100 from risk-card inputs
- Waterfall allocation: needs [A:5000, B:3000, C:2000], supply 6000 with scores A(91), C(84), B(67) → A 3500, C 1800, B 700
- Full score breakdown per hospital
- Deterministic

## Module layout
- `backend/app/engines/priority.py` — core implementation
- `backend/app/engines/__init__.py` — exports (optional)

## Data model
Inputs come from risk cards (per PLAN.md/WORKPLAN). Design uses flexible dicts with sensible keys (backward compatible). Expected fields per item:
- `shortage_severity`: float (0-1 or 0-100; normalize)
- `emergency_demand`: float (0-1 or absolute; normalize relative)
- `patient_load`: float (0-1 or count; normalize)
- `lack_of_alternatives`: bool/int (0 if has alternatives, 1 if no alternatives)
- `time_until_stockout`: float (days; higher urgency if lower days → invert appropriately)
- `need` or `demand_unmet`: int/float (units needed)

## Approach
1. **Normalization**: Each component scaled to 0-100. Document normalization rules. For lack_of_alternatives: 100 if True/no alternatives, else 0 (per "lack of alternatives" weight). For time_until_stockout: invert so shorter TTS = higher score (urgency).
2. **Scoring**: `score = 40*shortage_sev_norm + 25*emergency_norm + 15*patient_norm + 10*alt_norm + 10*tts_norm`, clamp to 0-100, round reasonably (deterministic).
3. **Waterfall allocation**: Sort by score desc, tie-breaker? Deterministic (stable by id/name). Allocate supply down the list: give each as much as needed up to remaining supply; remainder goes to next. Worked example matches.
4. **Output**: Include breakdown with weights and normalized values.

## Test plan
- Unit test for worked example (deterministic)
- Weights sum to 100
- Determinism
- Edge cases (supply 0, supply exceeds sum, ties)
- All tests in `backend/tests/test_priority.py`

## Acceptance
Matches #6 ACs. No changes outside engines area.

