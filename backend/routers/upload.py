import io
import sys
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

sys.path.append(str(Path(__file__).resolve().parents[2] / "ml"))

from auth import require_role
from database import get_db_session
from models import User
from routers.predict import score_and_store
from schemas import ElectionRecordIn

router = APIRouter(prefix="/api/upload", tags=["upload"])

REQUIRED_COLUMNS = {
    "state", "zone", "registered_voters", "accredited_voters",
    "total_votes_cast", "valid_votes", "turnout_pct",
    "leading_party_vote_share",
}


@router.post("/csv")
def upload_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db_session),
    _: User = Depends(require_role("Administrator", "Analyst")),
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a .csv file")

    content = file.file.read()
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {e}")

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required columns: {sorted(missing)}")

    for optional_col, default in [
        ("lga", ""), ("ward", ""), ("polling_unit", ""),
        ("rejected_votes", 0), ("benford_deviation_score", 0.0),
        ("over_voting_flag", 0), ("incident_reported", 0),
        ("literacy_rate", 60.0), ("unemployment_rate", 25.0),
    ]:
        if optional_col not in df.columns:
            df[optional_col] = default

    rows_processed = 0
    n_malpractice = 0
    for record_dict in df.to_dict(orient="records"):
        record = ElectionRecordIn(**record_dict)
        result = score_and_store(db, record)
        rows_processed += 1
        if result["malpractice_predicted"]:
            n_malpractice += 1

    return {
        "rows_processed": rows_processed,
        "malpractice_flagged": n_malpractice,
        "malpractice_rate_pct": round(n_malpractice / rows_processed * 100, 2) if rows_processed else 0,
    }
