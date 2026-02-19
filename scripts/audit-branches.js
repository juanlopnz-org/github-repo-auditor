import { Octokit } from "@octokit/rest";
import fs from "fs";

const ORG = process.env.ORG;
const TOKEN = process.env.GITHUB_TOKEN;

if (!ORG || !TOKEN) {
  console.error("ORG or GITHUB_TOKEN missing");
  process.exit(1);
}

const octokit = new Octokit({ auth: TOKEN });

if (!fs.existsSync("output")) {
  fs.mkdirSync("output");
}

async function getRepositories() {
  console.log(`Fetching repositories for organization: ${ORG}`);

  const repos = await octokit.paginate(
    octokit.rest.repos.listForOrg,
    { org: ORG, type: "all", per_page: 100 }
  );

  return repos
    .filter(repo => !repo.archived && !repo.disabled)
    .map(repo => ({
      name: repo.name,
      private: repo.private,
      default_branch: repo.default_branch,
      last_push: repo.pushed_at,
      updated_at: repo.updated_at,
    }));
}

async function main() {
  try {
    const repos = await getRepositories();

    console.log(`Fetched ${repos.length} repositories`);

    fs.writeFileSync(
      "output/repos.json",
      JSON.stringify(repos, null, 2)
    );

    console.log("Report generated successfully");

  } catch (error) {
    console.error("GitHub API error:");

    if (error.response) {
      console.error(error.response.status, error.response.data);
    } else {
      console.error(error);
    }

    process.exit(1);
  }
}

main();
