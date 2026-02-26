import { stringify } from "csv-stringify/sync";
import fs from "fs";
import path from "path";

const REPOS_COLUMNS = {
  repository: "Repository",
  visibility: "Visibility",
  private: "Private",
  archived: "Archived",
  default_branch: "Default Branch",
  main_language: "Main Language",
  size_kb: "Size (KB)",
  open_issues: "Open Issues",
  last_code_push: "Last Code Push",
  last_repo_update: "Last Repo Update",
  inactive_days: "Inactive Days",
  status: "Status",
};

const BRANCHES_COLUMNS = {
  repository: "Repository",
  branch: "Branch",
  last_commit: "Last Commit",
  last_author: "Last Author",
  inactive_days: "Inactive Days",
  status: "Status",
  ahead_by: "Ahead By",
  behind_by: "Behind By",
  compare_status: "Compare Status",
};

/**
 * @param {Array<import("../repos.js").RepoRecord & { branches?: any[] }>} repos
 * @param {string} outputDir
 */
export function writeReposCsv(repos, outputDir) {
  const flat = repos.map(({ branches: _b, ...rest }) => rest);
  const csv = stringify(flat, { header: true, columns: REPOS_COLUMNS });
  const filePath = path.join(outputDir, "repos.csv");
  fs.writeFileSync(filePath, csv, "utf-8");
  console.log(`[CSV] Repos report written → ${filePath} (${repos.length} rows)`);
}

/**
 * Recibe auditedRepos y extrae las ramas con flatMap.
 * El CSV de branches sigue siendo plano (es su naturaleza tabular),
 * con la columna `repository` como FK hacia el CSV de repos.
 *
 * @param {Array<{ branches: import("../branches.js").BranchRecord[] }>} auditedRepos
 * @param {string} outputDir
 */
export function writeBranchesCsv(auditedRepos, outputDir) {
  const branches = auditedRepos.flatMap(r => r.branches);
  const csv = stringify(branches, { header: true, columns: BRANCHES_COLUMNS });
  const filePath = path.join(outputDir, "branches.csv");
  fs.writeFileSync(filePath, csv, "utf-8");
  console.log(`[CSV] Branches report written → ${filePath} (${branches.length} rows)`);
}
