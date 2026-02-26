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
 * Guarda el estado parcial de repos auditados para recuperación ante timeout.
 *
 * @param {Array<import("./lib/repos.js").RepoRecord & { branches: any[] }>} repos
 */
function saveCheckpoint(repos) {
  const filePath = `${OUTPUT_DIR}/checkpoint_repos.json`;
  fs.writeFileSync(filePath, JSON.stringify(repos, null, 2), "utf-8");
  const total = repos.reduce((n, r) => n + r.branches.length, 0);
  console.log(`[CHECKPOINT] Saved ${repos.length} repos, ${total} branches → ${filePath}`);
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

  // 2. Auditoría con concurrencia controlada + checkpointing.
  //    Promise.all retorna AuditedRepo[] directamente — sin side effects laterales.
  //    Esto garantiza que allAuditedRepos siempre tiene branches embebidas.
  const limit = pLimit(CONCURRENCY);
  let audited = 0;

  const auditedActive = await Promise.all(
    allRepos.map(repo =>
      limit(async () => {
        const auditedRepo = await auditRepo(repo);
        audited++;

        if (audited % CHECKPOINT_INTERVAL === 0) {
          saveCheckpoint(auditedActive.filter(Boolean));
        }

        return auditedRepo;
      })
    )
  );

  // 3. Unificar: repos auditados (branches embebidas).
  //    El JSON contiene TODOS los repos de la org para visibilidad completa.
  const allAuditedRepos = auditedActive;

  // 4. Generar reportes — todos los reporters reciben el mismo array unificado
  console.log("\n[REPORTS] Writing output files...");
  writeJsonReport(allAuditedRepos, OUTPUT_DIR);       // JSON jerárquico
  writeReposCsv(allAuditedRepos, OUTPUT_DIR);         // CSV plano de repos (branches strip internamente)
  writeBranchesCsv(allAuditedRepos, OUTPUT_DIR);      // CSV plano de branches (flatMap internamente)

  // Limpiar checkpoint si el run completó exitosamente
  const checkpointPath = `${OUTPUT_DIR}/checkpoint_repos.json`;
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
