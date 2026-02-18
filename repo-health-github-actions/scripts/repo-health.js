import fs from "fs";
import path from "path";
import process from "process";
import { Octokit } from "@octokit/rest";

const token = process.env.GITHUB_TOKEN;
const staleDays = Number(process.env.STALE_DAYS || "30");
const excludeBranches = (process.env.EXCLUDE_BRANCHES || "main,master,develop").split(",");

const octokit = new Octokit({ auth: token });
const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");

const OUT_DIR = path.join(process.cwd(), "reports");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const daysBetween = d => Math.floor((Date.now() - new Date(d)) / (1000*60*60*24));

const openPRs = await octokit.paginate(octokit.pulls.list, {
  owner, repo, state: "open", per_page: 100
});

const branchesInUse = new Set(openPRs.map(pr => pr.head.ref));
const devFiles = {};

for (const pr of openPRs) {
  const files = await octokit.paginate(octokit.pulls.listFiles, {
    owner, repo, pull_number: pr.number, per_page: 100
  });
  for (const f of files) {
    devFiles[pr.user.login] ??= [];
    devFiles[pr.user.login].push({
      file: f.filename,
      pr: pr.number,
      updated: pr.updated_at
    });
  }
}

const branches = await octokit.paginate(octokit.repos.listBranches, {
  owner, repo, per_page: 100
});

const stale = [];

for (const b of branches) {
  if (excludeBranches.includes(b.name)) continue;
  const commit = await octokit.repos.getCommit({
    owner, repo, ref: b.commit.sha
  });
  const age = daysBetween(commit.data.commit.author.date);
  if (!branchesInUse.has(b.name) && age >= staleDays) {
    stale.push({
      branch: b.name,
      ageDays: age,
      lastCommit: commit.data.commit.author.date
    });
  }
}

fs.writeFileSync(path.join(OUT_DIR, "usage-by-developer.json"), JSON.stringify(devFiles, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "stale-branches.json"), JSON.stringify(stale, null, 2));