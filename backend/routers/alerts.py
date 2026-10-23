"""
routers/alerts.py

Ch.3 Activity Diagram (3.2.5): when a High-risk prediction is stored,
the system sends an alert to the Security Agency Officer who deploys
resources and submits field response feedback.

  GET   /api/alerts        — list open/all alerts (Security Officer + Administrator)
  PATCH /api/alerts/{id}   — Security Officer updates status + field feedback
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import require_role
from database import get_db_session
from models import Alert, PollingUnit, RiskPrediction, State, User

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

VALID_STATUSES = {"Open", "Responding", "Resolved"}


# ── Schemas ────────────────────────────────────────────────────────────────

class AlertPatch(BaseModel):
    status: Optional[str] = None
    fieldResponseFeedback: Optional[str] = None


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.get("")
def list_alerts(
    status: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
    db: Session = Depends(get_db_session),
    _: User = Depends(require_role("Security Officer", "Administrator")),
):
    """Open alert queue for the Security Officer / Administrator."""
    query = (
        db.query(Alert, RiskPrediction, PollingUnit, State)
        .join(RiskPrediction, Alert.predictionID == RiskPrediction.predictionID)
        .join(PollingUnit, Alert.puID == PollingUnit.puID)
        .join(State, PollingUnit.stateID == State.stateID)
    )
    if status:
        query = query.filter(Alert.status == status)
    else:
        # Default: show non-resolved alerts first
        query = query.filter(Alert.status != "Resolved")

    rows = (
        query.order_by(Alert.createdAt.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [_serialize(alert, rp, pu, st) for alert, rp, pu, st in rows]


@router.patch("/{alert_id}")
def update_alert(
    alert_id: int,
    patch: AlertPatch,
    db: Session = Depends(get_db_session),
    _: User = Depends(require_role("Security Officer", "Administrator")),
):
    """
    Security Officer logs their field response: updates status and/or
    appends feedback. Matches Ch.3 Activity Diagram step: 'submits field
    response feedback'.
    """
    alert = db.query(Alert).filter(Alert.alertID == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")

    if patch.status is not None:
        if patch.status not in VALID_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"status must be one of: {sorted(VALID_STATUSES)}",
            )
        alert.status = patch.status

    if patch.fieldResponseFeedback is not None:
        alert.fieldResponseFeedback = patch.fieldResponseFeedback

    db.commit()
    db.refresh(alert)

    rp = db.query(RiskPrediction).filter(RiskPrediction.predictionID == alert.predictionID).first()
    pu = db.query(PollingUnit).filter(PollingUnit.puID == alert.puID).first()
    st = db.query(State).filter(State.stateID == pu.stateID).first() if pu else None
    return _serialize(alert, rp, pu, st)


@router.get("/count")
def alert_count(
    db: Session = Depends(get_db_session),
    _: User = Depends(require_role("Security Officer", "Administrator")),
):
    """Quick badge count for the UI — open alerts only."""
    open_count = db.query(Alert).filter(Alert.status == "Open").count()
    responding = db.query(Alert).filter(Alert.status == "Responding").count()
    resolved = db.query(Alert).filter(Alert.status == "Resolved").count()
    return {"open": open_count, "responding": responding, "resolved": resolved}


# ── Helpers ────────────────────────────────────────────────────────────────

def _serialize(alert: Alert, rp: RiskPrediction, pu: PollingUnit, st: State) -> dict:
    return {
        "alertID": alert.alertID,
        "predictionID": alert.predictionID,
        "status": alert.status,
        "fieldResponseFeedback": alert.fieldResponseFeedback,
        "createdAt": alert.createdAt.isoformat() if alert.createdAt else None,
        "polling_unit": {
            "puID": pu.puID if pu else None,
            "code": pu.pollingUnitCode if pu else None,
            "lga": pu.lga if pu else None,
            "ward": pu.ward if pu else None,
            "state": st.stateName if st else None,
            "zone": st.zone if st else None,
        },
        "risk": {
            "risk_level": rp.riskLevel if rp else None,
            "risk_score": rp.riskScore if rp else None,
            "malpractice_predicted": rp.malpracticePredicted if rp else None,
        },
    }
