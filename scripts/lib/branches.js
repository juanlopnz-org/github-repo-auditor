import { octokit } from "./octokit.js";
import { daysSince, branchStatus } from "./classifier.js";

const ORG = process.env.ORG;

/**
 * Lista todas las ramas de un repo.
 */
async function getBranches(repo) {
  return octokit.paginate(
    octokit.rest.repos.listBranches,
    { owner: ORG, repo, per_page: 100 }
  );
}

/**
 * Compara una rama contra la base.
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
      `[WARN] compareCommits failed ${repo}:${head} vs ${base} — ${status}`
    );

    return {
      ahead_by: null,
      behind_by: null,
      compare_status: `error_${status}`,
    };
  }
}

/**
 * Auditoría optimizada de ramas.
 */
export async function auditRepo(repoRecord) {
  const { repository: repo, default_branch: base } = repoRecord;

  let branches;

  try {
    branches = await getBranches(repo);
  } catch (error) {
    console.error(`[ERROR] getBranches failed for ${repo}`);
    return { ...repoRecord, branches: [] };
  }

  const results = [];

  for (const branch of branches) {
    const commitDate = branch.commit?.commit?.author?.date ?? null;
    const commitAuthor = branch.commit?.commit?.author?.name ?? null;

    const inactive_days = daysSince(commitDate);
    const status = branchStatus(inactive_days);

    let compare = {
      ahead_by: 0,
      behind_by: 0,
      compare_status: "equal",
    };

    if (branch.name !== base) {
      compare = await compareWithBase(repo, base, branch.name);
    }

    results.push({
      branch: branch.name,
      last_commit: commitDate,
      last_author: commitAuthor,
      inactive_days,
      status,
      ahead_by: compare.ahead_by,
      behind_by: compare.behind_by,
      compare_status: compare.compare_status,
    });
  }

  return { ...repoRecord, branches: results };
}