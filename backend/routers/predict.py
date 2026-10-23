import json
import os
import sys
from datetime import date, datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

sys.path.append(str(Path(__file__).resolve().parents[2] / "ml"))
from predict import get_predictor  # noqa: E402

from database import get_db_session
from models import Election, ElectionResult, PollingUnit, PredictionModel, RiskPrediction, State
from schemas import ElectionRecordIn, RecordWithPrediction

router = APIRouter(prefix="/api/predict", tags=["prediction"])

DEFAULT_ELECTION_TYPE = "General Election"
_METRICS_PATH = Path(__file__).resolve().parents[2] / "ml" / "models" / "metrics.json"


def get_or_create_state(db: Session, state_name: str, zone: str) -> State:
    state = db.query(State).filter(State.stateName == state_name).first()
    if not state:
        state = State(stateName=state_name, zone=zone)
        db.add(state)
        db.flush()
    return state


def get_or_create_election(db: Session, election_type: str, election_date: date) -> Election:
    election = (
        db.query(Election)
        .filter(Election.electionType == election_type, Election.electionDate == election_date)
        .first()
    )
    if not election:
        election = Election(electionType=election_type, electionDate=election_date)
        db.add(election)
        db.flush()
    return election


def get_or_create_polling_unit(
    db: Session, state: State, lga: str, ward: str, code: str, literacy: float, unemployment: float
) -> PollingUnit:
    pu = (
        db.query(PollingUnit)
        .filter(
            PollingUnit.stateID == state.stateID,
            PollingUnit.lga == lga,
            PollingUnit.ward == ward,
            PollingUnit.pollingUnitCode == code,
        )
        .first()
    )
    if not pu:
        pu = PollingUnit(
            stateID=state.stateID,
            lga=lga,
            ward=ward,
            pollingUnitCode=code,
            literacyRate=literacy,
            unemploymentRate=unemployment,
        )
        db.add(pu)
        db.flush()
    return pu


def get_or_create_prediction_model(db: Session) -> PredictionModel:
    algorithm_name = "RandomForest+GradientBoosting+IsolationForest"
    model = db.query(PredictionModel).filter(PredictionModel.algorithm == algorithm_name).first()
    if not model:
        accuracy = 0.0
        try:
            with open(_METRICS_PATH) as f:
                metrics = json.load(f)
                accuracy = metrics.get("classification", {}).get("roc_auc", 0.0)
        except Exception:
            pass
        model = PredictionModel(algorithm=algorithm_name, accuracy=accuracy, trainedDate=date.today())
        db.add(model)
        db.flush()
    return model


def score_and_store(db: Session, record: ElectionRecordIn) -> dict:
    """Runs the ML models on a record and persists the full trail:
    state -> election -> polling unit -> election result -> risk prediction."""
    predictor = get_predictor()
    result = predictor.score_record(record.model_dump())

    state = get_or_create_state(db, record.state, record.zone)
    election = get_or_create_election(db, DEFAULT_ELECTION_TYPE, date.today())
    pu = get_or_create_polling_unit(
        db, state, record.lga or "Unknown", str(record.ward or ""),
        record.polling_unit, record.literacy_rate, record.unemployment_rate,
    )

    er = ElectionResult(
        puID=pu.puID,
        electionID=election.electionID,
        registeredVoters=record.registered_voters,
        accreditedVoters=record.accredited_voters,
        totalVotesCast=record.total_votes_cast,
        validVotes=record.valid_votes,
        rejectedVotes=record.rejected_votes,
        turnoutPct=record.turnout_pct,
        leadingPartyVoteShare=record.leading_party_vote_share,
        benfordDeviationScore=record.benford_deviation_score,
        overVotingFlag=bool(record.over_voting_flag),
    )
    db.add(er)
    db.flush()

    model = get_or_create_prediction_model(db)

    rp = RiskPrediction(
        puID=pu.puID,
        modelID=model.modelID,
        resultID=er.resultID,
        riskLevel=result["risk_level"],
        riskScore=result["risk_score"],
        malpracticePredicted=result["malpractice_predicted"],
        malpracticeProbability=result["malpractice_probability"],
        isAnomaly=result["is_anomaly"],
        anomalyScore=result["anomaly_score"],
        createdAt=datetime.now(timezone.utc),
    )
    db.add(rp)
    db.commit()

    return result


@router.post("", response_model=RecordWithPrediction)
def predict_single(record: ElectionRecordIn, db: Session = Depends(get_db_session)):
    result = score_and_store(db, record)
    return {**record.model_dump(), "prediction": result}


@router.post("/batch")
def predict_batch(records: list[ElectionRecordIn], db: Session = Depends(get_db_session)):
    if len(records) > 5000:
        raise HTTPException(status_code=400, detail="Max 5000 records per batch request")

    results = []
    for record in records:
        result = score_and_store(db, record)
        results.append({**record.model_dump(), "prediction": result})

    return {"count": len(results), "results": results}
