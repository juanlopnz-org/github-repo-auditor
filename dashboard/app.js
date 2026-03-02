let GLOBAL_DATA = null;

function translateSummaryKey(key) {
  const map = {
    repos_active: "Repositorios activos",
    repos_stale: "Repositorios desactualizados",
    repos_abandoned: "Repositorios abandonados",
    branches_active: "Ramas activas",
    branches_risk: "Ramas en riesgo",
    branches_inactive: "Ramas inactivas"
  };
  return map[key] || key;
}

function translateRepoStatus(status) {
  const map = {
    ACTIVE: "ACTIVO",
    STALE: "DESACTUALIZADO",
    ABANDONED: "ABANDONADO"
  };
  return map[status] || status;
}

function translateBranchComparison(compare) {
  const map = {
    equal: "SINCRONIZADA",
    behind: "ATRASADA",
    ahead: "ADELANTADA",
    diverged: "DIVERGENTE"
  };
  return map[compare] || compare;
}

function translateRiskLevel(risk) {
  const map = {
    HEALTHY: "SALUDABLE",
    OUTDATED: "DESACTUALIZADO",
    INTEGRATION_RISK: "RIESGO DE INTEGRACIÓN"
  };
  return map[risk] || risk;
}

async function loadReport() {
  const res = await fetch("./report.json");
  const data = await res.json();
  GLOBAL_DATA = data;

  // KPIs
  document.getElementById("totalRepos").textContent = data.total_repos;
  document.getElementById("totalBranches").textContent = data.total_branches;
  document.getElementById("generatedAt").textContent =
    new Date(data.generated_at).toLocaleString();

  buildSummary(data.summary);
  buildReposTable(data.repos);
}

function buildSummary(summary) {
  const container = document.getElementById("summaryCards");
  container.innerHTML = "";

  Object.entries(summary).forEach(([key, value]) => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <div class="title">${translateSummaryKey(key)}</div>
      <div class="value">${value}</div>
    `;
    container.appendChild(div);
  });
}

function repoStatusBadge(status) {
  const s = status.toUpperCase();
  const label = translateRepoStatus(s);

  if (s === "ACTIVE") return `<span class="badge ok">${label}</span>`;
  if (s === "STALE") return `<span class="badge warn">${label}</span>`;
  return `<span class="badge danger">${label}</span>`;
}

function branchCompareBadge(compare) {
  const label = translateBranchComparison(compare);

  if (compare === "equal") return `<span class="badge ok">${label}</span>`;
  if (compare === "behind") return `<span class="badge warn">${label}</span>`;
  if (compare === "ahead") return `<span class="badge warn">${label}</span>`;
  if (compare === "diverged") return `<span class="badge danger">${label}</span>`;
  return label;
}

function buildReposTable(repos) {
  const tbody = document.querySelector("#reposTable tbody");
  tbody.innerHTML = "";

  repos.forEach((repo, index) => {

    // calcular riesgo del repositorio
    let hasDiverged = false;
    let hasBehind = false;

    repo.branches.forEach(b => {
      if (b.compare_status === "diverged") hasDiverged = true;
      else if (b.compare_status === "behind") hasBehind = true;
    });

    let riskLevel = "HEALTHY";
    let rowClass = "";

    if (hasDiverged) {
      riskLevel = "INTEGRATION_RISK";
      rowClass = "row-danger";
    } else if (hasBehind) {
      riskLevel = "OUTDATED";
      rowClass = "row-warn";
    }

    const riskLabel = translateRiskLevel(riskLevel);

    let riskBadgeClass = "ok";
    if (riskLevel === "INTEGRATION_RISK") riskBadgeClass = "danger";
    else if (riskLevel === "OUTDATED") riskBadgeClass = "warn";

    const riskBadge = `<span class="badge ${riskBadgeClass}">${riskLabel}</span>`;

    const tr = document.createElement("tr");
    tr.className = rowClass;

    tr.innerHTML = `
      <td class="repo-link" data-index="${index}" style="cursor:pointer; color:#60a5fa;">
        ${repo.repository}
      </td>
      <td>${riskBadge}</td>
      <td>${repo.branches.length}</td>
      <td>${repo.inactive_days}</td>
      <td>${repo.default_branch}</td>
    `;

    tbody.appendChild(tr);
  });

  document.querySelectorAll(".repo-link").forEach(el => {
    el.addEventListener("click", e => {
      const index = e.target.dataset.index;
      showBranches(GLOBAL_DATA.repos[index]);
    });
  });
}

function showBranches(repo) {
  let existing = document.getElementById("branchesSection");
  if (existing) existing.remove();

  const section = document.createElement("section");
  section.id = "branchesSection";
  section.className = "branches";

  let html = `<h2>Ramas de ${repo.repository}</h2>
    <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th>Rama</th>
          <th>Estado</th>
          <th>Adelantados</th>
          <th>Atrasados</th>
          <th>Sincronización</th>
          <th>Autor</th>
        </tr>
      </thead>
      <tbody>`;

  repo.branches.forEach(branch => {
    html += `
    <tr>
      <td>${branch.branch}</td>
      <td>${translateRepoStatus(branch.status)}</td>
      <td>${branch.ahead_by}</td>
      <td>${branch.behind_by}</td>
      <td>${branchCompareBadge(branch.compare_status)}</td>
      <td>${branch.last_author ?? "-"}</td>
    </tr>`;
  });

  html += "</tbody></table></div>";
  section.innerHTML = html;

  document.querySelector(".container").appendChild(section);
}

// filtro
document.getElementById("searchInput").addEventListener("input", e => {
  const text = e.target.value.toLowerCase();
  document.querySelectorAll("#reposTable tbody tr").forEach(row => {
    row.style.display =
      row.children[0].textContent.toLowerCase().includes(text)
        ? ""
        : "none";
  });
});

loadReport();