import io
from datetime import datetime, timezone
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db_session
from models import ElectionResult, PollingUnit, RiskPrediction, State

router = APIRouter(prefix="/api/records/export", tags=["export"])


def _apply_filters(query, state, zone, risk_level, malpractice_only):
    if state:
        query = query.filter(State.stateName == state)
    if zone:
        query = query.filter(State.zone == zone)
    if risk_level:
        query = query.filter(RiskPrediction.riskLevel == risk_level)
    if malpractice_only:
        query = query.filter(RiskPrediction.malpracticePredicted == True)  # noqa: E712
    return query


@router.get("/csv")
def export_csv(
    state: Optional[str] = None,
    zone: Optional[str] = None,
    risk_level: Optional[str] = None,
    malpractice_only: bool = False,
    limit: int = Query(10000, le=20000),
    db: Session = Depends(get_db_session),
):
    query = (
        db.query(RiskPrediction, PollingUnit, State, ElectionResult)
        .join(PollingUnit, RiskPrediction.puID == PollingUnit.puID)
        .join(State, PollingUnit.stateID == State.stateID)
        .outerjoin(ElectionResult, RiskPrediction.resultID == ElectionResult.resultID)
    )
    query = _apply_filters(query, state, zone, risk_level, malpractice_only)
    rows = query.order_by(RiskPrediction.createdAt.desc()).limit(limit).all()

    data = []
    for rp, pu, st, er in rows:
        data.append({
            "state": st.stateName, "zone": st.zone, "lga": pu.lga, "ward": pu.ward,
            "polling_unit": pu.pollingUnitCode,
            "registered_voters": er.registeredVoters if er else None,
            "total_votes_cast": er.totalVotesCast if er else None,
            "turnout_pct": er.turnoutPct if er else None,
            "risk_score": rp.riskScore, "risk_level": rp.riskLevel,
            "malpractice_predicted": rp.malpracticePredicted, "is_anomaly": rp.isAnomaly,
        })

    df = pd.DataFrame(data)
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    buf.seek(0)

    filename = f"malpractice_risk_report_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/pdf")
def export_pdf(
    state: Optional[str] = None,
    zone: Optional[str] = None,
    risk_level: Optional[str] = None,
    malpractice_only: bool = False,
    top_n: int = Query(50, le=500, description="Number of highest-risk records to list"),
    db: Session = Depends(get_db_session),
):
    base_query = (
        db.query(RiskPrediction, PollingUnit, State)
        .join(PollingUnit, RiskPrediction.puID == PollingUnit.puID)
        .join(State, PollingUnit.stateID == State.stateID)
    )
    base_query = _apply_filters(base_query, state, zone, risk_level, malpractice_only)

    total = base_query.count()
    malpractice_count = base_query.filter(RiskPrediction.malpracticePredicted == True).count()  # noqa: E712

    zone_query = (
        db.query(
            State.zone,
            func.count(RiskPrediction.predictionID).label("total"),
            func.avg(RiskPrediction.riskScore).label("avg_risk"),
            func.sum(RiskPrediction.malpracticePredicted).label("malpractice_count"),
        )
        .join(PollingUnit, RiskPrediction.puID == PollingUnit.puID)
        .join(State, PollingUnit.stateID == State.stateID)
    )
    zone_query = _apply_filters(zone_query, state, zone, risk_level, malpractice_only)
    zone_rows = zone_query.group_by(State.zone).order_by(func.avg(RiskPrediction.riskScore).desc()).all()

    top_rows = base_query.order_by(RiskPrediction.riskScore.desc()).limit(top_n).all()

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=1.5 * cm, bottomMargin=1.5 * cm)
    styles = getSampleStyleSheet()
    elements = []

    elements.append(Paragraph("Electoral Malpractice Risk Report", styles["Title"]))
    elements.append(Paragraph(
        f"Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        styles["Normal"],
    ))
    elements.append(Spacer(1, 0.5 * cm))

    elements.append(Paragraph(
        f"Total records: {total} &nbsp;&nbsp; Malpractice-flagged: {malpractice_count} "
        f"({malpractice_count / total * 100:.1f}%)" if total else "No records found.",
        styles["Normal"],
    ))
    elements.append(Spacer(1, 0.5 * cm))

    elements.append(Paragraph("Risk by Geopolitical Zone", styles["Heading2"]))
    zone_table_data = [["Zone", "Records", "Avg Risk (0-20)", "Malpractice %"]]
    for z in zone_rows:
        malpractice_count_z = int(z.malpractice_count or 0)
        pct = malpractice_count_z / z.total * 100 if z.total else 0
        zone_table_data.append([
            z.zone, str(z.total), f"{z.avg_risk:.1f}" if z.avg_risk else "0.0", f"{pct:.1f}%"
        ])
    zone_table = Table(zone_table_data, hAlign="LEFT")
    zone_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0B3D2E")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7F5EF")]),
    ]))
    elements.append(zone_table)
    elements.append(Spacer(1, 0.7 * cm))

    elements.append(Paragraph(f"Top {len(top_rows)} Highest-Risk Polling Units", styles["Heading2"]))
    top_table_data = [["State", "Zone", "Polling Unit", "Risk Score", "Risk Level"]]
    for rp, pu, st in top_rows:
        top_table_data.append([
            st.stateName, st.zone, str(pu.pollingUnitCode or "") or "-",
            f"{rp.riskScore:.1f}", rp.riskLevel,
        ])
    top_table = Table(top_table_data, hAlign="LEFT")
    top_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0B3D2E")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7F5EF")]),
    ]))
    elements.append(top_table)

    doc.build(elements)
    buf.seek(0)

    filename = f"malpractice_risk_report_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
