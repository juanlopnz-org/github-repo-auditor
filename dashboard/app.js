let GLOBAL_DATA = null;

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
      <div class="title">${key.replaceAll("_", " ")}</div>
      <div class="value">${value}</div>
    `;
    container.appendChild(div);
  });
}

function repoStatusBadge(status) {
  const s = status.toUpperCase();
  if (s === "ACTIVE") return '<span class="badge ok">ACTIVE</span>';
  if (s === "STALE") return '<span class="badge warn">STALE</span>';
  return '<span class="badge danger">ABANDONED</span>';
}

function branchCompareBadge(compare) {
  if (compare === "equal") return '<span class="badge ok">SYNC</span>';
  if (compare === "behind") return '<span class="badge warn">BEHIND</span>';
  if (compare === "ahead") return '<span class="badge warn">AHEAD</span>';
  if (compare === "diverged") return '<span class="badge danger">DIVERGED</span>';
  return compare;
}

function buildReposTable(repos) {
  const tbody = document.querySelector("#reposTable tbody");
  tbody.innerHTML = "";

  repos.forEach((repo, index) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td class="repo-link" data-index="${index}" style="cursor:pointer; color:#60a5fa;">
        ${repo.repository}
      </td>
      <td>${repoStatusBadge(repo.status)}</td>
      <td>${repo.branches.length}</td>
      <td>${repo.inactive_days}</td>
      <td>${repo.default_branch}</td>
    `;

    tbody.appendChild(tr);
  });

  // click handler
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
      <th>Branch</th>
      <th>Estado</th>
      <th>Ahead</th>
      <th>Behind</th>
      <th>Comparación</th>
      <th>Autor</th>
    </tr>
  </thead>
  <tbody>`;

  repo.branches.forEach(branch => {
    html += `
    <tr>
      <td>${branch.branch}</td>
      <td>${branch.status}</td>
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