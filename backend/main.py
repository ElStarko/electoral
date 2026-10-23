from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from auth import get_current_user
from database import init_db
from routers import auth as auth_router
from routers import export, predict, records, stats, upload

app = FastAPI(
    title="Intelligent Electoral Malpractice Prediction System (Nigeria)",
    description=(
        "API for scoring polling-unit election records for malpractice "
        "risk using classification, risk scoring, and anomaly detection models. "
        "Backed by MySQL, matching the ERD in Chapter 3 of the thesis."
    ),
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this to your frontend's origin in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    # Creates tables (tbl_users, tbl_election, etc.) if they don't exist yet.
    # The `electoral_malpractice_db` database itself must already exist in
    # MySQL - see README for the CREATE DATABASE step.
    init_db()


app.include_router(auth_router.router)
app.include_router(predict.router, dependencies=[Depends(get_current_user)])
app.include_router(records.router, dependencies=[Depends(get_current_user)])
app.include_router(export.router, dependencies=[Depends(get_current_user)])
app.include_router(stats.router, dependencies=[Depends(get_current_user)])
app.include_router(upload.router, dependencies=[Depends(get_current_user)])


@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "Electoral Malpractice Prediction API",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "healthy"}
