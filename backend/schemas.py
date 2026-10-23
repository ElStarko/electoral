from typing import Optional, Union

from pydantic import BaseModel, Field


class ElectionRecordIn(BaseModel):
    state: str
    zone: str
    lga: Optional[str] = ""
    ward: Optional[Union[str, int]] = ""
    polling_unit: Optional[str] = ""
    registered_voters: int = Field(..., ge=0)
    accredited_voters: int = Field(..., ge=0)
    total_votes_cast: int = Field(..., ge=0)
    valid_votes: int = Field(..., ge=0)
    rejected_votes: int = Field(0, ge=0)
    turnout_pct: float
    leading_party_vote_share: float
    benford_deviation_score: float = 0.0
    over_voting_flag: int = 0
    incident_reported: int = 0
    literacy_rate: float = 60.0
    unemployment_rate: float = 25.0


class PredictionOut(BaseModel):
    malpractice_predicted: bool
    malpractice_probability: float
    risk_score: float
    risk_level: str
    is_anomaly: bool
    anomaly_score: float


class RecordWithPrediction(ElectionRecordIn):
    prediction: PredictionOut


class UserCreate(BaseModel):
    full_name: str
    email: str
    password: str
    role: str  # "Administrator", "Analyst", or "Security Officer"


class UserLogin(BaseModel):
    email: str
    password: str


class UserPublic(BaseModel):
    full_name: str
    email: str
    role: str


class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    full_name: str
