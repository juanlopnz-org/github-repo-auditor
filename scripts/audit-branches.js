/**
 * GitHub Organization Branch Auditor
 * ------------------------------------
 * Entrypoint principal. Orquesta:
 *   1. Fetch y clasificación de todos los repos de la org
 *   2. Auditoría de ramas de repos ACTIVE (con concurrencia controlada)
 *   3. Checkpointing cada CHECKPOINT_INTERVAL repos (para workflows con timeout)
 *   4. Generación de reportes JSON, repos.csv y branches.csv
 */

import fs from "fs";
import pLimit from "p-limit";
import { getRepositories } from "./lib/repos.js";
import { auditRepo } from "./lib/branches.js";
import { writeJsonReport } from "./lib/reporters/json.js";
import { writeReposCsv, writeBranchesCsv } from "./lib/reporters/csv.js";

// ── Configuración ─────────────────────────────────────────────────────────────

const ORG = process.env.ORG;
if (!ORG) { console.error("[ERROR] ORG env var is missing"); process.exit(1); }
if (!process.env.GH_TOKEN) { console.error("[ERROR] GH_TOKEN env var is missing"); process.exit(1); }

/** Repos auditados en paralelo simultáneamente. Ajustar según el rate-limit disponible. */
const CONCURRENCY = parseInt(process.env.AUDIT_CONCURRENCY ?? "5", 10);

/** Guardar checkpoint cada N repos auditados. */
const CHECKPOINT_INTERVAL = parseInt(process.env.CHECKPOINT_INTERVAL ?? "25", 10);

const OUTPUT_DIR = "output";

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

/**
 * Guarda el estado parcial de la auditoría para recuperación ante timeout.
 *
 * @param {import("./lib/branches.js").BranchRecord[]} branches
 */
function saveCheckpoint(branches) {
  const filePath = `${OUTPUT_DIR}/checkpoint_branches.json`;
  fs.writeFileSync(filePath, JSON.stringify(branches, null, 2), "utf-8");
  console.log(`[CHECKPOINT] Saved ${branches.length} branch records → ${filePath}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log(`GitHub Org Auditor — ${new Date().toISOString()}`);
  console.log(`Org: ${ORG} | Concurrency: ${CONCURRENCY} | Checkpoint every: ${CHECKPOINT_INTERVAL}`);
  console.log("=".repeat(60));

  ensureOutputDir();

  // 1. Fetch + clasificación de repos (sin I/O, sin network extra)
  const allRepos = await getRepositories();

  // 2. Solo auditar repos ACTIVE — repos STALE/ABANDONED no generan valor
  const activeRepos = allRepos.filter(r => r.status === "ACTIVE");
  console.log(`\n[AUDIT] Auditing ${activeRepos.length} ACTIVE repos (skipping ${allRepos.length - activeRepos.length} STALE/ABANDONED)\n`);

  // 3. Auditoría con concurrencia controlada + checkpointing
  const limit = pLimit(CONCURRENCY);
  const allBranches = [];
  let audited = 0;

  const tasks = activeRepos.map(repo =>
    limit(async () => {
      const branches = await auditRepo(repo);
      allBranches.push(...branches);
      audited++;

      if (audited % CHECKPOINT_INTERVAL === 0) {
        saveCheckpoint(allBranches);
      }

      return branches;
    })
  );

  await Promise.all(tasks);

  console.log(`\n[AUDIT] Done. ${audited} repos audited, ${allBranches.length} branches recorded.`);

  // 4. Generar reportes
  console.log("\n[REPORTS] Writing output files...");
  writeJsonReport({ repos: allRepos, branches: allBranches }, OUTPUT_DIR);
  writeReposCsv(allRepos, OUTPUT_DIR);
  writeBranchesCsv(allBranches, OUTPUT_DIR);

  // Limpiar checkpoint si el run completó exitosamente
  const checkpointPath = `${OUTPUT_DIR}/checkpoint_branches.json`;
  if (fs.existsSync(checkpointPath)) fs.unlinkSync(checkpointPath);

  console.log("\n✅ Audit completed successfully.");
  console.log("=".repeat(60));
}

main().catch(error => {
  console.error("\n[FATAL]", error.message);
  if (error.status) {
    console.error(`HTTP ${error.status}:`, error.response?.data ?? "");
  } else {
    console.error(error.stack);
  }
  process.exit(1);
});
