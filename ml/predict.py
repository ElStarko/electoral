"""
predict.py

Loads the trained models once and exposes a single `score_record()` function
that the backend API calls for every prediction request. Keeping this in one
place means the backend, a notebook, or a batch job all score records
identically.
"""

import json
import os

import joblib
import numpy as np
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")


class MalpracticePredictor:
    def __init__(self, models_dir: str = MODELS_DIR):
        self.classifier = joblib.load(os.path.join(models_dir, "classifier.joblib"))
        self.risk_scorer = joblib.load(os.path.join(models_dir, "risk_scorer.joblib"))
        self.anomaly_detector = joblib.load(os.path.join(models_dir, "anomaly_detector.joblib"))
        self.scaler = joblib.load(os.path.join(models_dir, "feature_scaler.joblib"))
        self.encoders = joblib.load(os.path.join(models_dir, "label_encoders.joblib"))
        with open(os.path.join(models_dir, "feature_columns.json")) as f:
            self.feature_columns = json.load(f)

    def _prepare(self, record: dict) -> pd.DataFrame:
        df = pd.DataFrame([record])

        df["accreditation_vs_registered"] = df["accredited_voters"] / max(record["registered_voters"], 1)
        df["votes_vs_accredited"] = df["total_votes_cast"] / max(record["accredited_voters"], 1)
        df["rejected_rate"] = df.get("rejected_votes", 0) / max(record["total_votes_cast"], 1)

        for col in ["zone", "state"]:
            le = self.encoders[col]
            val = record.get(col, None)
            if val in le.classes_:
                df[f"{col}_encoded"] = le.transform([val])[0]
            else:
                df[f"{col}_encoded"] = -1

        for col in self.feature_columns:
            if col not in df.columns:
                df[col] = 0

        return df[self.feature_columns]

    def score_record(self, record: dict) -> dict:
        """
        record: dict with at minimum the raw election fields, e.g.
            {
              "state": "Lagos", "zone": "South West",
              "registered_voters": 550, "accredited_voters": 400,
              "total_votes_cast": 410, "valid_votes": 400, "rejected_votes": 10,
              "turnout_pct": 74.5, "leading_party_vote_share": 0.9,
              "benford_deviation_score": 0.35, "over_voting_flag": 0,
              "incident_reported": 0, "literacy_rate": 90.0,
              "unemployment_rate": 18.0
            }
        """
        X = self._prepare(record)
        X_scaled = self.scaler.transform(X)

        malpractice_pred = int(self.classifier.predict(X_scaled)[0])
        malpractice_proba = float(self.classifier.predict_proba(X_scaled)[0][1])

        risk_proba = float(self.risk_scorer.predict_proba(X_scaled)[0][1])
        risk_score = round(risk_proba * 20, 1)  # 0-20 scale per thesis Ch.1 definition

        anomaly_raw = int(self.anomaly_detector.predict(X_scaled)[0])
        is_anomaly = anomaly_raw == -1
        anomaly_score = float(-self.anomaly_detector.score_samples(X_scaled)[0])  # higher = more anomalous

        if risk_score >= 13:
            risk_level = "High"
        elif risk_score >= 7:
            risk_level = "Medium"
        else:
            risk_level = "Low"

        return {
            "malpractice_predicted": bool(malpractice_pred),
            "malpractice_probability": round(malpractice_proba, 4),
            "risk_score": risk_score,
            "risk_level": risk_level,
            "is_anomaly": is_anomaly,
            "anomaly_score": round(anomaly_score, 4),
        }


_predictor_singleton = None


def get_predictor() -> MalpracticePredictor:
    global _predictor_singleton
    if _predictor_singleton is None:
        _predictor_singleton = MalpracticePredictor()
    return _predictor_singleton


if __name__ == "__main__":
    predictor = get_predictor()
    sample = {
        "state": "Kano", "zone": "North West",
        "registered_voters": 500, "accredited_voters": 480,
        "total_votes_cast": 495, "valid_votes": 490, "rejected_votes": 5,
        "turnout_pct": 99.0, "leading_party_vote_share": 0.96,
        "benford_deviation_score": 0.55, "over_voting_flag": 0,
        "incident_reported": 1, "literacy_rate": 52.0, "unemployment_rate": 31.0,
    }
    print(predictor.score_record(sample))
