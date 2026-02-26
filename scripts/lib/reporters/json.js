import fs from "fs";
import path from "path";

/**
 * Escribe el reporte completo como JSON.
 *
 * @param {Object} report
 * @param {import("../repos.js").RepoRecord[]} report.repos
 * @param {import("../branches.js").BranchRecord[]} report.branches
 * @param {string} outputDir
 */
export function writeJsonReport({ repos, branches }, outputDir) {
  const payload = {
    generated_at: new Date().toISOString(),
    total_repos: repos.length,
    total_branches: branches.length,
    repos,
    branches,
  };

  const filePath = path.join(outputDir, "report.json");
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`[JSON] Report written → ${filePath}`);
}
