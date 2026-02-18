
---

# Auditoría de Repositorios en GitHub

Automatización basada en **GitHub Actions** para auditar ramas inactivas a nivel organización, generar reportes descargables y habilitar acciones de gobernanza.

---

## Objetivo

Implementar un mecanismo **automatizado** que permita:

- Visualizar de forma rápida y centralizada el estado de los repositorios.
- Clasificar ramas como **activas**, **en riesgo** o **inactivas** según reglas predefinidas (último commit, frecuencia de cambios, actividad de colaboradores).
- Obtener información confiable sobre últimos cambios y colaboradores.
- Reducir la gestión manual y facilitar decisiones sobre limpieza, archivado o mantenimiento de ramas.

---

## Enfoque de Arquitectura

* Workflow en **GitHub Actions**
* Orquestación y scheduling con `cron`
* Script principal en **Node.js**
* Consumo de la **GitHub REST API**
* Manejo de:

  * Paginación
  * Rate limits
  * Errores por repositorio

---

## Salidas Generadas

El proceso produce automáticamente:

* `branches_audit.json`
* `branches_audit.csv`
* `summary.json`

Todo se publica como **artefactos descargables** del workflow.

---

## Programación automática

Ejecución semanal:

* **Lunes 6:00 am (Colombia)**
* **11:00 UTC**

```yaml
cron: '0 11 * * 1'
```

---

## Workflow Completo

```yaml
name: Auditoria de Repositorios

on:
  schedule:
    - cron: '0 11 * * 1'
  workflow_dispatch:
    inputs:
      inactivity_days:
        description: 'Días de inactividad'
        required: false
        default: '60'

env:
  ORG: your-org
  BASE_BRANCH: main
  INACTIVITY_DAYS: ${{ github.event.inputs.inactivity_days || 60 }}

jobs:
  audit:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install deps
        run: npm install axios csv-stringify

      - name: Run audit
        env:
          GH_TOKEN: ${{ secrets.GH_TOKEN }}
        run: node scripts/audit-branches.js

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: auditoria-ramas
          path: output/
```

---

## Script `audit-branches.js` (Main)

###  Setup Base

```js
import axios from "axios";
import fs from "fs";
import { stringify } from "csv-stringify/sync";

const GH = axios.create({
  baseURL: "https://api.github.com",
  headers: {
    Authorization: `Bearer ${process.env.GH_TOKEN}`,
    Accept: "application/vnd.github+json"
  }
});

const ORG = process.env.ORG;
const BASE_BRANCH = process.env.BASE_BRANCH;
const INACTIVITY_DAYS = Number(process.env.INACTIVITY_DAYS);
const NOW = new Date();
```

---

### Paginación + Rate Limit Awareness

```js
async function paginated(url) {
  let page = 1;
  let results = [];

  while (true) {
    const res = await GH.get(url, { params: { per_page: 100, page } });

    const remaining = res.headers["x-ratelimit-remaining"];
    if (remaining < 50) await new Promise(r => setTimeout(r, 5000));

    results.push(...res.data);
    if (res.data.length < 100) break;
    page++;
  }
  return results;
}
```

---

### Descubrimiento de Repo

```js
const repos = (await paginated(`/orgs/${ORG}/repos`))
  .filter(r => !r.archived && !r.disabled && r.name.startsWith('ESB'));
```
> Nota: Filtrado para Chapter de Integración & Orquestación

---

### Responsables del Repo

```js
async function getResponsables(repo) {
  try {
    const collabs = await paginated(`/repos/${ORG}/${repo}/collaborators`);
    const admins = collabs.filter(c => c.permissions.admin);
    const maintains = collabs.filter(c => c.permissions.maintain);

    return [...admins, ...maintains]
      .map(u => u.login)
      .join(";") || repo.owner.login;
  } catch {
    return repo.owner.login;
  }
}
```
### Ramas y Último Commit

```js
function diasInactivos(fecha) {
  return Math.floor((NOW - new Date(fecha)) / (1000 * 60 * 60 * 24));
}

function estado(dias) {
  if (dias < INACTIVITY_DAYS / 2) return "ACTIVA";
  if (dias <= INACTIVITY_DAYS) return "RIESGO";
  return "INACTIVA";
}
```

---

### Comparación contra `main`

```js
async function compare(repo, branch) {
  try {
    const r = await GH.get(
      `/repos/${ORG}/${repo}/compare/${BASE_BRANCH}...${branch}`
    );

    const merged =
      r.data.status === "behind" ||
      r.data.status === "identical" ||
      r.data.ahead_by === 0;

    return {
      compare_status: r.data.status,
      ahead_by: r.data.ahead_by,
      behind_by: r.data.behind_by,
      merged_to_main: merged
    };
  } catch {
    return {};
  }
}
```

## Outputs

```
output/
 ├─ branches_audit.json
 ├─ branches_audit.csv
 └─ summary.json
```
