# Chapter Alignment — Fix Plan

This document lists every remaining gap between Chapter 2/3 of the thesis
and the current software build, with a proposed fix for each. Nothing
here has been implemented yet — this is a plan for the team to review,
correct, and prioritize. Once you confirm an approach (or send
corrections), implementation proceeds item by item, same as the earlier
rounds of changes.

Ordered roughly least-effort to highest-effort.

---

## 1. Automated model retraining loop
**Gap:** Ch.3 Activity Diagram (3.2.5): "looping back to retrain
whenever the evaluated accuracy falls below an acceptable threshold."
**Current state:** Retraining is a manual script (`train_models.py`)
run by hand — no automatic trigger, no threshold check.
**Proposed fix:** Add a lightweight check the Data Analyst (or a
scheduled job) can run: compare the latest model's stored accuracy
(`tbl_predictionmodel.accuracy`) against a configurable threshold
(e.g. 0.90 ROC-AUC); if below it, automatically re-run training against
the current database contents and register a new `tbl_predictionmodel`
row. Could be exposed as a `/api/model/retrain` endpoint (Data
Analyst-only, see item 3) rather than a background cron job, to keep
scope reasonable — full unattended scheduling is a heavier addition we'd
flag separately if you want it.
**Open question for the team:** does "automatic" need to mean
unattended/scheduled, or is an on-demand endpoint a Data Analyst
triggers sufficient? This changes the effort significantly.

---

## 2. Voter/Observer incident submission
**Gap:** Ch.3 Use Case Diagram (3.2.4): Voter/Election Observer is a
named actor whose use case is submitting incident reports into
`tbl_incidentrecord`. Currently our only incident-related input is a
single `incident_reported` yes/no checkbox buried inside the polling
unit scoring form — there's no dedicated incident-reporting workflow at
all.
**Proposed fix:**
- New endpoint `POST /api/incidents` accepting `puID` (or state/lga/ward
  to resolve one), `incidentType`, `severity`, `dateReported`
- New frontend page "Report an Incident" — a simple form any
  authenticated user can submit (matches the actor being any
  Voter/Observer, not just Administrators)
- New `GET /api/incidents` list view, filterable, likely surfaced on
  the Security Officer's view (see item 3)

---

## 3. Role-based access control
**Gap:** Ch.3 Use Case Diagram assigns distinct capabilities per actor
(Administrator manages election/polling-unit data; Analyst trains
models and views reports; Security Officer receives alerts and logs
field response). Currently all three roles have identical access to
every endpoint — the role is stored but never checked.
**Proposed fix:**
- Add a `require_role(*roles)` FastAPI dependency
- Restrict `/api/upload/csv` and `/api/predict*` to Administrator and
  Analyst (data entry / model-facing actions)
- Restrict `/api/model/retrain` (item 1) to Analyst
- Add a Security-Officer-facing "Alerts" view (item 4) — visible to
  Security Officer and Administrator, not required for Analyst
- Dashboard/records/export stay visible to all three, since Ch.3 has
  the Data Analyst "views the risk dashboard" and doesn't restrict
  viewing for the others either
**Open question for the team:** should Analyst be blocked from
uploading/predicting, or should that stay open to all authenticated
roles for simplicity? Ch.3's diagram gives Administrator the "manage
data" use case specifically, so a strict reading says yes, restrict it.

---

## 4. Alerting system for high-risk polling units
**Gap:** Ch.3 Activity Diagram (3.2.5) is explicit and specific: "Where
the risk level is high, the system sends an alert to the Security
Agency Officer, who deploys security resources... and submits field
response feedback." Nothing like this exists currently — a high-risk
prediction is only ever visible if someone happens to look at the
dashboard.
**Proposed fix:**
- New `tbl_alert` table: alertID, predictionID (FK), status (Open /
  Responding / Resolved), fieldResponseFeedback (text, filled in by the
  Security Officer), createdAt
- When `score_and_store()` produces a High risk level, automatically
  insert an alert row
- New endpoints: `GET /api/alerts` (list, Security Officer/Administrator
  only), `PATCH /api/alerts/{id}` (Security Officer submits field
  response feedback, updates status)
- New frontend "Alerts" page: a queue of open high-risk alerts, each
  with a field to log the response
**Open question for the team:** does "send an alert" need to leave the
app (email/SMS to a real security contact), or is an in-app alert queue
sufficient for demo/defense purposes? Building real email/SMS delivery
is a meaningfully larger addition (needs a provider like SendGrid/Twilio
and real contact data) — recommend starting with in-app only and noting
external delivery as future work, unless you specifically need it
working for the defense.

---

## 5. Algorithm comparison — Decision Tree, Logistic Regression, SVM
**Gap:** Ch.2 commits to evaluating **four** candidate algorithms
(Random Forest, Decision Tree, Logistic Regression, SVM) and selecting
the best by accuracy/precision/recall/F1. Only Random Forest has ever
been trained or compared — Decision Tree, Logistic Regression, and SVM
don't exist anywhere in the codebase.
**Proposed fix:**
- In `ml/train_models.py`, train all four classifiers on the same
  train/test split alongside Random Forest
- Compare accuracy, precision, recall, F1 for all four in a table saved
  to `metrics.json`
- Automatically select the best-performing one as the production
  classifier (replacing the hardcoded Random Forest choice) — or keep
  Random Forest if it wins, which is likely given the dataset's
  structure, but now with the comparison to back that choice up in the
  metrics
- Risk scoring (Gradient Boosting) and anomaly detection (Isolation
  Forest) stay as-is — Ch.2 doesn't name candidates for those, they're
  additions the three-model architecture required
**Effort note:** this is the most mechanical of the five changes (no
schema changes, no new UI), but touches the core ML pipeline, so it's
placed last to do carefully and re-verify all downstream metrics/UI
still reflect reality afterward.

---

## Suggested order of implementation
1. Algorithm comparison (#5) — self-contained, lowest risk to the rest of the system
2. Role-based access control (#3) — needed before alerts/incidents make sense as role-restricted views
3. Voter/Observer incident submission (#2)
4. Alerting system (#4) — depends on roles (#3) being in place
5. Automated retraining loop (#1) — most open-ended, tackle last once its scope is confirmed

## What we need from the team before starting
- Answers to the three "open question" call-outs above (#1, #3, #4)
- Confirmation this order works, or a different priority if your defense
  timeline needs a specific piece sooner (e.g. if alerts will be
  demonstrated live, move #4 up)
