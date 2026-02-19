import { Octokit } from "@octokit/rest";
import { stringify } from "csv-stringify/sync";
import fs from "fs";

const ORG = process.env.ORG;
const TOKEN = process.env.GH_TOKEN;

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
    .map(repo => {
      const inactiveDays = daysSince(repo.pushed_at);
      return {
        repository: repo.name,
        visibility: repo.visibility,
        private: repo.private,
        archived: repo.archived,
        default_branch: repo.default_branch,
        main_language: repo.language,
        size_kb: repo.size,
        open_issues: repo.open_issues_count,
        last_code_push: repo.pushed_at,
        last_repo_update: repo.updated_at,
        inactiveDays: inactiveDays,
        status:
          inactiveDays < 30 ? "ACTIVE" :
            inactiveDays < 90 ? "STALE" :
              "ABANDONED"
      }
    });

}

function daysSince(dateString) {
  const now = new Date();
  const past = new Date(dateString);
  return Math.floor((now - past) / (1000 * 60 * 60 * 24));
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

    const csv = stringify(repos, {
      header: true,
      columns: {
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
        inactiveDays: "Inactive Days",
        status: "Status"
      }
    });

    fs.writeFileSync("output/repos.csv", csv);

    console.log("CSV report generated");


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
