# Intelligent Electoral Malpractice Prediction System (Nigeria)

An end-to-end system that predicts electoral malpractice risk at the
polling-unit level: dataset → ML models (classification, risk scoring,
anomaly detection) → API → dashboard.

```
data/       synthetic-but-realistic dataset + generator
ml/         model training + shared prediction module
backend/    FastAPI service + MySQL storage (matches thesis Ch.3 ERD)
frontend/   React (Vite) dashboard
```

## 1. About the dataset

This sandbox environment cannot reach Kaggle, INEC's IReV portal, or
ACLED's API (outbound network here is restricted to package registries).
So `data/generate_dataset.py` builds a **polling-unit-level dataset that
mirrors the real structure and statistical patterns** of Nigerian
election data:

- A subset of 14 real states plus the FCT (a subset due to time constraints), covering all 6 real geopolitical zones
- Registered-voter counts and turnout drawn from ranges consistent with
  the 2023 general election (INEC: ~93.4M registered, ~26.7% national
  turnout, with real regional variance)
- Malpractice patterns injected at a base rate of about 15.5% of records, matching
  documented red flags used in election forensics: over-voting (votes >
  registered voters), abnormal turnout spikes or suppression, landslide
  vote concentration (>85% for one party), and Benford's Law digit
  deviation in reported vote counts

This is a **simulation for engineering and demonstration purposes** —
it is not a claim about any real polling unit, state, or party. Treat
it as a stand-in with the right shape so you can build, test, and
defend the full pipeline now, then swap in real data.

### Swapping in real data

When you're ready to use real data for your thesis, these are the
actual public sources:

| Source | What it has | How to get it |
|---|---|---|
| **INEC IReV** (`https://www.inecelectionresults.ng`) | Official polling-unit result sheets (scanned) | Manual bulk scrape/download, or via journalist-built mirrors (Stears, Dataphyte) |
| **Stears Elections** (`https://www.stears.co/elections`) | Cleaned, collated 2023 results by state/LGA | Web export |
| **Kaggle: "Nigeria Election Data"** (search on kaggle.com) | Pre-cleaned 2019/2023 presidential CSVs | Free download, Kaggle account required |
| **ACLED Nigeria Election Violence Tracker** (`acleddata.com`) | Georeferenced violence/incident events tied to elections | Free API key via registration |
| **CDD (Centre for Democracy and Development)** situation room reports | Qualitative incident reports per election | PDF reports on cddwestafrica.org |

Once downloaded, reshape the real data to match the column schema in
`data/nigeria_election_data.csv` (see the header row), then re-run:

```bash
cd ml
python3 train_models.py --data /path/to/real_data.csv --out ./models
```

The rest of the system (backend, frontend) needs no changes — it reads
whatever the trained models expect.

## 2. Setup

### Prerequisites
- Python 3.10+ (3.12 recommended - some packages lag behind the very latest Python release)
- Node.js 18+
- MySQL Server running locally (MySQL Community Server, or any MySQL-compatible server)

### Create the database
Before running the backend, create an empty database in MySQL. The app
creates all the tables itself on startup - you just need the database
to exist:
```sql
CREATE DATABASE electoral_malpractice_db;
```
(Run this in the MySQL command line client, MySQL Workbench, or any
SQL client connected to your MySQL server.)

### Generate the dataset (already done, but to regenerate)
```bash
cd data
python3 generate_dataset.py
```

### Train the models
```bash
cd ml
pip install -r ../backend/requirements.txt
python3 train_models.py --data ../data/nigeria_election_data.csv --out ./models
```
This prints classification/risk/anomaly metrics and saves model files
into `ml/models/`.

### Configure the database connection
Create `backend/.env` (or set these as environment variables):
```
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=electoral_malpractice_db
JWT_SECRET_KEY=change-this-to-something-random
```

### Run the backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
On first run, this creates all the tables (`tbl_users`, `tbl_election`,
`tbl_pollingunit`, etc.) inside `electoral_malpractice_db` automatically.
API docs: http://localhost:8000/docs

### Seed the database with the generated dataset (optional but recommended)
With the backend running in another terminal:
```bash
cd backend
python3 seed_database.py --csv ../data/nigeria_election_data.csv --api http://localhost:8000
```
This registers a seed Administrator account, logs in, then scores all
6,000 records and stores them, so the dashboard has data to show
immediately. You can also drag-and-drop a CSV straight
into the Records page in the frontend.

### Run the frontend
```bash
cd frontend
npm install
cp .env.example .env   # edit VITE_API_URL if your API isn't on localhost:8000
npm run dev
```
Dashboard: http://localhost:5173

## 3. Database schema

The MySQL schema implements the six entities from Chapter 3's ERD
(Figure 3.5) and Tables 3.1-3.6 exactly: `tbl_users`, `tbl_election`,
`tbl_pollingunit`, `tbl_incidentrecord`, `tbl_predictionmodel`,
`tbl_riskprediction`.

Two additions were necessary because the documented schema has nowhere
to store the actual vote/turnout data the ML model is trained on:

- **`tbl_states`** - referenced by `tbl_pollingunit.stateID` as a
  foreign key in Table 3.3, but never defined as its own table in
  Chapter 3. Added as the lookup table that foreign key implies.
- **`tbl_electionresult`** - not present anywhere in Figure 3.5 or
  Tables 3.1-3.6. Stores registered voters, votes cast, turnout %,
  vote share, and Benford deviation score per polling unit per
  election - the actual input features the classifier, risk scorer,
  and anomaly detector use. Without this table, there's no data for
  the model to be trained on or to score.

`tbl_riskprediction` was also extended with a few columns beyond the
two documented (`riskLevel`, `riskScore`): `malpracticePredicted`,
`malpracticeProbability`, `isAnomaly`, `anomalyScore`, `createdAt`, and
a `resultID` foreign key. This is because the system runs three models
(classification, risk scoring, anomaly detection), producing more
output than a two-field table anticipated. These extend Chapter 3's
design rather than contradict it - see `backend/models.py` for full
inline documentation of every addition.

If exact ERD conformance matters for your defense, consider adding a
short paragraph (or a Table 3.7) to Chapter 3 documenting
`tbl_electionresult` and the `tbl_riskprediction` extensions
retroactively - the additions were necessary for the system to
function, not arbitrary changes.

## 4. What each ML component does

| Component | Model | Question it answers |
|---|---|---|
| Classification | `RandomForestClassifier` | Is this record malpractice or clean (yes/no)? |
| Risk scoring | `GradientBoostingClassifier` probability, rescaled | What's the 0–20 risk score / risk level (Low: below 7, Medium: 7 to below 13, High: 13 and above) for this record or region? |
| Anomaly detection | `IsolationForest` (unsupervised) | Does this record look statistically unusual, independent of the labels the classifier was trained on? |

Metrics from the last training run are saved to `ml/models/metrics.json`.

## 5. API summary

- `POST /api/auth/register` — create an account (role: Administrator, Analyst, or Security Officer)
- `POST /api/auth/login` — returns a JWT bearer token
- `GET /api/auth/me` — current user's profile
- `POST /api/predict` — score one record, stores it (requires auth)
- `POST /api/predict/batch` — score a list of records (requires auth)
- `POST /api/upload/csv` — upload a CSV, scores + stores every row (requires auth)
- `GET /api/records` — list stored records (filter by state, zone, risk_level, malpractice_only) (requires auth)
- `GET /api/records/export/csv` / `/pdf` — download a filtered CSV or a formatted risk report PDF (requires auth)
- `GET /api/stats/overview` — headline totals (requires auth)
- `GET /api/stats/by-state` / `/api/stats/by-zone` — aggregated risk (requires auth)
- `POST /api/incidents` — submit an incident report (Voter / Observer use case, stored in `tbl_incidentrecord`)
- `GET /api/incidents` — list and filter field incident reports
- `GET /api/incidents/meta` — retrieve valid incident types and severities
- `GET /api/alerts` — queue of high-risk prediction alerts (Security Officer & Administrator)
- `PATCH /api/alerts/{id}` — log security field response feedback and update status (Ch.3 Activity Diagram)
- `GET /api/alerts/count` — badge count of open/responding/resolved alerts
- `GET /api/predict/metrics` — candidate algorithm comparison metrics (Random Forest, Decision Tree, Logistic Regression, SVM)
- `POST /api/predict/retrain` — automated model retraining loop with threshold evaluation (Analyst & Administrator)

Every endpoint except `/api/auth/*`, `/`, and `/health` requires an
`Authorization: Bearer <token>` header from a logged-in user.
