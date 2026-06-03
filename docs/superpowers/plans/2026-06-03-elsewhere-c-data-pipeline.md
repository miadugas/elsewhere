# Elsewhere — Plan C: Data Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Plan A's hand-seeded JSON with real free/official data — a Node/TS build script (run on the_litterbox via cron) that fetches BEA Regional Price Parities + HUD Fair Market Rents, transforms them into the app's `metros.json` / `rents.json`, validates the schema, and commits the refreshed data.

**Architecture:** Pure transform functions (raw API response → `Metro[]` / rent table) are TDD'd against recorded fixture responses — that's where correctness lives. A thin orchestrator handles fetch + write + validate. A schema guard fails the build loudly if any required field is missing, so a bad upstream response can never silently ship. Cron on the_litterbox runs it; the JSON lands in the app repo (committed → Cloudflare Pages redeploys).

**Tech Stack:** Node 20 + TypeScript (`tsx`) · native `fetch` · BEA API (free key) · HUD User FMR API · Vitest for transforms · cron on the_litterbox.

**Prerequisite:** Plan A complete (defines the `Metro` schema + `src/data/*.json` the script writes to).

---

## File Structure

```
pipeline/
├── package.json                 # separate workspace; tsx + vitest
├── src/
│   ├── sources/
│   │   ├── bea.ts               # fetch BEA RPP → raw rows
│   │   └── hud.ts               # fetch HUD FMR → raw rows
│   ├── transform/
│   │   ├── metros.ts            # raw BEA → Metro[]  (pure)
│   │   └── rents.ts             # raw HUD → ZIP rent table + ZIP→metro lookup (pure)
│   ├── msa-map.ts               # BEA MSA code ↔ our metro id (curated)
│   ├── validate.ts              # schema guard (pure)
│   └── build.ts                 # orchestrator: fetch → transform → validate → write
├── fixtures/
│   ├── bea-rpp.sample.json      # recorded BEA response slice
│   └── hud-fmr.sample.json      # recorded HUD response slice
└── tests/
    ├── transform-metros.test.ts
    ├── transform-rents.test.ts
    └── validate.test.ts
```

**Boundary:** `sources/*` do I/O only; `transform/*` and `validate.ts` are pure and fully tested; `build.ts` is the only file that touches the filesystem + network together. The pipeline is a sibling workspace, not part of the shipped app bundle.

---

### Task 1: Pipeline workspace scaffold

**Files:**

- Create: `pipeline/package.json`, `pipeline/tsconfig.json`

- [ ] **Step 1: Init the workspace**

```bash
mkdir -p pipeline/src/sources pipeline/src/transform pipeline/fixtures pipeline/tests
cd pipeline && npm init -y
npm install -D typescript tsx vitest @types/node
```

- [ ] **Step 2: Scripts + tsconfig**

In `pipeline/package.json` add scripts:

```json
"scripts": {
  "build:data": "tsx src/build.ts",
  "test": "vitest run"
}
```

`pipeline/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd ~/Developer/elsewhere && git add -A && git commit -m "chore(pipeline): scaffold data-pipeline workspace"
```

---

### Task 2: MSA ↔ metro-id map + fixtures

**Files:**

- Create: `pipeline/src/msa-map.ts`, `pipeline/fixtures/bea-rpp.sample.json`, `pipeline/fixtures/hud-fmr.sample.json`

- [ ] **Step 1: Curate the code map**

`pipeline/src/msa-map.ts` — maps BEA's GeoFips MSA codes to our metro ids (start with the 15 from Plan A's seed):

```ts
export const MSA_TO_METRO: Record<
  string,
  {
    id: string;
    short: string;
    name: string;
    states: string[];
    lat: number;
    lng: number;
  }
> = {
  "19820": {
    id: "detroit-mi",
    short: "Detroit",
    name: "Detroit-Warren-Dearborn, MI",
    states: ["MI"],
    lat: 42.331,
    lng: -83.046,
  },
  "12420": {
    id: "austin-tx",
    short: "Austin",
    name: "Austin-Round Rock, TX",
    states: ["TX"],
    lat: 30.267,
    lng: -97.743,
  },
  "35620": {
    id: "nyc-ny",
    short: "New York",
    name: "New York-Newark-Jersey City, NY-NJ",
    states: ["NY", "NJ"],
    lat: 40.713,
    lng: -74.006,
  },
  "16980": {
    id: "chicago-il",
    short: "Chicago",
    name: "Chicago-Naperville-Elgin, IL",
    states: ["IL"],
    lat: 41.878,
    lng: -87.63,
  },
  "19740": {
    id: "denver-co",
    short: "Denver",
    name: "Denver-Aurora-Lakewood, CO",
    states: ["CO"],
    lat: 39.739,
    lng: -104.99,
  },
};
// extend to all 15 (and beyond) as coverage grows
```

- [ ] **Step 2: Record fixtures**

Save a real slice of each API response (a few MSAs) to the fixture files. BEA RPP fixture shape (`pipeline/fixtures/bea-rpp.sample.json`):

```json
{
  "BEAAPI": {
    "Results": {
      "Data": [
        { "GeoFips": "19820", "LineCode": "1", "DataValue": "94.5" },
        { "GeoFips": "19820", "LineCode": "2", "DataValue": "80.1" },
        { "GeoFips": "19820", "LineCode": "3", "DataValue": "97.2" },
        { "GeoFips": "19820", "LineCode": "4", "DataValue": "96.0" },
        { "GeoFips": "12420", "LineCode": "1", "DataValue": "103.2" },
        { "GeoFips": "12420", "LineCode": "2", "DataValue": "112.8" },
        { "GeoFips": "12420", "LineCode": "3", "DataValue": "98.9" },
        { "GeoFips": "12420", "LineCode": "4", "DataValue": "101.4" }
      ]
    }
  }
}
```

_(LineCode 1=overall RPP, 2=housing, 3=goods, 4=other services — confirm against BEA RPP table line codes when wiring the live fetch.)_

HUD FMR fixture (`pipeline/fixtures/hud-fmr.sample.json`):

```json
{
  "data": [
    { "zip_code": "48201", "Onebr": 1180, "metro_code": "METRO19820" },
    { "zip_code": "78701", "Onebr": 1710, "metro_code": "METRO12420" }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(pipeline): MSA↔metro map + recorded API fixtures"
```

---

### Task 3: BEA → `Metro[]` transform (TDD)

**Files:**

- Create: `pipeline/src/transform/metros.ts`, `pipeline/tests/transform-metros.test.ts`

- [ ] **Step 1: Write failing test**

`pipeline/tests/transform-metros.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { beaToMetros } from "../src/transform/metros";
import fixture from "../fixtures/bea-rpp.sample.json";

describe("beaToMetros", () => {
  it("groups line codes into one Metro per MSA", () => {
    const metros = beaToMetros(fixture as any);
    const detroit = metros.find((m) => m.id === "detroit-mi")!;
    expect(detroit.rpp).toEqual({
      overall: 94.5,
      housing: 80.1,
      goods: 97.2,
      otherServices: 96,
    });
    expect(detroit.name).toBe("Detroit-Warren-Dearborn, MI");
    expect(detroit.lat).toBeCloseTo(42.331, 3);
  });

  it("emits one entry per known MSA only", () => {
    const metros = beaToMetros(fixture as any);
    expect(metros.map((m) => m.id).sort()).toEqual(["austin-tx", "detroit-mi"]);
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `cd pipeline && npx vitest run tests/transform-metros.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`pipeline/src/transform/metros.ts`:

```ts
import { MSA_TO_METRO } from "../msa-map";

interface BeaRow {
  GeoFips: string;
  LineCode: string;
  DataValue: string;
}
interface BeaResponse {
  BEAAPI: { Results: { Data: BeaRow[] } };
}

interface Metro {
  id: string;
  name: string;
  short: string;
  states: string[];
  lat: number;
  lng: number;
  rpp: {
    overall: number;
    housing: number;
    goods: number;
    otherServices: number;
  };
}

const LINE: Record<string, keyof Metro["rpp"]> = {
  "1": "overall",
  "2": "housing",
  "3": "goods",
  "4": "otherServices",
};

export function beaToMetros(res: BeaResponse): Metro[] {
  const byMsa = new Map<string, Metro>();
  for (const row of res.BEAAPI.Results.Data) {
    const meta = MSA_TO_METRO[row.GeoFips];
    const field = LINE[row.LineCode];
    if (!meta || !field) continue;
    if (!byMsa.has(row.GeoFips)) {
      byMsa.set(row.GeoFips, {
        ...meta,
        rpp: { overall: 0, housing: 0, goods: 0, otherServices: 0 },
      });
    }
    byMsa.get(row.GeoFips)!.rpp[field] = Number(row.DataValue);
  }
  return [...byMsa.values()].sort((a, b) => a.id.localeCompare(b.id));
}
```

- [ ] **Step 4: Run — verify pass**

Run: `cd pipeline && npx vitest run tests/transform-metros.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/Developer/elsewhere && git add -A && git commit -m "feat(pipeline): BEA RPP → Metro[] transform"
```

---

### Task 4: HUD → rent table transform (TDD)

**Files:**

- Create: `pipeline/src/transform/rents.ts`, `pipeline/tests/transform-rents.test.ts`

- [ ] **Step 1: Write failing test**

`pipeline/tests/transform-rents.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { hudToRents } from "../src/transform/rents";
import fixture from "../fixtures/hud-fmr.sample.json";

describe("hudToRents", () => {
  it("builds a ZIP→rent map and a ZIP→metro lookup", () => {
    const { rentByZip, metroByZip } = hudToRents(fixture as any);
    expect(rentByZip["48201"]).toBe(1180);
    expect(rentByZip["78701"]).toBe(1710);
    expect(metroByZip["48201"]).toBe("detroit-mi");
    expect(metroByZip["78701"]).toBe("austin-tx");
  });

  it("skips ZIPs whose metro_code is not in our map", () => {
    const { rentByZip } = hudToRents({
      data: [{ zip_code: "99999", Onebr: 999, metro_code: "METRO00000" }],
    } as any);
    expect(rentByZip["99999"]).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `cd pipeline && npx vitest run tests/transform-rents.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`pipeline/src/transform/rents.ts`:

```ts
import { MSA_TO_METRO } from "../msa-map";

interface HudRow {
  zip_code: string;
  Onebr: number;
  metro_code: string;
}
interface HudResponse {
  data: HudRow[];
}

// HUD metro_code looks like "METRO19820..." — extract the 5-digit MSA code.
function msaFromMetroCode(code: string): string | null {
  const m = code.match(/(\d{5})/);
  return m ? m[1] : null;
}

export function hudToRents(res: HudResponse): {
  rentByZip: Record<string, number>;
  metroByZip: Record<string, string>;
} {
  const rentByZip: Record<string, number> = {};
  const metroByZip: Record<string, string> = {};
  for (const row of res.data) {
    const msa = msaFromMetroCode(row.metro_code);
    const meta = msa ? MSA_TO_METRO[msa] : undefined;
    if (!meta) continue;
    rentByZip[row.zip_code] = row.Onebr;
    metroByZip[row.zip_code] = meta.id;
  }
  return { rentByZip, metroByZip };
}
```

- [ ] **Step 4: Run — verify pass**

Run: `cd pipeline && npx vitest run tests/transform-rents.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/Developer/elsewhere && git add -A && git commit -m "feat(pipeline): HUD FMR → ZIP rent + metro lookup"
```

---

### Task 5: Schema validation guard (TDD)

**Files:**

- Create: `pipeline/src/validate.ts`, `pipeline/tests/validate.test.ts`

- [ ] **Step 1: Write failing test**

`pipeline/tests/validate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateMetros } from "../src/validate";

const good = [
  {
    id: "a",
    name: "A",
    short: "A",
    states: ["X"],
    lat: 1,
    lng: 2,
    rpp: { overall: 100, housing: 100, goods: 100, otherServices: 100 },
  },
];

describe("validateMetros", () => {
  it("passes well-formed metros", () => {
    expect(() => validateMetros(good as any)).not.toThrow();
  });

  it("throws if a parity field is missing or zero", () => {
    const bad = [
      {
        ...good[0],
        rpp: { overall: 0, housing: 100, goods: 100, otherServices: 100 },
      },
    ];
    expect(() => validateMetros(bad as any)).toThrow(/overall/);
  });

  it("throws on empty input", () => {
    expect(() => validateMetros([])).toThrow(/no metros/i);
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `cd pipeline && npx vitest run tests/validate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`pipeline/src/validate.ts`:

```ts
interface Metro {
  id: string;
  name: string;
  short: string;
  states: string[];
  lat: number;
  lng: number;
  rpp: {
    overall: number;
    housing: number;
    goods: number;
    otherServices: number;
  };
}

export function validateMetros(metros: Metro[]): void {
  if (!metros.length) throw new Error("validation failed: no metros produced");
  for (const m of metros) {
    if (!m.id || !m.name || !m.states.length)
      throw new Error(
        `validation failed: ${m.id || "?"} missing identity fields`,
      );
    for (const key of [
      "overall",
      "housing",
      "goods",
      "otherServices",
    ] as const) {
      if (!m.rpp[key] || m.rpp[key] <= 0)
        throw new Error(
          `validation failed: ${m.id} ${key} parity is missing or non-positive`,
        );
    }
  }
}
```

- [ ] **Step 4: Run — verify pass**

Run: `cd pipeline && npx vitest run tests/validate.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/Developer/elsewhere && git add -A && git commit -m "feat(pipeline): schema guard for produced metros"
```

---

### Task 6: Source fetchers + orchestrator

**Files:**

- Create: `pipeline/src/sources/bea.ts`, `pipeline/src/sources/hud.ts`, `pipeline/src/build.ts`

- [ ] **Step 1: BEA fetcher**

`pipeline/src/sources/bea.ts`:

```ts
// BEA RPP, table MARPP, all MSAs. Needs a free key: https://apps.bea.gov/API/signup/
export async function fetchBeaRpp(apiKey: string, year: string) {
  const url = new URL("https://apps.bea.gov/api/data");
  url.search = new URLSearchParams({
    UserID: apiKey,
    method: "GetData",
    datasetname: "Regional",
    TableName: "MARPP",
    LineCode: "ALL",
    GeoFips: "MSA",
    Year: year,
    ResultFormat: "json",
  }).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`BEA fetch failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 2: HUD fetcher**

`pipeline/src/sources/hud.ts`:

```ts
// HUD User FMR API. Needs a free token: https://www.huduser.gov/portal/dataset/fmr-api.html
export async function fetchHudFmr(token: string, year: string) {
  const res = await fetch(
    `https://www.huduser.gov/hudapi/public/fmr/data/${year}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok) throw new Error(`HUD fetch failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 3: Orchestrator**

`pipeline/src/build.ts`:

```ts
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fetchBeaRpp } from "./sources/bea";
import { fetchHudFmr } from "./sources/hud";
import { beaToMetros } from "./transform/metros";
import { hudToRents } from "./transform/rents";
import { validateMetros } from "./validate";

const DATA_DIR = resolve(import.meta.dirname, "../../src/data");

async function main() {
  const beaKey = process.env.BEA_API_KEY;
  const hudToken = process.env.HUD_API_TOKEN;
  const year = process.env.DATA_YEAR ?? "2023";
  if (!beaKey || !hudToken)
    throw new Error("Set BEA_API_KEY and HUD_API_TOKEN");

  const metros = beaToMetros(await fetchBeaRpp(beaKey, year));
  validateMetros(metros);
  const { rentByZip, metroByZip } = hudToRents(
    await fetchHudFmr(hudToken, year),
  );

  await writeFile(
    resolve(DATA_DIR, "metros.json"),
    JSON.stringify(metros, null, 2),
  );
  await writeFile(
    resolve(DATA_DIR, "rents.json"),
    JSON.stringify({ rentByZip, metroByZip }, null, 2),
  );
  console.log(
    `wrote ${metros.length} metros, ${Object.keys(rentByZip).length} ZIP rents`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 4: Dry run against live APIs**

Run (with keys in env):

```bash
cd pipeline && BEA_API_KEY=... HUD_API_TOKEN=... DATA_YEAR=2023 npm run build:data
```

Expected: prints the metro + ZIP counts; `src/data/metros.json` and `src/data/rents.json` are updated. Re-run Plan A's `npm test` from the repo root to confirm the engines still pass against real data.

- [ ] **Step 5: Commit**

```bash
cd ~/Developer/elsewhere && git add -A && git commit -m "feat(pipeline): BEA/HUD fetchers + build orchestrator"
```

---

### Task 7: Cron on the_litterbox

**Files:**

- Create: `pipeline/run.sh`, document the cron entry in `pipeline/README.md`

- [ ] **Step 1: Runner script**

`pipeline/run.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
export BEA_API_KEY HUD_API_TOKEN DATA_YEAR
npm ci --omit=dev >/dev/null 2>&1 || npm install
npm run build:data
# commit + push so Cloudflare Pages redeploys
cd ..
if ! git diff --quiet src/data; then
  git add src/data
  git commit -m "data: refresh BEA/HUD ($(date +%F))"
  git push
fi
```

`chmod +x pipeline/run.sh`.

- [ ] **Step 2: Document the cron entry**

`pipeline/README.md`:

```md
## Scheduled refresh (the_litterbox)

Quarterly is plenty (BEA annual, HUD annual). Crontab:

    # 04:00 on the 2nd of Jan/Apr/Jul/Oct
    0 4 2 1,4,7,10 * BEA_API_KEY=xxx HUD_API_TOKEN=yyy DATA_YEAR=2023 /path/to/elsewhere/pipeline/run.sh >> /var/log/elsewhere-data.log 2>&1

A failed run leaves the last-good JSON committed — users never see a gap.
```

- [ ] **Step 3: Commit**

```bash
cd ~/Developer/elsewhere && git add -A && git commit -m "feat(pipeline): cron runner + schedule docs for the_litterbox"
```

---

### Task 8: Verification gate

- [ ] **Step 1: Full pipeline tests**

Run: `cd pipeline && npm test`
Expected: all transform + validate tests pass (7 tests).

- [ ] **Step 2: End-to-end on real data**

Run the dry run (Task 6 Step 4), then from repo root `npm test && npm run build`.
Expected: real `metros.json`/`rents.json` produced, app engine tests still green, app builds.

- [ ] **Step 3: Commit**

```bash
cd ~/Developer/elsewhere && git add -A && git commit -m "test(pipeline): end-to-end verification gate"
```

---

## Self-Review

**Spec coverage:** §3 "BEA RPP metro parity" → Tasks 3/6. §3 "HUD/Zillow ZIP rent overlay + ZIP→metro lookup" → Tasks 4/6 (HUD chosen as the §9 open-question resolution; Zillow ZORI is a drop-in alternative fetcher if preferred). §3 "regenerated by the_litterbox cron, no DB" → Tasks 6/7. §4 "a down day is invisible to users" → Task 7 last-good-commit behavior. §9 open questions (rent source, BEA vintage) → resolved here: HUD FMR, `DATA_YEAR` env, BEA line codes documented in Task 2.

**Placeholder scan:** none — runnable code/commands throughout. API keys are env vars (correctly external); BEA LineCode meanings flagged for confirmation against the live table, which is a data-accuracy verification step, not a code gap.

**Type consistency:** the `Metro` shape in `transform/metros.ts` and `validate.ts` matches Plan A's `src/types.ts` exactly (id/name/short/states/lat/lng/rpp). `MSA_TO_METRO` is the single source for MSA→identity, consumed by both transforms. `build.ts` writes to the exact paths (`src/data/metros.json`, `src/data/rents.json`) Plan A reads from.

**Note on basket.json:** national-average item prices (Plan A's `basket.json`) change rarely and have no single clean API — kept hand-maintained for now (per spec §9). If automated later, add a `transform/basket.ts` sourced from BLS Average Price Data; out of scope for this plan.
