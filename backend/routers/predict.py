import json
import os
import sys
from datetime import date, datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

sys.path.append(str(Path(__file__).resolve().parents[2] / "ml"))
from predict import MalpracticePredictor, get_predictor  # noqa: E402

from auth import require_role
from database import get_db_session
from models import Alert, Election, ElectionResult, PollingUnit, PredictionModel, RiskPrediction, State, User
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
    # Record the winning classifier's name and its accuracy on the test set
    algorithm_name = "Random Forest"
    accuracy = 0.0
    try:
        with open(_METRICS_PATH) as f:
            metrics = json.load(f)
            algorithm_name = metrics.get("classification", {}).get("algorithm", algorithm_name)
            accuracy = metrics.get("classification", {}).get("report", {}).get("accuracy", 0.0)
    except Exception:
        pass
    model = db.query(PredictionModel).filter(PredictionModel.algorithm == algorithm_name).first()
    if not model:
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
    db.flush()  # get predictionID before alert insert

    # Ch.3 Activity Diagram (3.2.5): auto-create alert for High risk
    if result["risk_level"] == "High":
        alert = Alert(
            predictionID=rp.predictionID,
            puID=pu.puID,
            status="Open",
            createdAt=datetime.now(timezone.utc),
        )
        db.add(alert)

    db.commit()

    return result


@router.post("", response_model=RecordWithPrediction)
def predict_single(
    record: ElectionRecordIn,
    db: Session = Depends(get_db_session),
    _: User = Depends(require_role("Administrator", "Analyst")),
):
    result = score_and_store(db, record)
    return {**record.model_dump(), "prediction": result}


@router.post("/batch")
def predict_batch(
    records: list[ElectionRecordIn],
    db: Session = Depends(get_db_session),
    _: User = Depends(require_role("Administrator", "Analyst")),
):
    if len(records) > 5000:
        raise HTTPException(status_code=400, detail="Max 5000 records per batch request")

    results = []
    for record in records:
        result = score_and_store(db, record)
        results.append({**record.model_dump(), "prediction": result})

    return {"count": len(results), "results": results}


@router.get("/metrics")
def model_metrics():
    """Return the stored metrics.json (algorithm comparison + accuracy for all roles)."""
    if not _METRICS_PATH.exists():
        raise HTTPException(status_code=404, detail="metrics.json not found — run train_models.py first.")
    with open(_METRICS_PATH) as f:
        return json.load(f)


@router.post("/retrain")
def retrain_model(
    data_path: str = "../data/nigeria_election_data.csv",
    db: Session = Depends(get_db_session),
    _: User = Depends(require_role("Analyst")),
):
    """
    Analyst-only endpoint. Checks whether the latest model's stored ROC-AUC
    is below the acceptable threshold (0.90); if so, re-runs training against
    the data file at data_path and registers a new tbl_predictionmodel row.
    Returns the comparison table and whether retraining was triggered.
    """
    THRESHOLD = 0.90
    out_dir = str(_METRICS_PATH.parent)

    # Read current accuracy
    current_auc = 0.0
    if _METRICS_PATH.exists():
        with open(_METRICS_PATH) as f:
            current_auc = json.load(f).get("classification", {}).get("roc_auc", 0.0)

    if current_auc >= THRESHOLD:
        return {
            "retrained": False,
            "reason": f"Current ROC-AUC ({current_auc}) meets the threshold ({THRESHOLD}). No retraining needed.",
            "current_roc_auc": current_auc,
        }

    # Trigger retraining via importlib so static analysers don't flag
    # train_models as unresolved (it lives in ml/, added to sys.path above).
    import importlib
    import sys as _sys
    from pathlib import Path as _Path
    _ml_path = str(_Path(__file__).resolve().parents[2] / "ml")
    if _ml_path not in _sys.path:
        _sys.path.insert(0, _ml_path)
    _tm = importlib.import_module("train_models")
    try:
        _tm.main(data_path, out_dir)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {e}")

    # Reload metrics and register new model row
    with open(_METRICS_PATH) as f:
        new_metrics = json.load(f)
    new_auc = new_metrics.get("classification", {}).get("roc_auc", 0.0)
    new_algo = new_metrics.get("classification", {}).get("algorithm", "Unknown")
    new_accuracy = new_metrics.get("classification", {}).get("report", {}).get("accuracy", 0.0)

    new_model = PredictionModel(
        algorithm=new_algo,
        accuracy=new_accuracy,
        trainedDate=date.today(),
    )
    db.add(new_model)
    db.commit()

    # Invalidate the in-memory predictor singleton so the next call reloads
    _predict_mod = importlib.import_module("predict")
    _predict_mod._predictor_singleton = None

    return {
        "retrained": True,
        "previous_roc_auc": current_auc,
        "new_roc_auc": new_auc,
        "selected_algorithm": new_algo,
        "algorithm_comparison": new_metrics.get("algorithm_comparison", {}),
    }
