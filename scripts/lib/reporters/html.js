import fs from "fs";
import path from "path";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns a colored badge HTML string based on the status value. */
function badge(status) {
  const map = {
    ACTIVE: "badge-active",
    STALE: "badge-stale",
    RISK: "badge-stale",
    ABANDONED: "badge-inactive",
    INACTIVE: "badge-inactive",
  };
  const cls = map[status] ?? "badge-unknown";
  return `<span class="badge ${cls}">${status ?? "—"}</span>`;
}

/** Formats a date string to a short local date, or "—" if null/undefined. */
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Returns a number or "—" for null/undefined. */
function fmtNum(n) {
  return n !== null && n !== undefined ? n : "—";
}

// ── Inline CSS ────────────────────────────────────────────────────────────────

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:          #0f1117;
    --surface:     #1a1d27;
    --surface2:    #22263a;
    --border:      #2e3250;
    --text:        #e2e8f0;
    --text-muted:  #8892a4;
    --accent:      #6366f1;
    --active:      #22c55e;
    --active-bg:   #14532d33;
    --stale:       #f59e0b;
    --stale-bg:    #78350f33;
    --inactive:    #ef4444;
    --inactive-bg: #7f1d1d33;
    --radius:      10px;
    --shadow:      0 4px 24px #0008;
    font-size: 15px;
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Segoe UI', system-ui, sans-serif;
    padding: 2rem 1.5rem;
    line-height: 1.5;
  }

  /* ── Header ── */
  header {
    margin-bottom: 2.5rem;
  }
  header h1 {
    font-size: 1.9rem;
    font-weight: 700;
    background: linear-gradient(135deg, #6366f1, #a78bfa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  header p {
    color: var(--text-muted);
    margin-top: .4rem;
    font-size: .9rem;
  }

  /* ── KPI cards ── */
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 1rem;
    margin-bottom: 2.5rem;
  }
  .kpi-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.2rem 1.4rem;
    box-shadow: var(--shadow);
    transition: transform .18s;
  }
  .kpi-card:hover { transform: translateY(-2px); }
  .kpi-card .label {
    font-size: .78rem;
    text-transform: uppercase;
    letter-spacing: .08em;
    color: var(--text-muted);
    margin-bottom: .4rem;
  }
  .kpi-card .value {
    font-size: 2rem;
    font-weight: 700;
  }
  .kpi-card.kpi-active  .value { color: var(--active); }
  .kpi-card.kpi-stale   .value { color: var(--stale); }
  .kpi-card.kpi-inactive .value { color: var(--inactive); }

  /* ── Section headings ── */
  .section-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }
  .section-header h2 {
    font-size: 1.2rem;
    font-weight: 600;
  }

  /* ── Filter ── */
  .filter-input {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    padding: .4rem .8rem;
    font-size: .88rem;
    outline: none;
    width: 240px;
    transition: border-color .15s;
  }
  .filter-input:focus { border-color: var(--accent); }

  /* ── Tables ── */
  .table-wrap {
    overflow-x: auto;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
    margin-bottom: 3rem;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    background: var(--surface);
    font-size: .875rem;
  }
  thead th {
    background: var(--surface2);
    color: var(--text-muted);
    font-size: .75rem;
    text-transform: uppercase;
    letter-spacing: .07em;
    padding: .75rem 1rem;
    text-align: left;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  tbody tr {
    border-bottom: 1px solid var(--border);
    transition: background .12s;
  }
  tbody tr:last-child { border-bottom: none; }
  tbody tr:hover { background: var(--surface2); }
  td {
    padding: .7rem 1rem;
    vertical-align: middle;
    white-space: nowrap;
    color: var(--text);
  }
  td.repo-name { font-weight: 600; color: var(--accent); }
  td.muted { color: var(--text-muted); }

  /* ── Badges ── */
  .badge {
    display: inline-block;
    padding: .2rem .6rem;
    border-radius: 20px;
    font-size: .72rem;
    font-weight: 700;
    letter-spacing: .05em;
    text-transform: uppercase;
  }
  .badge-active  { background: var(--active-bg);   color: var(--active); }
  .badge-stale   { background: var(--stale-bg);    color: var(--stale); }
  .badge-inactive{ background: var(--inactive-bg); color: var(--inactive); }
  .badge-unknown { background: #334155; color: #94a3b8; }

  /* ── Hidden rows (filter) ── */
  tr.hidden { display: none; }

  /* ── Footer ── */
  footer {
    text-align: center;
    color: var(--text-muted);
    font-size: .8rem;
    margin-top: 1rem;
  }
`;

// ── Inline JS ─────────────────────────────────────────────────────────────────

const JS = `
  function filterTable(inputId, tableId) {
    const input = document.getElementById(inputId);
    const table = document.getElementById(tableId);
    input.addEventListener('input', () => {
      const q = input.value.toLowerCase();
      table.querySelectorAll('tbody tr').forEach(row => {
        row.classList.toggle('hidden', !row.textContent.toLowerCase().includes(q));
      });
    });
  }
  filterTable('filter-repos', 'table-repos');
  filterTable('filter-branches', 'table-branches');
`;

// ── Section builders ──────────────────────────────────────────────────────────

function buildReposTable(repos) {
  const rows = repos.map(r => `
    <tr>
      <td class="repo-name">${r.repository}</td>
      <td class="muted">${r.visibility ?? "—"}</td>
      <td class="muted">${r.default_branch ?? "—"}</td>
      <td class="muted">${r.main_language ?? "—"}</td>
      <td class="muted">${fmtNum(r.size_kb)}</td>
      <td class="muted">${fmtNum(r.open_issues)}</td>
      <td class="muted">${fmtDate(r.last_code_push)}</td>
      <td class="muted">${fmtNum(r.inactive_days)}</td>
      <td>${badge(r.status)}</td>
    </tr>`).join("");

  return `
    <div class="section-header">
      <h2>📦 Repositories <span style="color:var(--text-muted);font-weight:400;font-size:.9rem">(${repos.length})</span></h2>
      <input id="filter-repos" class="filter-input" type="search" placeholder="Filter repositories…">
    </div>
    <div class="table-wrap">
      <table id="table-repos">
        <thead>
          <tr>
            <th>Repository</th>
            <th>Visibility</th>
            <th>Default Branch</th>
            <th>Language</th>
            <th>Size (KB)</th>
            <th>Open Issues</th>
            <th>Last Push</th>
            <th>Inactive Days</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function buildBranchesTable(auditedRepos) {
  const rows = auditedRepos.flatMap(r =>
    r.branches.map(b => `
      <tr>
        <td class="repo-name">${r.repository}</td>
        <td class="muted">${b.branch}</td>
        <td class="muted">${fmtDate(b.last_commit)}</td>
        <td class="muted">${b.last_author ?? "—"}</td>
        <td class="muted">${fmtNum(b.inactive_days)}</td>
        <td>${badge(b.status)}</td>
        <td class="muted">${fmtNum(b.ahead_by)}</td>
        <td class="muted">${fmtNum(b.behind_by)}</td>
        <td class="muted">${b.compare_status ?? "—"}</td>
      </tr>`)
  ).join("");

  const totalBranches = auditedRepos.reduce((n, r) => n + r.branches.length, 0);

  return `
    <div class="section-header">
      <h2>🌿 Branches <span style="color:var(--text-muted);font-weight:400;font-size:.9rem">(${totalBranches})</span></h2>
      <input id="filter-branches" class="filter-input" type="search" placeholder="Filter branches…">
    </div>
    <div class="table-wrap">
      <table id="table-branches">
        <thead>
          <tr>
            <th>Repository</th>
            <th>Branch</th>
            <th>Last Commit</th>
            <th>Last Author</th>
            <th>Inactive Days</th>
            <th>Status</th>
            <th>Ahead By</th>
            <th>Behind By</th>
            <th>Compare Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function buildKpiCards(summary) {
  const cards = [
    { label: "Repos Active", value: summary.repos_active, cls: "kpi-active" },
    { label: "Repos Stale", value: summary.repos_stale, cls: "kpi-stale" },
    { label: "Repos Abandoned", value: summary.repos_abandoned, cls: "kpi-inactive" },
    { label: "Branches Active", value: summary.branches_active, cls: "kpi-active" },
    { label: "Branches at Risk", value: summary.branches_risk, cls: "kpi-stale" },
    { label: "Branches Inactive", value: summary.branches_inactive, cls: "kpi-inactive" },
  ];
  return `<div class="kpi-grid">${cards.map(c => `
    <div class="kpi-card ${c.cls}">
      <div class="label">${c.label}</div>
      <div class="value">${c.value}</div>
    </div>`).join("")}
  </div>`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Writes a fully self-contained HTML report to `<outputDir>/report.html`.
 *
 * @param {Array<import("../repos.js").RepoRecord & { branches: import("../branches.js").BranchRecord[] }>} auditedRepos
 * @param {string} outputDir
 */
export function writeHtmlReport(auditedRepos, outputDir) {
  if (!Array.isArray(auditedRepos) || auditedRepos.length === 0) {
    throw new Error("[HTML] auditedRepos must be a non-empty array");
  }

  const allBranches = auditedRepos.flatMap(r => r.branches);
  const generatedAt = new Date().toISOString();
  const org = process.env.ORG ?? "Unknown Org";

  const summary = {
    repos_active: auditedRepos.filter(r => r.status === "ACTIVE").length,
    repos_stale: auditedRepos.filter(r => r.status === "STALE").length,
    repos_abandoned: auditedRepos.filter(r => r.status === "ABANDONED").length,
    branches_active: allBranches.filter(b => b.status === "ACTIVE").length,
    branches_risk: allBranches.filter(b => b.status === "RISK").length,
    branches_inactive: allBranches.filter(b => b.status === "INACTIVE").length,
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GitHub Audit Report — ${org}</title>
  <meta name="description" content="GitHub organization repository and branch audit report for ${org}, generated on ${generatedAt}.">
  <style>${CSS}</style>
</head>
<body>
  <header>
    <h1>GitHub Audit Report — ${org}</h1>
    <p>Generated: ${new Date(generatedAt).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })} &nbsp;·&nbsp; ${auditedRepos.length} repositories &nbsp;·&nbsp; ${allBranches.length} branches</p>
  </header>

  ${buildKpiCards(summary)}
  ${buildReposTable(auditedRepos)}
  ${buildBranchesTable(auditedRepos)}

  <footer>
    <p>github-repo-auditor &nbsp;·&nbsp; <a href="https://github.com/${org}" style="color:var(--accent)">github.com/${org}</a></p>
  </footer>

  <script>${JS}</script>
</body>
</html>`;

  const filePath = path.join(outputDir, "report.html");
  fs.writeFileSync(filePath, html, "utf-8");
  console.log(`[HTML] Report written → ${filePath}`);
}
