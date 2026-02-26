import fs from "fs";
import path from "path";

/**
 * Escribe el reporte completo como JSON jerárquico.
 * Cada repo es el aggregate root y contiene sus branches como hijos.
 *
 * @param {Array<import("../repos.js").RepoRecord & { branches: import("../branches.js").BranchRecord[] }>} auditedRepos
 * @param {string} outputDir
 */
export function writeJsonReport(auditedRepos, outputDir) {
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

