from __future__ import annotations

from typing import Any

from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .allocation import allocate_greedy, allocate_hungarian, compare_allocations
from .domain import result_to_dict, scenario_from_payload
from .sample_data import get_sample_scenario


app = FastAPI(
    title="FieldOps Dispatch Lab",
    description="Field service dispatch optimizer with greedy and Hungarian algorithms.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/scenario")
def scenario() -> dict[str, Any]:
    return get_sample_scenario()


@app.post("/api/allocate")
def allocate(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    algorithm = str(payload.get("algorithm", "hungarian")).lower()
    try:
        resources, requests, config = scenario_from_payload(payload)
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid scenario: {exc}") from exc

    if algorithm == "greedy":
        result = allocate_greedy(resources, requests, config)
    elif algorithm == "hungarian":
        result = allocate_hungarian(resources, requests, config)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown algorithm: {algorithm}")

    return result_to_dict(result)


@app.post("/api/compare")
def compare(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    try:
        resources, requests, config = scenario_from_payload(payload)
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid scenario: {exc}") from exc

    results = compare_allocations(resources, requests, config)
    return {
        "results": {name: result_to_dict(result) for name, result in results.items()},
        "scenario": payload,
    }
