// ── Anonymous auth so the site can write to /control (see database.rules.json) ──
firebase.auth().signInAnonymously().catch((err) => {
  console.error("Anonymous sign-in failed:", err);
});

// ── Connection indicator ─────────────────────────────────────────────────
const connDot  = document.getElementById("connDot");
const connText = document.getElementById("connText");
db.ref(".info/connected").on("value", (snap) => {
  const connected = snap.val() === true;
  connDot.classList.toggle("live", connected);
  connDot.classList.toggle("stale", !connected);
  connText.textContent = connected ? "Live" : "Reconnecting…";
});

// ── Live readout ──────────────────────────────────────────────────────────
const pctNum       = document.getElementById("pctNum");
const voltVal      = document.getElementById("voltVal");
const chargeState  = document.getElementById("chargeState");
const cutoffState  = document.getElementById("cutoffState");
const lastUpdate   = document.getElementById("lastUpdate");
const overrideTag  = document.getElementById("overrideTag");
const cellSegments = document.getElementById("cellSegments");

const btnAuto = document.getElementById("btnAuto");
const btnOn   = document.getElementById("btnOn");
const btnOff  = document.getElementById("btnOff");

function cellColor(pct) {
  if (pct < 20) return "var(--coral)";
  if (pct < 50) return "var(--amber)";
  return "var(--teal)";
}

function renderCell(pct) {
  cellSegments.innerHTML = "";
  const x = 14, y = 14, w = 178, h = 92;
  const fillW = Math.max(0, Math.min(100, pct)) / 100 * w;
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", x);
  rect.setAttribute("y", y);
  rect.setAttribute("width", fillW);
  rect.setAttribute("height", h);
  rect.setAttribute("rx", 6);
  rect.setAttribute("class", "cell-seg");
  rect.setAttribute("fill", cellColor(pct));
  cellSegments.appendChild(rect);
}

let currentManualOverride = false;
let currentChargeRelay = false;

function updateControlButtons() {
  btnAuto.classList.toggle("active", !currentManualOverride);
  btnOn.classList.toggle("active", currentManualOverride && currentChargeRelay);
  btnOff.classList.toggle("active", currentManualOverride && !currentChargeRelay);
}

db.ref("live").on("value", (snap) => {
  const d = snap.val();
  if (!d) return;

  const pct = Math.round(d.percent ?? 0);
  pctNum.textContent = pct;
  renderCell(pct);

  voltVal.textContent = (d.voltage ?? 0).toFixed(2) + " V";
  chargeState.textContent = d.chargeRelay ? "Charging" : "Idle";
  cutoffState.textContent = d.cutoff ? "Load disconnected" : "Load connected";

  currentManualOverride = !!d.manualOverride;
  currentChargeRelay = !!d.chargeRelay;
  overrideTag.textContent = currentManualOverride ? "Manual" : "Auto";
  updateControlButtons();

  if (d.lastUpdate) {
    const dt = new Date(d.lastUpdate * 1000);
    lastUpdate.textContent = dt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  }
});

// ── Charging control buttons ─────────────────────────────────────────────
[btnAuto, btnOn, btnOff].forEach((btn) => {
  btn.addEventListener("click", () => {
    const cmd = parseInt(btn.dataset.cmd, 10);
    db.ref("control/chargeCmd").set(cmd).catch((err) => {
      console.error("Failed to send command:", err);
      alert("Couldn't send command — check your connection and try again.");
    });
  });
});

// ── Date helpers ──────────────────────────────────────────────────────────
function fmtDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function parseHistoryKey(dateKey, timeKey) {
  const y = +dateKey.slice(0, 4), mo = +dateKey.slice(4, 6), da = +dateKey.slice(6, 8);
  const h = +timeKey.slice(0, 2), mi = +timeKey.slice(2, 4), s = +timeKey.slice(4, 6);
  return new Date(y, mo - 1, da, h, mi, s);
}

function dateKeysCoveringRange(msBack) {
  const keys = [];
  const end = new Date();
  const start = new Date(end.getTime() - msBack);
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    keys.push(fmtDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

// ── Voltage history chart ────────────────────────────────────────────────
const historyCtx = document.getElementById("historyChart").getContext("2d");
let historyChart = new Chart(historyCtx, {
  type: "line",
  data: { datasets: [{
    label: "Voltage",
    data: [],
    borderColor: "#EFA23B",
    backgroundColor: "rgba(239,162,59,0.12)",
    borderWidth: 2,
    pointRadius: 0,
    tension: 0.25,
    fill: true,
  }]},
  options: {
    responsive: true,
    animation: false,
    scales: {
      x: { type: "time", time: { unit: "hour" }, grid: { color: "#2B3339" }, ticks: { color: "#8E9AA0" } },
      y: { grid: { color: "#2B3339" }, ticks: { color: "#8E9AA0" } },
    },
    plugins: { legend: { display: false } },
  },
});

async function loadHistory(hours) {
  const msBack = hours * 3600000;
  const cutoff = Date.now() - msBack;
  const keys = dateKeysCoveringRange(msBack);
  const points = [];

  for (const dateKey of keys) {
    const snap = await db.ref(`history/${dateKey}`).once("value");
    const day = snap.val();
    if (!day) continue;
    for (const [timeKey, val] of Object.entries(day)) {
      const t = parseHistoryKey(dateKey, timeKey).getTime();
      if (t >= cutoff) points.push({ x: t, y: val.v });
    }
  }

  points.sort((a, b) => a.x - b.x);
  historyChart.data.datasets[0].data = points;
  historyChart.options.scales.x.time.unit = hours <= 6 ? "hour" : hours <= 24 ? "hour" : "day";
  historyChart.update();
}

document.getElementById("rangeSelect").addEventListener("click", (e) => {
  const btn = e.target.closest(".range-btn");
  if (!btn) return;
  document.querySelectorAll("#rangeSelect .range-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  loadHistory(+btn.dataset.hours);
});

// ── Load-shedding chart ──────────────────────────────────────────────────
const lsCtx = document.getElementById("loadshedChart").getContext("2d");
let lsChart = new Chart(lsCtx, {
  type: "bar",
  data: { labels: [], datasets: [{
    label: "Outage minutes",
    data: [],
    backgroundColor: "#DB6B4E",
    borderRadius: 4,
  }]},
  options: {
    responsive: true,
    animation: false,
    scales: {
      x: { grid: { display: false }, ticks: { color: "#8E9AA0" } },
      y: { grid: { color: "#2B3339" }, ticks: { color: "#8E9AA0" } },
    },
    plugins: { legend: { display: false } },
  },
});

const lsTotalLabel = document.getElementById("lsTotalLabel");
const lsTotalVal = document.getElementById("lsTotalVal");
const lsEmpty = document.getElementById("lsEmpty");

function fmtHoursMinutes(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return `${h} h ${m} m`;
}

async function loadLoadshed(range) {
  let days, label;
  if (range === "today") { days = 1; label = "Total today"; }
  else { days = +range; label = `Total (${range}d)`; }

  const msBack = days * 86400000;
  const keys = dateKeysCoveringRange(msBack);
  const now = Date.now();
  const perDayMinutes = {};
  keys.forEach((k) => (perDayMinutes[k] = 0));
  let totalMinutes = 0;

  for (const dateKey of keys) {
    const snap = await db.ref(`loadshed/events/${dateKey}`).once("value");
    const day = snap.val();
    if (!day) continue;
    for (const ev of Object.values(day)) {
      if (!ev.start) continue;
      const startMs = ev.start * 1000;
      const endMs = ev.end ? ev.end * 1000 : now; // still ongoing
      const minutes = Math.max(0, (endMs - startMs) / 60000);
      perDayMinutes[dateKey] = (perDayMinutes[dateKey] || 0) + minutes;
      totalMinutes += minutes;
    }
  }

  lsTotalLabel.textContent = label;
  lsTotalVal.textContent = fmtHoursMinutes(totalMinutes);

  const labels = keys.map((k) => `${k.slice(4,6)}/${k.slice(6,8)}`);
  const data = keys.map((k) => Math.round(perDayMinutes[k]));
  lsChart.data.labels = labels;
  lsChart.data.datasets[0].data = data;
  lsChart.update();

  const hasData = totalMinutes > 0;
  lsEmpty.hidden = hasData;
  document.getElementById("loadshedChart").style.display = hasData ? "block" : "none";
}

document.getElementById("lsRangeSelect").addEventListener("click", (e) => {
  const btn = e.target.closest(".range-btn");
  if (!btn) return;
  document.querySelectorAll("#lsRangeSelect .range-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  loadLoadshed(btn.dataset.range);
});

// ── Initial load ──────────────────────────────────────────────────────────
loadHistory(6);
loadLoadshed("today");
