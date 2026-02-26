import fs from "fs";
import path from "path";

/**
 * Valida que cada repo tenga branches embebidas y cada branch tenga status.
 * Lanza un error descriptivo en el límite del reporter — no usa ?. para silenciar.
 * El objetivo es que el error apunte al origen del dato corrupto, no al lugar
 * donde explota.
 *
 * @param {unknown[]} auditedRepos
 */
function assertAuditedRepos(auditedRepos) {
  if (!Array.isArray(auditedRepos) || auditedRepos.length === 0) {
    throw new Error("[ASSERT] auditedRepos must be a non-empty array");
  }

  for (const repo of auditedRepos) {
    if (!repo || typeof repo !== "object") {
      throw new Error(`[ASSERT] repo entry is ${repo} — expected object. Check that Promise.all returns AuditedRepo[], not void.`);
    }
    if (!Array.isArray(repo.branches)) {
      throw new Error(
        `[ASSERT] repo "${repo.repository}" has no branches array (got ${typeof repo.branches}). ` +
        `Likely cause: allAuditedRepos was built from allRepos (raw) instead of auditedActive (with branches).`
      );
    }
    for (const branch of repo.branches) {
      if (!branch || typeof branch.status === "undefined") {
        throw new Error(
          `[ASSERT] branch in "${repo.repository}" has no status field. ` +
          `Branch data: ${JSON.stringify(branch)}`
        );
      }
    }
  }
}

/**
 * Escribe el reporte completo como JSON jerárquico.
 * Cada repo es el aggregate root y contiene sus branches como hijos.
 *
 * @param {Array<import("../repos.js").RepoRecord & { branches: import("../branches.js").BranchRecord[] }>} auditedRepos
 * @param {string} outputDir
 */
export function writeJsonReport(auditedRepos, outputDir) {
  assertAuditedRepos(auditedRepos);

  const allBranches = auditedRepos.flatMap(r => r.branches);

  const payload = {
    generated_at: new Date().toISOString(),
    total_repos: auditedRepos.length,
    total_branches: allBranches.length,
    summary: {
      repos_active: auditedRepos.filter(r => r.status === "ACTIVE").length,
      repos_stale: auditedRepos.filter(r => r.status === "STALE").length,
      repos_abandoned: auditedRepos.filter(r => r.status === "ABANDONED").length,
      branches_active: allBranches.filter(b => b.status === "ACTIVE").length,
      branches_risk: allBranches.filter(b => b.status === "RISK").length,
      branches_inactive: allBranches.filter(b => b.status === "INACTIVE").length,
    },
    repos: auditedRepos,
  };

  const filePath = path.join(outputDir, "report.json");
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`[JSON] Report written → ${filePath}`);
}
