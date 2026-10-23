from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db_session
from models import PollingUnit, RiskPrediction, State

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/overview")
def overview(db: Session = Depends(get_db_session)):
    total = db.query(RiskPrediction).count()
    malpractice_count = (
        db.query(RiskPrediction).filter(RiskPrediction.malpracticePredicted == True).count()  # noqa: E712
    )
    anomaly_count = db.query(RiskPrediction).filter(RiskPrediction.isAnomaly == True).count()  # noqa: E712
    avg_risk = db.query(func.avg(RiskPrediction.riskScore)).scalar() or 0

    return {
        "total_records": total,
        "malpractice_flagged": malpractice_count,
        "malpractice_rate_pct": round(malpractice_count / total * 100, 2) if total else 0,
        "anomalies_flagged": anomaly_count,
        "average_risk_score": round(avg_risk, 2),
    }


@router.get("/by-state")
def stats_by_state(db: Session = Depends(get_db_session)):
    rows = (
        db.query(
            State.stateName.label("state"),
            func.count(RiskPrediction.predictionID).label("total"),
            func.sum(RiskPrediction.malpracticePredicted).label("malpractice_count"),
            func.avg(RiskPrediction.riskScore).label("avg_risk_score"),
        )
        .join(PollingUnit, RiskPrediction.puID == PollingUnit.puID)
        .join(State, PollingUnit.stateID == State.stateID)
        .group_by(State.stateName)
        .order_by(func.avg(RiskPrediction.riskScore).desc())
        .all()
    )
    states = []
    for r in rows:
        malpractice_count = int(r.malpractice_count or 0)
        states.append({
            "state": r.state,
            "total": r.total,
            "malpractice_count": malpractice_count,
            "avg_risk_score": round(r.avg_risk_score, 2) if r.avg_risk_score else 0,
            "malpractice_rate_pct": round(malpractice_count / r.total * 100, 2) if r.total else 0,
        })
    return {"states": states}


@router.get("/by-zone")
def stats_by_zone(db: Session = Depends(get_db_session)):
    rows = (
        db.query(
            State.zone.label("zone"),
            func.count(RiskPrediction.predictionID).label("total"),
            func.sum(RiskPrediction.malpracticePredicted).label("malpractice_count"),
            func.avg(RiskPrediction.riskScore).label("avg_risk_score"),
        )
        .join(PollingUnit, RiskPrediction.puID == PollingUnit.puID)
        .join(State, PollingUnit.stateID == State.stateID)
        .group_by(State.zone)
        .order_by(func.avg(RiskPrediction.riskScore).desc())
        .all()
    )
    zones = []
    for r in rows:
        malpractice_count = int(r.malpractice_count or 0)
        zones.append({
            "zone": r.zone,
            "total": r.total,
            "malpractice_count": malpractice_count,
            "avg_risk_score": round(r.avg_risk_score, 2) if r.avg_risk_score else 0,
            "malpractice_rate_pct": round(malpractice_count / r.total * 100, 2) if r.total else 0,
        })
    return {"zones": zones}


@router.get("/risk-distribution")
def risk_distribution(db: Session = Depends(get_db_session)):
    rows = (
        db.query(RiskPrediction.riskLevel, func.count(RiskPrediction.predictionID))
        .group_by(RiskPrediction.riskLevel)
        .all()
    )
    return {"distribution": [{"risk_level": r[0], "count": r[1]} for r in rows]}
