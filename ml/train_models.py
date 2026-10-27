"""
train_models.py

Trains the three ML components of the Intelligent Electoral Malpractice
Prediction System:

  1. CLASSIFICATION   - Ch.2 candidates evaluated: Random Forest, Decision
                        Tree, Logistic Regression, SVM.  All four are trained
                        on the same train/test split, their ROC-AUC /
                        precision / recall / F1 are compared, and the best-
                        performing model is saved as classifier.joblib.
                        A full comparison table is written to metrics.json
                        under the key "algorithm_comparison" so the thesis
                        can reference actual numbers for all four algorithms.

  2. RISK SCORING     - GradientBoostingClassifier probability output,
                         rescaled to a 0-20 risk score per record/region.

  3. ANOMALY DETECTION - IsolationForest, unsupervised, flags statistical
                         outliers independent of the labelled malpractice
                         column (catches novel patterns the classifier
                         wasn't trained on).

Run:
    python3 train_models.py --data ../data/nigeria_election_data.csv

Outputs (into ./models/):
    classifier.joblib
    risk_scorer.joblib
    anomaly_detector.joblib
    feature_scaler.joblib
    label_encoders.joblib
    feature_columns.json
    metrics.json
"""

import argparse
import json
import os

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import (
    GradientBoostingClassifier,
    IsolationForest,
    RandomForestClassifier,
)
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    classification_report,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier

FEATURE_COLUMNS = [
    "registered_voters",
    "accredited_voters",
    "total_votes_cast",
    "valid_votes",
    "rejected_votes",
    "turnout_pct",
    "leading_party_vote_share",
    "benford_deviation_score",
    "over_voting_flag",
    "literacy_rate",
    "unemployment_rate",
    "zone_encoded",
    "state_encoded",
]

TARGET_COL = "is_malpractice"


def engineer_features(df: pd.DataFrame, encoders=None, fit=True):
    df = df.copy()

    # Derived features that raise/lower malpractice likelihood
    df["accreditation_vs_registered"] = df["accredited_voters"] / df["registered_voters"].replace(0, np.nan)
    df["votes_vs_accredited"] = df["total_votes_cast"] / df["accredited_voters"].replace(0, np.nan)
    df["rejected_rate"] = df["rejected_votes"] / df["total_votes_cast"].replace(0, np.nan)
    df.fillna(0, inplace=True)

    if encoders is None:
        encoders = {}
    if fit:
        for col in ["zone", "state"]:
            le = LabelEncoder()
            df[f"{col}_encoded"] = le.fit_transform(df[col])
            encoders[col] = le
    else:
        for col in ["zone", "state"]:
            le = encoders[col]
            df[f"{col}_encoded"] = df[col].map(
                lambda x: le.transform([x])[0] if x in le.classes_ else -1
            )

    extra_features = ["accreditation_vs_registered", "votes_vs_accredited", "rejected_rate"]
    return df, encoders, extra_features


def _summarise_report(report: dict) -> dict:
    """Extract per-class and weighted averages from a classification_report dict."""
    return {
        "accuracy": round(report.get("accuracy", 0.0), 4),
        "precision_weighted": round(report.get("weighted avg", {}).get("precision", 0.0), 4),
        "recall_weighted": round(report.get("weighted avg", {}).get("recall", 0.0), 4),
        "f1_weighted": round(report.get("weighted avg", {}).get("f1-score", 0.0), 4),
    }


def main(data_path: str, out_dir: str):
    os.makedirs(out_dir, exist_ok=True)

    df = pd.read_csv(data_path)
    df, encoders, extra_features = engineer_features(df, fit=True)

    all_features = FEATURE_COLUMNS + extra_features
    X = df[all_features]
    y = df[TARGET_COL]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    metrics = {}

    # ------------------------------------------------------------------ #
    # 1. Classification — compare all four Ch.2 candidate algorithms       #
    # ------------------------------------------------------------------ #

    # All four candidates named in Chapter 2
    candidates = {
        "Random Forest": RandomForestClassifier(
            n_estimators=300, max_depth=12, min_samples_leaf=3,
            class_weight="balanced", random_state=42, n_jobs=-1,
        ),
        "Decision Tree": DecisionTreeClassifier(
            max_depth=10, min_samples_leaf=3,
            class_weight="balanced", random_state=42,
        ),
        "Logistic Regression": LogisticRegression(
            max_iter=1000, class_weight="balanced", random_state=42,
        ),
        "SVM": SVC(
            kernel="rbf", probability=True,
            class_weight="balanced", random_state=42,
        ),
    }

    comparison = {}
    best_name = None
    best_auc = -1.0
    best_model = None

    print("=== Algorithm Comparison (Ch.2 requirement) ===")
    for name, model in candidates.items():
        model.fit(X_train_scaled, y_train)
        y_pred = model.predict(X_test_scaled)
        y_proba = model.predict_proba(X_test_scaled)[:, 1]
        auc = round(roc_auc_score(y_test, y_proba), 4)
        report = classification_report(y_test, y_pred, output_dict=True)
        summary = _summarise_report(report)
        summary["roc_auc"] = auc
        comparison[name] = summary

        print(f"\n  -- {name} --")
        print(f"     ROC-AUC : {auc}")
        print(f"     Accuracy: {summary['accuracy']}  "
              f"Precision: {summary['precision_weighted']}  "
              f"Recall: {summary['recall_weighted']}  "
              f"F1: {summary['f1_weighted']}")

        if auc > best_auc:
            best_auc = auc
            best_name = name
            best_model = model

    print(f"\n  [+] Best classifier: {best_name} (ROC-AUC = {best_auc})")
    comparison["selected"] = best_name

    # Full report + feature importances for the winner
    y_pred_best = best_model.predict(X_test_scaled)
    y_proba_best = best_model.predict_proba(X_test_scaled)[:, 1]
    feature_importances = {}
    if hasattr(best_model, "feature_importances_"):
        feature_importances = dict(zip(all_features, best_model.feature_importances_.round(4).tolist()))

    metrics["algorithm_comparison"] = comparison
    metrics["classification"] = {
        "algorithm": best_name,
        "roc_auc": best_auc,
        "report": classification_report(y_test, y_pred_best, output_dict=True),
        "feature_importances": feature_importances,
    }

    # ---- 2. Risk scoring (probability-based, 0-20 scale) ----
    risk_model = GradientBoostingClassifier(
        n_estimators=250, max_depth=4, learning_rate=0.05, random_state=42,
    )
    risk_model.fit(X_train_scaled, y_train)
    risk_proba = risk_model.predict_proba(X_test_scaled)[:, 1]
    metrics["risk_scoring"] = {
        "roc_auc": round(roc_auc_score(y_test, risk_proba), 4),
        "mean_risk_score_malpractice": round(float(risk_proba[y_test == 1].mean() * 20), 2),
        "mean_risk_score_clean": round(float(risk_proba[y_test == 0].mean() * 20), 2),
    }
    print("=== Risk Scoring ===", metrics["risk_scoring"])

    # ---- 3. Anomaly detection (unsupervised) ----
    anomaly_model = IsolationForest(
        n_estimators=300, contamination=0.15, random_state=42, n_jobs=-1,
    )
    anomaly_model.fit(X_train_scaled)
    anomaly_pred = anomaly_model.predict(X_test_scaled)  # -1 = anomaly, 1 = normal
    anomaly_flags = (anomaly_pred == -1).astype(int)

    # cross-check: how well do unsupervised anomalies line up with labels?
    overlap = (anomaly_flags == y_test.values).mean()
    metrics["anomaly_detection"] = {
        "flagged_rate": round(float(anomaly_flags.mean()), 4),
        "agreement_with_labels": round(float(overlap), 4),
    }
    print("=== Anomaly Detection ===", metrics["anomaly_detection"])

    # ---- Save everything ----
    joblib.dump(best_model, os.path.join(out_dir, "classifier.joblib"))
    joblib.dump(risk_model, os.path.join(out_dir, "risk_scorer.joblib"))
    joblib.dump(anomaly_model, os.path.join(out_dir, "anomaly_detector.joblib"))
    joblib.dump(scaler, os.path.join(out_dir, "feature_scaler.joblib"))
    joblib.dump(encoders, os.path.join(out_dir, "label_encoders.joblib"))

    with open(os.path.join(out_dir, "feature_columns.json"), "w") as f:
        json.dump(all_features, f, indent=2)

    with open(os.path.join(out_dir, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    print(f"\nSaved models + metrics to {out_dir}/")
    print(f"Selected classifier: {best_name} (ROC-AUC = {best_auc})")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="../data/nigeria_election_data.csv")
    parser.add_argument("--out", default="./models")
    args = parser.parse_args()
    main(args.data, args.out)
