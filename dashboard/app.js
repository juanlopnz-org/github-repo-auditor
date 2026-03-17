let GLOBAL_DATA = null;

let repos = [];
let filteredRepos = [];

let currentPage = 1;
let rowsPerPage = 10;

let selectedRepo = null;

let sortColumn = null;
let sortDirection = "asc";

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
    ABANDONED: "ABANDONADO",
    INACTIVE: "INACTIVO"
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
  let data = window.__AUDIT_DATA__;

  if (!data) {
    const res = await fetch("./report.json");
    data = await res.json();
  }

  GLOBAL_DATA = data;

  document.getElementById("totalRepos").textContent = data.total_repos;
  document.getElementById("totalBranches").textContent = data.total_branches;
  document.getElementById("generatedAt").textContent =
    new Date(data.generated_at).toLocaleString();

  buildSummary(data.summary);

  repos = data.repos;
  filteredRepos = [...repos];
  renderReposTable();
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

function selectRepo(repo) {

  if (selectedRepo && selectedRepo.repository === repo.repository) return;

  selectedRepo = repo;

  const existing = document.getElementById("branchesSection");
  if (existing) existing.remove();

  showBranches(repo);
}

function renderReposTable() {

  const tbody = document.querySelector("#reposTable tbody");
  tbody.innerHTML = "";

  const start = (currentPage - 1) * rowsPerPage;
  const end = start + rowsPerPage;

  const pageRepos = filteredRepos.slice(start, end);

  pageRepos.forEach((repo, index) => {

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
      <td class="repo-link" data-index="${start + index}" style="cursor:pointer; color:#60a5fa;">
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
      selectRepo(filteredRepos[index]);
    });
  });

  updatePagination();
}

function updatePagination() {

  const totalPages = Math.ceil(filteredRepos.length / rowsPerPage);

  let pagination = document.getElementById("pagination");

  if (!pagination) {

    pagination = document.createElement("div");
    pagination.id = "pagination";
    pagination.className = "pagination";

    document.querySelector(".repos").appendChild(pagination);

  }

  pagination.innerHTML = `
    <button onclick="prevPage()" ${currentPage === 1 ? "disabled" : ""}>Anterior</button>
    <span>Página ${currentPage} / ${totalPages} (${filteredRepos.length} repos)</span>
    <button onclick="nextPage()" ${currentPage === totalPages ? "disabled" : ""}>Siguiente</button>
  `;
}

function nextPage() {
  currentPage++;
  renderReposTable();
}

function prevPage() {
  currentPage--;
  renderReposTable();
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
      <td>${repoStatusBadge(branch.status)}</td>
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

function sortRepos(column) {

  if (sortColumn === column) {
    sortDirection = sortDirection === "asc" ? "desc" : "asc";
  } else {
    sortColumn = column;
    sortDirection = "asc";
  }

  filteredRepos.sort((a, b) => {

    let valA = a[column];
    let valB = b[column];

    if (typeof valA === "string") valA = valA.toLowerCase();
    if (typeof valB === "string") valB = valB.toLowerCase();

    if (valA < valB) return sortDirection === "asc" ? -1 : 1;
    if (valA > valB) return sortDirection === "asc" ? 1 : -1;

    return 0;

  });

  renderReposTable();

}

document.getElementById("searchInput").addEventListener("input", e => {

  const existing = document.getElementById("branchesSection");
  if (existing) existing.remove();

  const text = e.target.value.toLowerCase();

  filteredRepos = repos.filter(repo =>
    repo.repository.toLowerCase().includes(text)
  );

  currentPage = 1;

  renderReposTable();

});

loadReport();