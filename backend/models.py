"""
models.py

SQLAlchemy ORM models matching the Entity-Relationship Diagram and table
definitions in Chapter 3 (Section 3.3.1 ERD, Section 3.3.3 Tables 3.1-3.6).

Two additions were necessary that are NOT in the documented ERD/tables,
because the documented schema has nowhere to store the actual election
result data (votes, turnout, etc.) the ML model is trained on and scores:

  1. tbl_states - referenced by tbl_pollingunit.stateID as a foreign key
     in Table 3.3, but never separately defined as its own table in the
     thesis. Added here as the lookup table that foreign key implies.

  2. tbl_electionresult - NOT present anywhere in Figure 3.5 or Tables
     3.1-3.6. The documented tables cover users, elections, polling
     units, incidents, models, and predictions, but none of them hold
     registered voters, votes cast, turnout %, vote share, or Benford
     deviation score - the actual input features the classifier, risk
     scorer, and anomaly detector are trained on. Added here to close
     that gap. Flag this to your supervisor/team if strict ERD
     conformance matters - it may be worth adding a Table 3.7 to
     Chapter 3 documenting this table retroactively.

A few columns were also added to tbl_riskprediction beyond the two
documented there (riskLevel, riskScore): malpracticePredicted,
malpracticeProbability, isAnomaly, anomalyScore, createdAt, and a
resultID foreign key. This is because the actual system runs three
models (classification, risk scoring, anomaly detection) producing more
output than the two-field table anticipated. These are additions, not
deviations from what's documented - they extend rather than contradict
Chapter 3.
"""

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class State(Base):
    """ADDITION - implied by tbl_pollingunit.stateID FK but not defined in Ch.3."""

    __tablename__ = "tbl_states"

    stateID = Column(Integer, primary_key=True, autoincrement=True)
    stateName = Column(String(50), unique=True, nullable=False)
    zone = Column(String(50), nullable=False)  # geopolitical zone

    polling_units = relationship("PollingUnit", back_populates="state")


class User(Base):
    """Matches Ch.3 Table 3.1: tbl_users."""

    __tablename__ = "tbl_users"

    userID = Column(Integer, primary_key=True, autoincrement=True)
    fullName = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    password = Column(String(255), nullable=False)  # hashed, never plaintext
    role = Column(String(30), nullable=False)  # Administrator, Analyst, Security Officer


class Election(Base):
    """Matches Ch.3 Table 3.2: tbl_election."""

    __tablename__ = "tbl_election"

    electionID = Column(Integer, primary_key=True, autoincrement=True)
    electionType = Column(String(50), nullable=False)  # e.g. Presidential, Gubernatorial
    electionDate = Column(Date, nullable=False)

    results = relationship("ElectionResult", back_populates="election")
    incidents = relationship("IncidentRecord", back_populates="election")


class PollingUnit(Base):
    """
    Matches Ch.3 Table 3.3: tbl_pollingunit.
    pollingUnitCode is an ADDITION - the documented table has no field to
    label/identify a specific polling unit beyond its ward.
    """

    __tablename__ = "tbl_pollingunit"

    puID = Column(Integer, primary_key=True, autoincrement=True)
    stateID = Column(Integer, ForeignKey("tbl_states.stateID"), nullable=False)
    lga = Column(String(50), nullable=False)
    ward = Column(String(50), nullable=False)
    literacyRate = Column(Float, nullable=True)
    unemploymentRate = Column(Float, nullable=True)
    pollingUnitCode = Column(String(50), nullable=True)  # ADDITION

    state = relationship("State", back_populates="polling_units")
    results = relationship("ElectionResult", back_populates="polling_unit")
    incidents = relationship("IncidentRecord", back_populates="polling_unit")
    predictions = relationship("RiskPrediction", back_populates="polling_unit")


class ElectionResult(Base):
    """ADDITION - see module docstring. Not in Ch.3's documented ERD/tables."""

    __tablename__ = "tbl_electionresult"

    resultID = Column(Integer, primary_key=True, autoincrement=True)
    puID = Column(Integer, ForeignKey("tbl_pollingunit.puID"), nullable=False)
    electionID = Column(Integer, ForeignKey("tbl_election.electionID"), nullable=False)
    registeredVoters = Column(Integer, nullable=False)
    accreditedVoters = Column(Integer, nullable=False)
    totalVotesCast = Column(Integer, nullable=False)
    validVotes = Column(Integer, nullable=False)
    rejectedVotes = Column(Integer, default=0)
    turnoutPct = Column(Float, nullable=False)
    leadingPartyVoteShare = Column(Float, nullable=False)
    benfordDeviationScore = Column(Float, default=0.0)
    overVotingFlag = Column(Boolean, default=False)

    polling_unit = relationship("PollingUnit", back_populates="results")
    election = relationship("Election", back_populates="results")
    predictions = relationship("RiskPrediction", back_populates="election_result")


class IncidentRecord(Base):
    """Matches Ch.3 Table 3.4: tbl_incidentrecord."""

    __tablename__ = "tbl_incidentrecord"

    incidentID = Column(Integer, primary_key=True, autoincrement=True)
    puID = Column(Integer, ForeignKey("tbl_pollingunit.puID"), nullable=False)
    electionID = Column(Integer, ForeignKey("tbl_election.electionID"), nullable=False)
    incidentType = Column(String(50), nullable=False)  # e.g. Violence, Ballot Snatching, Over-voting
    severity = Column(String(20), nullable=False)  # Low, Medium, High
    dateReported = Column(Date, nullable=False)

    polling_unit = relationship("PollingUnit", back_populates="incidents")
    election = relationship("Election", back_populates="incidents")


class PredictionModel(Base):
    """Matches Ch.3 Table 3.5: tbl_predictionmodel."""

    __tablename__ = "tbl_predictionmodel"

    modelID = Column(Integer, primary_key=True, autoincrement=True)
    algorithm = Column(String(50), nullable=False)  # e.g. Random Forest, Logistic Regression
    accuracy = Column(Float, nullable=False)
    trainedDate = Column(Date, nullable=False)

    predictions = relationship("RiskPrediction", back_populates="model")


class RiskPrediction(Base):
    """
    Matches Ch.3 Table 3.6: tbl_riskprediction (predictionID, puID, modelID,
    riskLevel, riskScore). The remaining columns are ADDITIONS needed
    because the actual system runs three models (classification, risk
    scoring, anomaly detection) rather than producing only a risk level
    and risk score.
    """

    __tablename__ = "tbl_riskprediction"

    predictionID = Column(Integer, primary_key=True, autoincrement=True)
    puID = Column(Integer, ForeignKey("tbl_pollingunit.puID"), nullable=False)
    modelID = Column(Integer, ForeignKey("tbl_predictionmodel.modelID"), nullable=False)
    resultID = Column(Integer, ForeignKey("tbl_electionresult.resultID"), nullable=True)  # ADDITION
    riskLevel = Column(String(20), nullable=False)  # Low, Medium, High
    riskScore = Column(Float, nullable=False)
    malpracticePredicted = Column(Boolean, default=False)  # ADDITION
    malpracticeProbability = Column(Float, default=0.0)  # ADDITION
    isAnomaly = Column(Boolean, default=False)  # ADDITION
    anomalyScore = Column(Float, default=0.0)  # ADDITION
    createdAt = Column(DateTime, nullable=True)  # ADDITION - for sorting/filtering by recency

    polling_unit = relationship("PollingUnit", back_populates="predictions")
    model = relationship("PredictionModel", back_populates="predictions")
    election_result = relationship("ElectionResult", back_populates="predictions")
