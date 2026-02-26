import { octokit } from "./octokit.js";
import { daysSince, branchStatus } from "./classifier.js";

const ORG = process.env.ORG;

/**
 * @typedef {Object} BranchRecord
 * @property {string} repository
 * @property {string} branch
 * @property {string|null} last_commit
 * @property {string|null} last_author
 * @property {number} inactive_days
 * @property {"ACTIVE"|"RISK"|"INACTIVE"} status
 * @property {number|null} ahead_by
 * @property {number|null} behind_by
 * @property {string} compare_status
 */

/**
 * Lista todas las ramas de un repo (paginado).
 *
 * @param {string} repo
 * @returns {Promise<Array>}
 */
async function getBranches(repo) {
  return octokit.paginate(
    octokit.rest.repos.listBranches,
    { owner: ORG, repo, per_page: 100 }
  );
}

/**
 * Obtiene la info del HEAD commit de una rama usando getBranch,
 * que es 1 sola request y retorna el commit directamente.
 * Evita el listCommits redundante del código original.
 *
 * @param {string} repo
 * @param {string} branch
 * @returns {Promise<{ date: string|null, author: string|null, sha: string }>}
 */
async function getHeadCommit(repo, branch) {
  const { data } = await octokit.rest.repos.getBranch({
    owner: ORG,
    repo,
    branch,
  });

  return {
    sha: data.commit.sha,
    date: data.commit.commit?.author?.date ?? null,
    author: data.commit.commit?.author?.name ?? null,
  };
}

/**
 * Compara una rama contra la rama base.
 * Retorna null en ahead/behind si la comparación falla.
 *
 * @param {string} repo
 * @param {string} base
 * @param {string} head
 * @returns {Promise<{ ahead_by: number|null, behind_by: number|null, compare_status: string }>}
 */
async function compareWithBase(repo, base, head) {
  try {
    const { data } = await octokit.rest.repos.compareCommits({
      owner: ORG,
      repo,
      base,
      head,
    });

    return {
      ahead_by: data.ahead_by,
      behind_by: data.behind_by,
      compare_status: data.status,
    };
  } catch (error) {
    const status = error.status ?? "unknown";
    console.warn(
      `[WARN] compareCommits failed for ${repo}:${head} vs ${base} — HTTP ${status}: ${error.message}`
    );
    return {
      ahead_by: null,
      behind_by: null,
      compare_status: `error_${status}`,
    };
  }
}

/**
 * Audita todas las ramas de un repositorio (excepto la rama base).
 * Las ramas se procesan en serie para evitar disparar demasiadas requests
 * concurrentes desde un único repo. La concurrencia entre repos es manejada
 * por el p-limit del entrypoint.
 *
 * @param {import("./repos.js").RepoRecord} repoRecord
 * @returns {Promise<BranchRecord[]>}
 */
export async function auditRepo(repoRecord) {
  const { repository: repo, default_branch: base } = repoRecord;

  let branches;
  try {
    branches = await getBranches(repo);
  } catch (error) {
    console.error(`[ERROR] getBranches failed for ${repo} — ${error.message}`);
    return [];
  }

  const nonBaseBranches = branches.filter(b => b.name !== base);
  console.log(`  [BRANCHES] ${repo}: ${nonBaseBranches.length} branches to audit`);

  const results = [];

  for (const b of nonBaseBranches) {
    let headCommit = { date: null, author: null };

    try {
      headCommit = await getHeadCommit(repo, b.name);
    } catch (error) {
      console.warn(`[WARN] getHeadCommit failed for ${repo}:${b.name} — ${error.message}`);
    }

    const inactive_days = daysSince(headCommit.date);
    const compare = await compareWithBase(repo, base, b.name);

    results.push({
      repository: repo,
      branch: b.name,
      last_commit: headCommit.date,
      last_author: headCommit.author,
      inactive_days,
      status: branchStatus(inactive_days),
      ahead_by: compare.ahead_by,
      behind_by: compare.behind_by,
      compare_status: compare.compare_status,
    });
  }

  return { ...repoRecord, branches: results };
}
