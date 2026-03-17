import { octokit } from "./octokit.js";
import { daysSince, repoStatus } from "./classifier.js";

const ORG = process.env.ORG;

/**
 * Obtiene y clasifica todos los repositorios no archivados/deshabilitados de la org.
 */
export async function getRepositories() {
  console.log(`[REPOS] Fetching repositories for org: ${ORG}`);

  const raw = await octokit.paginate(
    octokit.rest.repos.listForOrg,
    { org: ORG, type: "all", per_page: 100 }
  );

  const repos = raw
    .filter(repo => !repo.archived && !repo.disabled)
    .map(repo => {
      const inactive_days = daysSince(repo.pushed_at);
      return {
        repository: repo.name,
        default_branch: repo.default_branch,
        open_issues: repo.open_issues_count,
        last_code_push: repo.pushed_at,
        last_repo_update: repo.updated_at,
        inactive_days,
        status: repoStatus(inactive_days),
      };
    });

  console.log(
    `[REPOS] Found ${repos.length} repos — ` +
    `ACTIVO: ${repos.filter(r => r.status === "ACTIVO").length}, ` +
    `DESACTUALIZADO: ${repos.filter(r => r.status === "DESACTUALIZADO").length}, ` +
    `ABANDONADO: ${repos.filter(r => r.status === "ABANDONADO").length}`
  );

  return repos;
}
