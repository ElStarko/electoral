"""
routers/incidents.py

Ch.3 Use Case Diagram (3.2.4): Voter / Election Observer submits incident
reports into tbl_incidentrecord.

  POST /api/incidents   — any authenticated user can submit
  GET  /api/incidents   — filterable list (all authenticated roles)
"""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db_session
from models import Election, IncidentRecord, PollingUnit, State

router = APIRouter(prefix="/api/incidents", tags=["incidents"])

VALID_INCIDENT_TYPES = {
    "Violence",
    "Ballot Snatching",
    "Over-voting",
    "Voter Intimidation",
    "Result Falsification",
    "Underage Voting",
    "Other",
}
VALID_SEVERITIES = {"Low", "Medium", "High"}


# ── Schemas ────────────────────────────────────────────────────────────────

class IncidentIn(BaseModel):
    puID: int
    electionID: int
    incidentType: str
    severity: str
    dateReported: Optional[date] = None


class IncidentOut(BaseModel):
    incidentID: int
    puID: int
    electionID: int
    incidentType: str
    severity: str
    dateReported: str
    state: Optional[str] = None
    lga: Optional[str] = None
    ward: Optional[str] = None


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.post("", response_model=IncidentOut, status_code=201)
def report_incident(payload: IncidentIn, db: Session = Depends(get_db_session)):
    """Any authenticated user (Voter / Observer proxy) can submit an incident."""
    if payload.incidentType not in VALID_INCIDENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"incidentType must be one of: {sorted(VALID_INCIDENT_TYPES)}",
        )
    if payload.severity not in VALID_SEVERITIES:
        raise HTTPException(
            status_code=400,
            detail=f"severity must be one of: {sorted(VALID_SEVERITIES)}",
        )

    # Verify puID and electionID exist
    pu = db.query(PollingUnit).filter(PollingUnit.puID == payload.puID).first()
    if not pu:
        raise HTTPException(status_code=404, detail=f"Polling unit {payload.puID} not found")
    election = db.query(Election).filter(Election.electionID == payload.electionID).first()
    if not election:
        raise HTTPException(status_code=404, detail=f"Election {payload.electionID} not found")

    incident = IncidentRecord(
        puID=payload.puID,
        electionID=payload.electionID,
        incidentType=payload.incidentType,
        severity=payload.severity,
        dateReported=payload.dateReported or date.today(),
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)

    state = db.query(State).filter(State.stateID == pu.stateID).first()
    return _serialize(incident, pu, state)


@router.get("", response_model=list[IncidentOut])
def list_incidents(
    state: Optional[str] = None,
    severity: Optional[str] = None,
    incident_type: Optional[str] = None,
    limit: int = Query(100, le=500),
    skip: int = 0,
    db: Session = Depends(get_db_session),
):
    query = (
        db.query(IncidentRecord, PollingUnit, State)
        .join(PollingUnit, IncidentRecord.puID == PollingUnit.puID)
        .join(State, PollingUnit.stateID == State.stateID)
    )
    if state:
        query = query.filter(State.stateName == state)
    if severity:
        query = query.filter(IncidentRecord.severity == severity)
    if incident_type:
        query = query.filter(IncidentRecord.incidentType == incident_type)

    rows = (
        query.order_by(IncidentRecord.dateReported.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [_serialize(inc, pu, st) for inc, pu, st in rows]


@router.get("/meta")
def incidents_meta():
    """Returns valid enum values so the form can populate dropdowns."""
    return {
        "incident_types": sorted(VALID_INCIDENT_TYPES),
        "severities": sorted(VALID_SEVERITIES),
    }


# ── Helpers ────────────────────────────────────────────────────────────────

def _serialize(inc: IncidentRecord, pu: PollingUnit, state: Optional[State]) -> dict:
    return {
        "incidentID": inc.incidentID,
        "puID": inc.puID,
        "electionID": inc.electionID,
        "incidentType": inc.incidentType,
        "severity": inc.severity,
        "dateReported": inc.dateReported.isoformat() if inc.dateReported else "",
        "state": state.stateName if state else None,
        "lga": pu.lga,
        "ward": pu.ward,
    }
