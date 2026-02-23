import { cookies } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDayKey(date) {
  return startOfDay(date).toISOString().slice(0, 10);
}

function parseDateInput(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toInputDate(date) {
  return toDayKey(date);
}

function clampRange(startDate, endDate, maxDays = 365) {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  if (end < start) return null;
  const days = Math.floor((end - start) / 86400000) + 1;
  if (days < 1 || days > maxDays) return null;
  return { start, end, days };
}

function buildLinePath(points) {
  if (!points.length) return "";
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

function createLinePoints(values, minValue, maxValue, left, top, width, height) {
  if (!values.length) return [];
  const range = Math.max(1, maxValue - minValue);
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  return values.map((value, index) => {
    const x = left + stepX * index;
    const normalized = (value - minValue) / range;
    const y = top + height - normalized * height;
    return { x, y, value };
  });
}

function buildRangeLabel(type, from, to) {
  if (type === "7d") return "Last 7 Days";
  if (type === "30d") return "Last 30 Days";
  const a = from.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
  const b = to.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
  return `${a} - ${b}`;
}

export default async function DashboardPage({ searchParams }) {
  noStore();
  const session = await requireSession();
  const query = (await searchParams) || {};
  const cookieStore = await cookies();
  const selectedProjectId = cookieStore.get("active_project_id")?.value;
  const projects = await prisma.project.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const activeProject = projects.find((project) => project.id === selectedProjectId) || projects[0] || null;

  const today = startOfDay(new Date());
  const rawRange = typeof query.range === "string" ? query.range : "30d";
  const rangeType = ["7d", "30d", "custom"].includes(rawRange) ? rawRange : "30d";
  const requestedFrom = typeof query.from === "string" ? query.from : "";
  const requestedTo = typeof query.to === "string" ? query.to : "";

  let startDate = new Date(today);
  startDate.setDate(today.getDate() - 29);
  let endDate = new Date(today);
  let appliedRangeType = rangeType;

  if (rangeType === "7d") {
    startDate = new Date(today);
    startDate.setDate(today.getDate() - 6);
  } else if (rangeType === "custom") {
    const fromDate = parseDateInput(requestedFrom);
    const toDate = parseDateInput(requestedTo);
    const clamped = fromDate && toDate ? clampRange(fromDate, toDate) : null;
    if (clamped) {
      startDate = clamped.start;
      endDate = clamped.end;
    } else {
      appliedRangeType = "30d";
    }
  }

  const finalRange = clampRange(startDate, endDate) || clampRange(today, today);
  const finalStart = finalRange.start;
  const finalEnd = finalRange.end;
  const finalDays = finalRange.days;
  const rangeLabel = buildRangeLabel(appliedRangeType, finalStart, finalEnd);

  const filteredTransactions = activeProject
    ? await prisma.transaction.findMany({
      where: {
        projectId: activeProject.id,
        createdAt: {
          gte: finalStart,
          lt: new Date(finalEnd.getTime() + 86400000),
        },
      },
      select: { createdAt: true, paidAt: true, status: true },
      orderBy: { createdAt: "asc" },
    })
    : [];

  const totalTransactions = filteredTransactions.length;
  const pendingCount = filteredTransactions.filter((tx) => tx.status === "pending").length;
  const paidCount = filteredTransactions.filter((tx) => tx.status === "paid").length;
  const failedCount = filteredTransactions.filter((tx) => tx.status === "failed").length;

  const dayLabels = [];
  const chartMap = new Map();
  for (let i = 0; i < finalDays; i += 1) {
    const date = new Date(finalStart);
    date.setDate(finalStart.getDate() + i);
    const key = toDayKey(date);
    dayLabels.push({
      key,
      label: date.toLocaleDateString("en-US", { day: "2-digit", month: "short" }),
    });
    chartMap.set(key, { total: 0, paid: 0 });
  }

  for (const tx of filteredTransactions) {
    const key = toDayKey(tx.createdAt);
    const row = chartMap.get(key);
    if (row) row.total += 1;

    if (tx.status === "paid") {
      const paidDate = tx.paidAt || tx.createdAt;
      const paidKey = toDayKey(paidDate);
      const paidRow = chartMap.get(paidKey);
      if (paidRow) paidRow.paid += 1;
    }
  }

  const chartData = dayLabels.map((day) => {
    const values = chartMap.get(day.key) || { total: 0, paid: 0 };
    return { ...day, ...values };
  });

  const yMax = Math.max(1, ...chartData.map((item) => Math.max(item.total, item.paid)));

  const chartWidth = 860;
  const chartHeight = 260;
  const padLeft = 40;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 36;
  const plotWidth = chartWidth - padLeft - padRight;
  const plotHeight = chartHeight - padTop - padBottom;
  const yTicks = 4;
  const xLabelStep = finalDays > 31 ? 7 : finalDays > 20 ? 4 : finalDays > 12 ? 2 : 1;

  const totalPoints = createLinePoints(
    chartData.map((item) => item.total),
    0,
    yMax,
    padLeft,
    padTop,
    plotWidth,
    plotHeight,
  );
  const paidPoints = createLinePoints(
    chartData.map((item) => item.paid),
    0,
    yMax,
    padLeft,
    padTop,
    plotWidth,
    plotHeight,
  );

  return (
    <div className="stack">
      <h1>Dashboard</h1>

      <section className="dashboard-analytics">
        <div className="card stack">
          <div className="dashboard-chart-top">
            <div>
              <strong>Transaction Statistics</strong>
              <div className="muted">Comparison of total and paid transaction count by date</div>
            </div>
            <details className="dashboard-filter-popover" open={false}>
              <summary>{rangeLabel}</summary>
              <div className="dashboard-filter-panel">
                <div className="dashboard-filter-presets">
                  <a href="/dashboard?range=7d">Last 7 Days</a>
                  <a href="/dashboard?range=30d">Last 30 Days</a>
                </div>
                <form method="get" action="/dashboard" className="dashboard-filter-custom">
                  <input type="hidden" name="range" value="custom" />
                  <label>
                    <span>From</span>
                    <input name="from" type="date" defaultValue={toInputDate(finalStart)} required />
                  </label>
                  <label>
                    <span>To</span>
                    <input name="to" type="date" defaultValue={toInputDate(finalEnd)} required />
                  </label>
                  <button type="submit">Apply</button>
                </form>
              </div>
            </details>
          </div>

          <div className="dashboard-line-chart-wrap">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="dashboard-line-chart"
              role="img"
              aria-label="Total and paid transactions line chart"
            >
              {Array.from({ length: yTicks + 1 }).map((_, index) => {
                const value = (yMax / yTicks) * index;
                const y = padTop + plotHeight - (plotHeight / yTicks) * index;
                return (
                  <g key={`grid-${index}`}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={padLeft + plotWidth}
                      y2={y}
                      className="dashboard-grid-line"
                    />
                    <text x={padLeft - 8} y={y + 4} textAnchor="end" className="dashboard-axis-text">
                      {Math.round(value)}
                    </text>
                  </g>
                );
              })}

              {buildLinePath(totalPoints) ? (
                <path d={buildLinePath(totalPoints)} className="dashboard-line-total" />
              ) : null}
              {buildLinePath(paidPoints) ? (
                <path d={buildLinePath(paidPoints)} className="dashboard-line-paid" />
              ) : null}

              {totalPoints.map((point, index) => (
                <circle key={`total-${index}`} cx={point.x} cy={point.y} r="3" className="dashboard-dot-total" />
              ))}
              {paidPoints.map((point, index) => (
                <circle key={`paid-${index}`} cx={point.x} cy={point.y} r="3" className="dashboard-dot-paid" />
              ))}

              {chartData.map((item, index) => {
                if (!totalPoints[index]) return null;
                if (index % xLabelStep !== 0 && index !== chartData.length - 1) return null;
                return (
                  <text
                    key={`x-${item.key}`}
                    x={totalPoints[index].x}
                    y={chartHeight - 10}
                    textAnchor="middle"
                    className="dashboard-axis-text"
                  >
                    {item.label}
                  </text>
                );
              })}
            </svg>
            <div className="dashboard-legend">
              <span>
                <i className="legend-dot legend-total" />
                Total Transactions
              </span>
              <span>
                <i className="legend-dot legend-paid" />
                Paid Transactions
              </span>
            </div>
          </div>
        </div>

        <div className="dashboard-stats-grid">
          <article className="card dashboard-stat-card">
            <div className="muted">Total Transactions</div>
            <strong>{totalTransactions}</strong>
          </article>
          <article className="card dashboard-stat-card">
            <div className="muted">Pending Transactions</div>
            <strong>{pendingCount}</strong>
          </article>
          <article className="card dashboard-stat-card">
            <div className="muted">Paid Transactions</div>
            <strong>{paidCount}</strong>
          </article>
          <article className="card dashboard-stat-card">
            <div className="muted">Failed Transactions</div>
            <strong>{failedCount}</strong>
          </article>
        </div>
      </section>

      <div className="dashboard-warning">
        * After a successful transaction, funds move to Pending Balance. While pending,
        funds cannot be withdrawn. After 24 hours, funds automatically move to Available Balance
        and can be withdrawn.
      </div>
    </div>
  );
}
