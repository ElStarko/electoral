import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const barColor = (v) => {
  if (v >= 13) return "#9E2B25";
  if (v >= 7) return "#C97B2E";
  return "#1F7A5C";
};

export default function ZoneChart({ zones }) {
  const data = [...(zones || [])].sort((a, b) => b.avg_risk_score - a.avg_risk_score);

  if (data.length === 0) {
    return (
      <div style={{ opacity: 0.6, fontSize: "0.9rem" }}>No data to chart yet.</div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
        <XAxis
          dataKey="zone"
          tick={{ fontSize: 11, fontFamily: "IBM Plex Sans" }}
          angle={-15}
          textAnchor="end"
          height={50}
        />
        <YAxis tick={{ fontSize: 11 }} label={{ value: "Avg risk score", angle: -90, position: "insideLeft", fontSize: 11 }} />
        <Tooltip
          formatter={(value, name) => [value, name === "avg_risk_score" ? "Avg risk score" : name]}
          contentStyle={{ fontFamily: "IBM Plex Sans", fontSize: "0.85rem", border: "1px solid var(--line-strong)" }}
        />
        <Bar dataKey="avg_risk_score" radius={[3, 3, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={barColor(entry.avg_risk_score)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
