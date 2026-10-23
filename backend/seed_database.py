"""
seed_database.py

Loads data/nigeria_election_data.csv and pushes it through the running
API's batch prediction endpoint so every record gets scored AND stored
in MySQL in one step. Run this after starting the backend
(uvicorn main:app) and MySQL.

Since predict/batch now requires authentication, this script will
register (if needed) and log in as an Administrator account first.

Usage:
    python3 seed_database.py --csv ../data/nigeria_election_data.csv --api http://localhost:8000
"""

import argparse
import sys

import pandas as pd
import requests

SEED_USER = {
    "full_name": "Seed Script Administrator",
    "email": "seed-admin@electoral-watch.local",
    "password": "seed-admin-pass-123",
    "role": "Administrator",
}


def get_auth_token(api_url: str) -> str:
    # Try registering; if the account already exists, that's fine — just log in.
    requests.post(f"{api_url}/api/auth/register", json=SEED_USER, timeout=30)

    resp = requests.post(
        f"{api_url}/api/auth/login",
        json={"email": SEED_USER["email"], "password": SEED_USER["password"]},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def main(csv_path: str, api_url: str, batch_size: int = 500):
    token = get_auth_token(api_url)
    headers = {"Authorization": f"Bearer {token}"}

    df = pd.read_csv(csv_path)

    # keep only the columns the API schema expects
    keep_cols = [
        "state", "zone", "lga", "ward", "polling_unit",
        "registered_voters", "accredited_voters", "total_votes_cast",
        "valid_votes", "rejected_votes", "turnout_pct",
        "leading_party_vote_share", "benford_deviation_score",
        "over_voting_flag", "incident_reported",
        "literacy_rate", "unemployment_rate",
    ]
    df = df[[c for c in keep_cols if c in df.columns]]

    total_sent = 0
    total_malpractice = 0
    for start in range(0, len(df), batch_size):
        chunk = df.iloc[start:start + batch_size]
        records = chunk.to_dict(orient="records")
        resp = requests.post(
            f"{api_url}/api/predict/batch", json=records, headers=headers, timeout=120
        )
        if resp.status_code >= 400:
            print(resp.json())  # shows exactly which field/record failed
        resp.raise_for_status()
        data = resp.json()
        total_sent += data["count"]
        total_malpractice += sum(
            1 for r in data["results"] if r["prediction"]["malpractice_predicted"]
        )
        print(f"  Seeded {total_sent}/{len(df)} records...")

    print(f"\nDone. Seeded {total_sent} records, {total_malpractice} flagged as malpractice "
          f"({total_malpractice/total_sent*100:.1f}%).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", default="../data/nigeria_election_data.csv")
    parser.add_argument("--api", default="http://localhost:8000")
    parser.add_argument("--batch-size", type=int, default=500)
    args = parser.parse_args()
    try:
        main(args.csv, args.api, args.batch_size)
    except requests.exceptions.ConnectionError:
        print(f"Could not reach API at {args.api}. Is `uvicorn main:app` running?", file=sys.stderr)
        sys.exit(1)
