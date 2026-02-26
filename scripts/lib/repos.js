import { octokit } from "./octokit.js";
import { daysSince, repoStatus } from "./classifier.js";

const ORG = process.env.ORG;

/**
 * @typedef {Object} RepoRecord
 * @property {string} repository
 * @property {string} visibility
 * @property {boolean} private
 * @property {boolean} archived
 * @property {string} default_branch
 * @property {string|null} main_language
 * @property {number} size_kb
 * @property {number} open_issues
 * @property {string} last_code_push
 * @property {string} last_repo_update
 * @property {number} inactive_days
 * @property {"ACTIVE"|"STALE"|"ABANDONED"} status
 */

/**
 * Obtiene y clasifica todos los repositorios no archivados/deshabilitados de la org.
 *
 * @returns {Promise<RepoRecord[]>}
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
        visibility: repo.visibility,
        private: repo.private,
        archived: repo.archived,
        default_branch: repo.default_branch,
        main_language: repo.language ?? null,
        size_kb: repo.size,
        open_issues: repo.open_issues_count,
        last_code_push: repo.pushed_at,
        last_repo_update: repo.updated_at,
        inactive_days,
        status: repoStatus(inactive_days),
      };
    });

  console.log(
    `[REPOS] Found ${repos.length} repos — ` +
    `ACTIVE: ${repos.filter(r => r.status === "ACTIVE").length}, ` +
    `STALE: ${repos.filter(r => r.status === "STALE").length}, ` +
    `ABANDONED: ${repos.filter(r => r.status === "ABANDONED").length}`
  );

  return repos;
}
