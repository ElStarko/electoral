from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db_session
from models import ElectionResult, PollingUnit, RiskPrediction, State

router = APIRouter(prefix="/api/records", tags=["records"])


def serialize(rp: RiskPrediction, pu: PollingUnit, st: State, er: Optional[ElectionResult]):
    return {
        "_id": rp.predictionID,
        "state": st.stateName,
        "zone": st.zone,
        "lga": pu.lga,
        "ward": pu.ward,
        "polling_unit": pu.pollingUnitCode,
        "turnout_pct": er.turnoutPct if er else None,
        "prediction": {
            "risk_score": rp.riskScore,
            "risk_level": rp.riskLevel,
            "malpractice_predicted": rp.malpracticePredicted,
            "is_anomaly": rp.isAnomaly,
        },
        "created_at": rp.createdAt.isoformat() if rp.createdAt else None,
    }


def _base_query(db: Session):
    return (
        db.query(RiskPrediction, PollingUnit, State, ElectionResult)
        .join(PollingUnit, RiskPrediction.puID == PollingUnit.puID)
        .join(State, PollingUnit.stateID == State.stateID)
        .outerjoin(ElectionResult, RiskPrediction.resultID == ElectionResult.resultID)
    )


def _apply_filters(query, state, zone, risk_level, malpractice_only):
    if state:
        query = query.filter(State.stateName == state)
    if zone:
        query = query.filter(State.zone == zone)
    if risk_level:
        query = query.filter(RiskPrediction.riskLevel == risk_level)
    if malpractice_only:
        query = query.filter(RiskPrediction.malpracticePredicted == True)  # noqa: E712
    return query


@router.get("")
def list_records(
    state: Optional[str] = None,
    zone: Optional[str] = None,
    risk_level: Optional[str] = None,
    malpractice_only: bool = False,
    limit: int = Query(100, le=1000),
    skip: int = 0,
    db: Session = Depends(get_db_session),
):
    query = _apply_filters(_base_query(db), state, zone, risk_level, malpractice_only)
    total = query.count()
    rows = query.order_by(RiskPrediction.createdAt.desc()).offset(skip).limit(limit).all()
    records = [serialize(rp, pu, st, er) for rp, pu, st, er in rows]
    return {"total": total, "count": len(records), "records": records}


@router.get("/{record_id}")
def get_record(record_id: int, db: Session = Depends(get_db_session)):
    row = (
        _base_query(db)
        .filter(RiskPrediction.predictionID == record_id)
        .first()
    )
    if not row:
        return {"error": "not found"}
    rp, pu, st, er = row
    return serialize(rp, pu, st, er)
