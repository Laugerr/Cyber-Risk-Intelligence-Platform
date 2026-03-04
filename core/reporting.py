from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Optional

import pandas as pd

from core.storage import list_assets, list_alerts, list_controls
from core.rosi import estimate_ale, calculate_rosi


def generate_exec_html_report(selected_control_id: Optional[int] = None) -> Path:
    assets = list_assets()
    alerts = list_alerts(limit=2000)
    controls = list_controls()

    df_alerts = pd.DataFrame([a.model_dump() for a in alerts]) if alerts else pd.DataFrame()
    total_risk = float(df_alerts["risk_score"].sum()) if not df_alerts.empty else 0.0
    ale = estimate_ale(total_risk)

    # Pick control
    control = None
    if controls:
        if selected_control_id is not None:
            control = next((c for c in controls if c.id == selected_control_id), None)
        if control is None:
            control = controls[0]

    risk_reduction_value = 0.0
    rosi = 0.0
    if control:
        risk_reduction_value, rosi = calculate_rosi(
            ale_before=ale,
            control_cost=control.annual_cost_eur,
            effectiveness_pct=control.effectiveness_pct,
        )

    # Severity summary
    sev_table_html = "<p>No alerts available.</p>"
    if not df_alerts.empty:
        sev_order = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
        sev_counts = df_alerts["severity"].value_counts().reindex(sev_order).fillna(0).astype(int)
        sev_df = sev_counts.reset_index()
        sev_df.columns = ["Severity", "Count"]
        sev_table_html = sev_df.to_html(index=False)

    # Top 10 risks
    top_alerts_html = "<p>No alerts available.</p>"
    if not df_alerts.empty:
        df_top = df_alerts.sort_values(by="risk_score", ascending=False).head(10)
        top_alerts_html = df_top[["severity", "risk_score", "title", "cve", "created_at"]].to_html(index=False)

    # Recommendation
    if control:
        control_block = f"""
        <ul>
          <li><b>Control:</b> {control.name}</li>
          <li><b>Annual Cost:</b> €{control.annual_cost_eur:,.2f}</li>
          <li><b>Effectiveness:</b> {control.effectiveness_pct}%</li>
          <li><b>Estimated Risk Reduction Value:</b> €{risk_reduction_value:,.2f}</li>
          <li><b>ROSI:</b> {rosi}</li>
        </ul>
        """
        decision = (
            f"<p style='color:green;'><b>Recommendation:</b> APPROVE — projected savings exceed cost (ROSI={rosi}).</p>"
            if rosi > 0
            else f"<p style='color:#b00020;'><b>Recommendation:</b> REVIEW — ROSI is negative (ROSI={rosi}).</p>"
        )
    else:
        control_block = "<p>No control selected.</p>"
        decision = "<p><b>Recommendation:</b> N/A</p>"

    stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    out_dir = Path("exports") / "reports"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"exec_report_{stamp}.html"

    html = f"""
    <html>
    <head>
      <meta charset="utf-8"/>
      <title>CRISP Executive Risk Report</title>
      <style>
        body {{ font-family: Arial, sans-serif; margin: 30px; }}
        .kpi {{ display:flex; gap:20px; margin: 15px 0; flex-wrap: wrap; }}
        .card {{ border:1px solid #ddd; border-radius:10px; padding:15px; min-width: 220px; }}
        h1 {{ margin-bottom: 0; }}
        .muted {{ color: #666; }}
        table {{ border-collapse: collapse; width: 100%; }}
        th, td {{ border: 1px solid #ddd; padding: 8px; }}
        th {{ background: #f5f5f5; }}
      </style>
    </head>
    <body>
      <h1>🛡️ CRISP Executive Risk Report</h1>
      <p class="muted">Generated: {datetime.utcnow().isoformat()} UTC</p>

      <div class="kpi">
        <div class="card"><b>Assets</b><br/>{len(assets)}</div>
        <div class="card"><b>Alerts</b><br/>{len(alerts)}</div>
        <div class="card"><b>Total Risk Score</b><br/>{total_risk:.2f}</div>
        <div class="card"><b>Estimated ALE (€)</b><br/>{ale:,.2f}</div>
      </div>

      <h2>Severity Summary</h2>
      {sev_table_html}

      <h2>Security Control Investment (ROSI)</h2>
      {control_block}
      {decision}

      <h2>Top Risks (Top 10 Alerts)</h2>
      {top_alerts_html}

      <h2>Notes</h2>
      <ul>
        <li>This is a simulated enterprise model for demo/portfolio use.</li>
        <li>Financial model can be calibrated to your target industry.</li>
      </ul>
    </body>
    </html>
    """

    out_path.write_text(html, encoding="utf-8")
    return out_path