# Task: Remediate all audit findings (opus_findings.md) — target release v1.2.0

**Source:** [docs/tasks/opus_findings.md](opus_findings.md) (two security audit passes + bug/consistency pass).
**Scope:** `src/**`, `.github/workflows/**`, `package.json`, README, CHANGELOG, examples.
**All findings verified against the current code on 2026-06-11.** Line numbers below are verified, not copied from the audit. One correction vs the audit: the env parser lives at `src/shared/utils/env-parser/env-parser.utils.ts`.

---

## Decisions (agreed with maintainer, 2026-06-11)

| # | Decision | Choice |
|---|----------|--------|
| D1 | How to ship behavior-changing fixes | **Everything ships as v1.2.0** (single minor release). Several items are technically breaking — mitigate with a prominent "Behavior changes" section in CHANGELOG and README migration notes (see P6.3). |
| D2 | npm publish credential | **Keep `NPM_REGISTRY_PAT`** — npm's OIDC Trusted Publishing is currently broken on their side; the PAT is rotated manually so it is not long-lived. Pin actions to SHAs regardless (P5.1). Revisit OIDC when npm fixes it. |
| D3 | `filePath` confinement (F4) | **Docs + opt-in `configBaseDir` option** (P1.5, P4.3). |
| D4 | Watcher gaps (E2/E3) | **Full fix in code**: watch the parent directory when the file is absent (at boot or after delete), attach the real watcher once it appears (P4.1). |

### Micro-decisions (made during planning; override here if you disagree)

| # | Topic | Decision |
|---|-------|----------|
| M1 | Boolean case sensitivity | Keep **case-sensitive** `true`/`false` in both required and optional getters (matches today's `getRequiredBooleanEnv`); `TRUE` now **throws loudly** instead of silently becoming `false`. (The audit offered both case-sensitive and `/i` variants.) |
| M2 | `getErrorMessage` for non-Error throws | Use `String(error)` instead of `JSON.stringify(error)` (F2: avoid serializing object internals). |
| M3 | Emitter listener limit (E5) | `this.events.setMaxListeners(0)` per the audit suggestion. |
| M4 | API shape for `configBaseDir` / env-file opt-out | New optional `EnvGetterModule.forRoot(options)` + `@Optional() @Inject(ENV_GETTER_OPTIONS)` in the service. Plain `imports: [EnvGetterModule]` keeps working unchanged. |
| M5 | `prebuild` cross-platform (T1) | `node -e "require('fs').rmSync('dist',{recursive:true,force:true})"` — no new devDependency. |
| M6 | T2 (function-typed default misread as class) | **Document** ("defaults must be data, not functions"), no runtime guard — reliable class-vs-function detection isn't possible. |
| M7 | `engines` field | `"engines": { "node": ">=20" }` (audit's recommendation); CI runs Node 22. |
| M8 | `checkIfEnvHasAllowedValue` echoes the received value | Keep the echo (allowed-values are enums by design) but add a JSDoc warning not to use `allowedValues` with secret variables. |
| M9 | Empty-string semantics | Uniform rule across **all** getters: set-but-empty (`KEY=`) is treated as **unset** (required → throw with a distinct "set but empty" message; optional → default/undefined). |

### The one rule that governs Phase 2 (from I1)

> **Absent or empty → default (optional) / error (required). Present but invalid → loud error (`stopProcess`), never a silent default and never a silent coercion.**

---

## Phase 1 — Security hardening (library)

### P1.1 — Make `CronSchedule` safe against DoS *(F1 — CWE-835/CWE-1284, the only High-rated item)*

**Files:** [src/shared/utils/cron-schedule.utils.ts](../../src/shared/utils/cron-schedule.utils.ts)
**Problem (verified):** `parseCronField` lacks the guards `isValidCronField` has:
- step branch (L246–257): `stepNum = 0` → `for (i = 0; …; i += 0)` infinite loop (`new CronSchedule('*/0 * * * *')` hangs the event loop);
- range branch (L260–271): no clamping → `1-2000000000` allocates an unbounded array (OOM);
- the public constructor (L309) performs **no validation** despite the "must be pre-validated" JSDoc, and `CronSchedule` is exported from `src/index.ts`.

**Changes:**
- [ ] Step branch: reject invalid steps — `if (!Number.isInteger(stepNum) || stepNum < 1) return [];`
- [ ] Range branch: enforce bounds — `if (startNum < min || endNum > max || startNum > endNum) return [];`
- [ ] Single-value branch (L283–285), defense-in-depth: return `[]` when `num < min || num > max` instead of `[num]`.
- [ ] Constructor: self-validate — `if (!isValidCronExpression(expression)) throw new Error(\`Invalid cron expression: '${expression}'\`);` (plain `Error` — utils have no `stopProcess`; `isValidCronExpression` is in the same module, no import cycle). Update the constructor JSDoc (`@throws`).
- [ ] Note: `getRequiredCron`/`getOptionalCron` already validate first — validation now runs twice on that path; it's cheap, acceptable.

**Tests** ([cron-schedule.utils.spec.ts](../../src/shared/utils/test/cron-schedule.utils.spec.ts)):
- [ ] `new CronSchedule('*/0 * * * *')` throws (use a test timeout to catch regression into a hang).
- [ ] `new CronSchedule('1-2000000000 * * * *')` throws; `parseCronField`-level: huge range returns `[]` (test via a valid-looking constructor bypass or export-for-testing).
- [ ] Invalid expressions (`''`, `'a b c'`, `'60 * * * *'`) throw; all currently-passing valid expressions still construct.

### P1.2 — Stop leaking secret fragments from `JSON.parse` errors *(Audit-2 Finding 1 — CWE-532/CWE-209, Medium)*

**Files:** [src/env-getter/env-getter.service.ts](../../src/env-getter/env-getter.service.ts)
**Problem (verified):** V8's `JSON.parse` SyntaxError embeds a fragment of the raw input. Raw messages flow into `console.error` + thrown errors via `stopProcess` and into watcher `error:<path>` events:
- `getRequiredObject` catch (L427–429), `getRequiredArray` catch (L472–474), `readAndParseConfigFile` JSON catch (L836–844, including the **rethrown** `err` that reaches the watcher's error event at L999–1006).

**Changes:**
- [ ] Add private `sanitizeJsonError(error: unknown): string` exactly as specced in the audit (extract `at position N (line L column C)` if present; return only positional info, never the input fragment).
- [ ] Use it in all three JSON catch sites. In `readAndParseConfigFile`, build `safeMessage` once and use it for **both** `stopProcess` and the rethrown `new Error(safeMessage)` (the rethrow feeds the watcher event).
- [ ] File-**read** errors (ENOENT/EACCES, L827–833) stay as-is — they don't embed file content.
- [ ] M8: JSDoc warning on `getRequiredEnv`/`getOptionalEnv` `allowedValues` params: value is echoed in the error — don't use with secrets.

**Tests:** malformed `DB_CREDS='{"pass": SuperSecret123}'` → thrown message contains `Invalid JSON` and position info but **not** `SuperSecret`; same assertion for the config-file path and for the `error:<path>` event payload after a watcher reload of a corrupted file.

### P1.3 — Remove stack trace / raw serialization from error messages *(F2 — CWE-209, Low)*

**Files:** [src/env-getter/env-getter.service.ts](../../src/env-getter/env-getter.service.ts)
**Problem (verified):** `getRequiredArray` validator-misuse message interpolates `new Error().stack` (L486–489); `getErrorMessage` (L741–743) `JSON.stringify`s arbitrary thrown values.

**Changes:**
- [ ] L486–489 → `this.stopProcess(\`The validation func of EnvGetterService.getRequiredArray('${envName}') must return a boolean or non-empty string.\`);` (no stack).
- [ ] `getErrorMessage`: `error instanceof Error ? error.message : String(error)` (M2).

**Tests:** misused validator (returns `undefined`) → message has no `at ` stack frames / absolute paths.

### P1.4 — Apply `deepSanitize` on the array path *(F3 = Audit-2 Finding 4 = I3 — CWE-1321, defense-in-depth)*

**Files:** [src/env-getter/env-getter.service.ts:472](../../src/env-getter/env-getter.service.ts)
**Change:**
- [ ] `parsedArray = this.deepSanitize(JSON.parse(envVal));` — `deepSanitize` already recurses into arrays (L59–73), drop-in.

**Tests:** `FORWARD_HEADERS='[{"__proto__":{"isAdmin":true}}]'` → parsed elements carry no own `__proto__` key; `Object.prototype` untouched.

### P1.5 — `filePath` trust contract: docs + opt-in confinement *(F4 — CWE-22, informational; D3)*

**Files:** [src/env-getter/env-getter.service.ts:794](../../src/env-getter/env-getter.service.ts), README, depends on **P4.3** for the options plumbing.
**Changes:**
- [ ] JSDoc on `getRequiredConfigFromFile`/`getOptionalConfigFromFile` + README: *"`filePath` must never be derived from untrusted input"* (same contract as `fs.readFileSync`).
- [ ] When `configBaseDir` is set (via module options, P4.3), `resolveFilePath` confines:
  ```ts
  const base = resolve(this.options?.configBaseDir);
  const p = resolve(base, filePath);
  if (p !== base && !p.startsWith(base + sep)) this.stopProcess(`Config file path '${filePath}' escapes baseDir '${base}'`);
  ```
  Without the option, behavior is exactly today's (`isAbsolute ? filePath : join(cwd, filePath)`).

**Tests:** with `configBaseDir`: relative path inside → resolves; `../outside.json` and absolute path outside → throws; without option → unchanged behavior.

---

## Phase 2 — Validation semantics overhaul (ships in v1.2.0 per D1; every change below goes in the CHANGELOG "Behavior changes" list)

### P2.1 — Fix `getOptionalEnv(name, allowedValues)` throwing when unset *(B1 — High, contract violation)*

**Files:** [src/env-getter/env-getter.service.ts:148–153](../../src/env-getter/env-getter.service.ts)
**Problem (verified):** the array overload calls `checkIfEnvHasAllowedValue(envName, envValue ?? null, …)`, which rejects `null` → an "optional" var is effectively required. Untested path (spec only covers unset without allowedValues).

**Changes:**
- [ ] Array branch: enforce allow-list **only when a value is present** (per audit snippet). With M9: treat `""` as unset too.
- [ ] Keep the `(name, default, allowed)` branch validating the *effective* value (default included) — validating a provided default is a deliberate guard, same precedent as `getOptionalTimePeriod`. Apply M9 to the env lookup: `(process.env[envName] || undefined) ?? defaultValue`.

**Tests:** unset + allowedValues → `undefined` (no throw); empty + allowedValues → `undefined`; set-valid → value; set-invalid → throws; default-not-in-allowed → throws.

### P2.2 — Strict optional boolean *(B2 — High; Audit-2 Finding 3)*

**Files:** [src/env-getter/env-getter.service.ts:223–227](../../src/env-getter/env-getter.service.ts)
**Problem (verified):** `process.env[envName] ? process.env[envName] === "true" : defaultValue` — `"TRUE"`, `"1"`, `"yes"`, typos → silently `false`; the classic fail-open toggle (`ENFORCE_TLS=TRUE` → `false`).

**Change (M1: case-sensitive):**
```ts
getOptionalBooleanEnv(envName: string, defaultValue?: boolean): boolean | undefined {
  const raw = process.env[envName];
  if (raw === undefined || raw === "") return defaultValue;
  if (raw !== "true" && raw !== "false")
    this.stopProcess(`Variable '${envName}' is not of boolean type. Expected 'true' or 'false', received '${raw}'.`);
  return raw === "true";
}
```
**Tests:** unset → default; `""` → default; `true`/`false` → parsed; `TRUE`, `1`, `yes` → throws.

### P2.3 — Tighten numeric validation *(B3 — Medium; Audit-2 Finding 3)*

**Files:** [src/env-getter/env-getter.service.ts:172–178, 188–196](../../src/env-getter/env-getter.service.ts)
**Problem (verified):** `/^[0-9_]+$/` accepts `"___"` → `Number("")` → `0`; `"1__2_"` accepted; huge digit strings silently lose precision; optional variant silently swallows malformed values into the default.

**Changes (both getters):**
- [ ] Regex `/^\d+(?:_\d+)*$/` — digits required, underscores only **between** digit groups.
- [ ] After parse: `if (!Number.isSafeInteger(n)) this.stopProcess(\`Variable '${envName}' exceeds the safe integer range.\`);`
- [ ] `getOptionalNumericEnv`: absent/empty → default; **present-but-invalid → `stopProcess`** (was: default).
- [ ] Document integer-only semantics (no `"1.5"`) in JSDoc + README (part of T3).

**Tests:** `"___"`, `"_1"`, `"1__2"`, `"12_"`, `"1.5"`, `"1e3"` → throw (required) / throw (optional, set); `"1_000"` → 1000; `"9007199254740993"` → throws (unsafe); unset/empty optional → default.

### P2.4 — Set-but-empty no longer satisfies required getters *(Audit-2 Finding 3; M9)*

**Files:** [src/env-getter/env-getter.service.ts:766–770](../../src/env-getter/env-getter.service.ts)
**Change:**
```ts
private checkEnvExisting(envName: string): boolean | never {
  const value = process.env[envName];
  if (value === undefined) this.stopProcess(`Missing '${envName}' environment variable`);
  if (value === "") this.stopProcess(`Variable '${envName}' is set but empty`);
  return true;
}
```
- [ ] `isEnvSet()` keeps pure-existence semantics (`hasOwnProperty`) — document the distinction.

**Tests:** `API_TOKEN=` (empty) → every `getRequired*` throws with the "set but empty" message; flows through to `getRequiredNumericEnv`, `getRequiredURL`, etc. for free (they call `getRequiredEnv`).

### P2.5 — Sweep the whole getter family for the I1 rule *(I1 — Medium)*

Audit-confirmed status + required action per getter:

| Getter | Today | Action |
|---|---|---|
| `getOptionalEnv` | `??` (empty wins over default) | M9: empty → default (P2.1) |
| `getOptionalNumericEnv` | invalid → silent default | throw (P2.3) |
| `getOptionalBooleanEnv` | invalid → silent `false`; empty → default | throw / default (P2.2) |
| `getOptionalURL` (L257–267) | empty → default ✓; invalid → throws ✓ | no change; **add tests** |
| `getOptionalTimePeriod` (L304–317) | empty → default ✓; invalid → throws ✓ | overloads in P2.6 |
| `getOptionalCron` (L369–385) | **empty → throws** (fails `isValidCronExpression`) | M9: empty → `undefined` |
| `getOptionalConfigFromFile` | missing file → default ✓ | watcher fix in P4.1 |

- [ ] Apply the `getOptionalCron` empty-string fix.
- [ ] Add the missing matrix tests (each getter × {unset, empty, valid, invalid}).

### P2.6 — Truly-optional time period overload *(I2 — Low)*

**Files:** [src/env-getter/env-getter.service.ts:304](../../src/env-getter/env-getter.service.ts)
**Change — new overload set:**
```ts
getOptionalTimePeriod(envName: string): number | undefined;
getOptionalTimePeriod(envName: string, resultIn: TimeMarker): number | undefined;
getOptionalTimePeriod(envName: string, defaultValue: string | number, resultIn?: TimeMarker): number;
```
- [ ] Runtime disambiguation of arg 2: if it is one of `"ms"|"s"|"m"|"h"|"d"` **and** arg 3 is undefined → it's `resultIn`. No real ambiguity: a bare marker (`"s"`) is not a valid time period (`isTimePeriod("s") === false`), so nobody can be using it as a default today.
- [ ] Accept `number` defaults too (passes `isTimePeriod`); keep validating provided defaults.

**Tests:** `(name)` unset → `undefined`; `(name, "s")` unset → `undefined`; `(name, "30s")` unset → `30000`; `(name, "30s", "s")` unset → `30`; set-invalid → throws for all forms.

---

## Phase 3 — env-parser & time utils

### P3.1 — Fix `$`-pattern corruption in interpolation *(Audit-2 Finding 2 = E1 — CWE-116, Low–Medium; silent credential corruption)*

**Files:** [src/shared/utils/env-parser/env-parser.utils.ts:145](../../src/shared/utils/env-parser/env-parser.utils.ts)
**Problem (verified):** `result.replace(fullMatch, replacement)` interprets `$$`, `$&`, `` $` ``, `$'` in the replacement: `DB_PASS='pa$$w0rd'` interpolated into `DB_URL=…${DB_PASS}…` yields `pa$w0rd` — silent auth failure.

**Change:**
- [ ] `result = result.replace(fullMatch, () => replacement);` — function replacer inserts verbatim.

**Tests:** values containing `$$`, `$&`, `` $` ``, `$'` survive interpolation byte-for-byte.

### P3.2 — Single-quoted values are not interpolated *(Audit-2 Finding 2, second part; behavior change → CHANGELOG)*

**Files:** [env-parser.utils.ts](../../src/shared/utils/env-parser/env-parser.utils.ts) — `parseLine` (L159–308), interpolation pass (L366–382)
**Problem (verified):** the expansion pass runs on every variable regardless of quote style; dotenv convention is that single quotes suppress expansion, so a literal `${...}` inside a single-quoted secret gets rewritten.

**Changes:**
- [ ] `parseLine` returns quote info (e.g. `singleQuoted: boolean`, also for the multiline single-quote buffer path L172–177); `parseEnvString` tracks it per key and skips `expandVariables` for single-quoted values.
- [ ] Document in README: double quotes → escapes + interpolation; single quotes → raw literal; unquoted → interpolation, `#` starts a comment.

**Tests:** `A='literal ${B}'` stays literal; `C="expanded ${B}"` and unquoted `D=${B}` still expand; multiline single-quoted unchanged.

### P3.3 — Time-period edge cases *(E6 — Low)*

**Files:** [src/shared/utils/time-period.utils.ts](../../src/shared/utils/time-period.utils.ts)
**Changes:**
- [ ] `isTimePeriod(number)`: currently unconditionally `true` (L22). Change to `Number.isFinite(value) && value >= 0` — rejects `NaN`/`Infinity`/negatives.
- [ ] Document `Math.ceil` rounding (L45) in JSDoc + README (`1500ms` → `2s`) — documentation only, no rounding change.

**Tests:** `isTimePeriod(NaN/Infinity/-5)` → `false`; rounding behavior pinned by an explicit test (`parseTimePeriod("1500", "s") === 2` … note input `1500ms`).

---

## Phase 4 — Watcher & runtime robustness

### P4.1 — Full watcher fix: absent-then-created and delete-then-recreated files *(E2 + E3 — Medium/Low; D4)*

**Files:** [src/env-getter/env-getter.service.ts](../../src/env-getter/env-getter.service.ts) — `getOptionalConfigFromFile` missing-file branch (L631–659), `setupFileWatcher` delete branch (L970–980), `onModuleDestroy` (L91–98)
**Problems (verified):**
- E2: optional config file missing at call time → default returned with event methods attached, **no watcher** — if the file appears later (secret mounted post-boot), nothing fires; the attached `.on()` is dead.
- E3: on delete, the debounce callback emits `error:<path>` and returns; `fs.watch` has lost the inode and goes permanently silent for plain delete→recreate (atomic rename is handled, plain delete is not).

**Design:**
- [ ] New private `setupPendingFileWatcher(filePath, cls, options, isOptional)`: `fs.watch(dirname(filePath))` filtered on `basename(filePath)` with the same debounce. On appearance: load via `readAndParseConfigFile(filePath, cls, false, …)` (in-place update path), emit `updated:<path>`, close pending watcher, establish the normal file watcher.
- [ ] Track pending watchers in a separate `pendingWatchers` map; close both maps in `onModuleDestroy`.
- [ ] If the **parent directory** doesn't exist either: skip watching (documented limitation — we don't walk ancestors).
- [ ] **E2 wiring:** in the missing-file branch of `getOptionalConfigFromFile` (when `watcherOptions.enabled !== false`): if a default object was returned, put that exact object into `configsStorage[absolutePath]` *first* — the existing "update existing object in place" path (L848–868) then mutates the caller's reference when the file appears, preserving the library's reference-stability contract. With no default (return `undefined`), still set up the pending watcher: the global `events` emitter (`updated:<abs path>`) is the subscription point; document that the `undefined` return cannot retroactively become the config — re-call the getter or subscribe via `service.events`.
- [ ] **E3 wiring:** in the delete branch, keep emitting `error:<path>`, then close + remove the dead watcher and call `setupPendingFileWatcher` so recreation resumes updates.
- [ ] README: supported rotation patterns — atomic replace (Vault), delete→recreate (now supported), file may appear after boot (now supported when the parent dir exists).

**Tests** (tmp-dir, real fs, generous debounce-aware timeouts; watch for platform flakiness on macOS vs Linux CI):
- optional config absent at boot + default → file created later → `updated:<path>` fires and the **originally returned object** now holds the file's data;
- absent, no default → file created → `updated:<path>` fires; subsequent call returns parsed config;
- loaded config deleted → `error:<path>`; recreated → `updated:<path>` and updates resume;
- `watcherOptions.enabled: false` → no pending watcher;
- `onModuleDestroy` closes pending watchers (no open-handle leaks in Jest).

### P4.2 — Shared emitter listener limit *(E5 — Low)*

- [ ] [env-getter.service.ts:81](../../src/env-getter/env-getter.service.ts) — `this.events.setMaxListeners(0);` right after construction (M3). Test: >10 subscriptions produce no `MaxListenersExceededWarning`.

### P4.3 — Module options: env-file opt-out/redirect + `configBaseDir` *(Audit-2 informational + D3; enables P1.5)*

**Files:** [src/env-getter/env-getter.module.ts](../../src/env-getter/env-getter.module.ts), [env-getter.service.ts:83–85](../../src/env-getter/env-getter.service.ts), `src/env-getter/types/`, [src/index.ts](../../src/index.ts), AppConfigModule
**Problem:** the constructor unconditionally loads `./.env` on every instantiation (CWE-426 flavor; mitigated by `override=false`, but no opt-out).

**Changes:**
- [ ] New exported type + token:
  ```ts
  export type EnvGetterModuleOptions = {
    /** .env path(s) to load at startup; false disables the implicit load. @default ".env" */
    envFilePath?: string | string[] | false;
    /** Confine config-file resolution to this directory (see P1.5). @default undefined (cwd resolution) */
    configBaseDir?: string;
  };
  export const ENV_GETTER_OPTIONS = Symbol("ENV_GETTER_OPTIONS");
  ```
- [ ] Service: `constructor(@Optional() @Inject(ENV_GETTER_OPTIONS) private readonly options?: EnvGetterModuleOptions)`; skip load when `false`, `loadEnvFiles` for arrays, default `.env` otherwise.
- [ ] `EnvGetterModule.forRoot(options): DynamicModule` (global, provides the token); the plain `EnvGetterModule` class import stays working with defaults — **non-breaking**.
- [ ] Wire pass-through in `AppConfigModule.forRoot/forRootAsync` (e.g. `envGetter?: EnvGetterModuleOptions` on its options).
- [ ] Export new type/token from `src/index.ts`; README section.

**Tests:** `forRoot({ envFilePath: false })` does not read `.env`; custom path loads; multiple paths cascade; plain module import behaves exactly as v1.1.3.

### P4.4 — Document "defaults must be data" *(T2 — Low; M6)*

- [ ] JSDoc on `getOptionalConfigFromFile`: a function-typed `defaultValue` is indistinguishable from a class constructor (`typeof === "function"` discrimination at L633/L672) and will be misread — defaults must be plain data.

---

## Phase 5 — CI/CD & packaging *(Audit-2 Finding 5, T1)*

### P5.1 — Pin all GitHub Actions to full commit SHAs

**Files:** all 8 files in [.github/workflows/](../../.github/workflows/) (`grep -rn 'uses:' .github/workflows/`) — `actions/checkout@v6`, `actions/setup-node@v6`, `actions/upload-artifact@v7` (build), `actions/download-artifact@v8` (publish).
- [ ] Resolve each SHA from the **official repo** (never copy from third-party sources): `gh api repos/actions/checkout/git/ref/tags/v6 --jq .object.sha` (note: if the tag points to an annotated tag object, dereference: `gh api repos/actions/checkout/git/tags/<sha> --jq .object.sha`).
- [ ] Format: `uses: actions/checkout@<40-char-sha> # v6` in every workflow.
- [ ] Optional hardening: add a `zizmor` workflow-lint job (or `actions/dependency-review-action` on PRs) to enforce pinning going forward.

### P5.2 — Publish credential *(D2 — decision recorded, minimal action)*

- [ ] Keep `NPM_REGISTRY_PAT` / `NODE_AUTH_TOKEN` in [publish.job.yml](../../.github/workflows/publish.job.yml). Rationale: npm OIDC Trusted Publishing currently broken (their side); PAT is manually rotated.
- [ ] Add a `# TODO: migrate to npm Trusted Publishing (OIDC) once npm resolves their issue; id-token: write is already present` comment in publish.job.yml so the intent isn't lost.

### P5.3 — Node runtime: CI on 22, engines floor

- [ ] `node-version: "20"` → `"22"` in every job file (publish, install, build, lint, typecheck, unit-tests). Node 20 is EOL (2026-04-30).
- [ ] Add `"engines": { "node": ">=20" }` to [package.json](../../package.json) (M7).

### P5.4 — devDependency advisories (build-pipeline exposure only)

- [ ] Run `yarn audit` (or OSV) against the lockfile; current state per audit: 126 findings, all ReDoS-class in transitive `picomatch`, `minimatch`, `brace-expansion`, `fast-uri`, `ajv` (jest/eslint/nest-cli chains).
- [ ] Yarn 1: add a `resolutions` block pinning those five at patched versions, **or** do a lockfile-wide devDep upgrade; re-audit and record the result in the PR description. (Consumers unaffected: `dependencies: {}`.)

### P5.5 — Windows-safe `prebuild` *(T1)*

- [ ] [package.json:28](../../package.json) → `"prebuild": "node -e \"require('fs').rmSync('dist',{recursive:true,force:true})\""` (M5). Verify `yarn build` still works.

---

## Phase 6 — Documentation, examples, release

### P6.1 — README/JSDoc sync *(T3, E7, plus every behavior change above)*

- [ ] `getOptionalEnv` contract incl. unset+allowedValues behavior (post-P2.1) and empty-string rule (M9).
- [ ] Numeric getters: integer-only, underscore grouping rule, safe-integer bound.
- [ ] Boolean getters: strict case-sensitive `true`/`false`, throw on invalid.
- [ ] `.env` format: `#` starts a comment in **unquoted** values (`PASSWORD=ab#cd` → `ab`) — quote values containing `#` (E7); quote-style semantics (P3.2); `$`-safety now guaranteed (P3.1).
- [ ] Time periods: `Math.ceil` rounding, non-finite/negative rejection, new optional overloads.
- [ ] Watcher semantics: creation/delete-recreate now supported, parent-dir requirement, atomic-replace flow (P4.1).
- [ ] `filePath` trust note + `configBaseDir` (P1.5), module options (P4.3), "defaults must be data" (P4.4), allowedValues-echo warning (M8).

### P6.2 — Examples hygiene *(Audit-2 informational)*

- [ ] Add `# placeholder values — never commit a real .env` header to `examples/nestjs-server/.env` (and a matching note in `configs/mongo-creds-*.json` docs/readme). Values are already fake; this makes the teaching pattern explicit.

### P6.3 — CHANGELOG + version

- [ ] Bump to **1.2.0**.
- [ ] CHANGELOG with three sections: **Security** (P1.1–P1.4, P3.1), **Behavior changes** (P2.1–P2.6, P3.2, P3.3 `isTimePeriod`, P2.4 empty-string rule — each with a one-line before/after), **Added** (P4.1 watcher capabilities, P4.3 module options, P1.5 `configBaseDir`, P2.6 overloads).
- [ ] README "Migration to 1.2.0" snippet mirroring the Behavior changes list (D1 mitigation — these are technically breaking; the changelog is the contract).

### P6.4 — Verification gate (definition of done)

- [ ] `yarn lint:report && yarn typecheck && yarn test` green.
- [ ] New tests exist for **every** checked item above (the audit explicitly flagged the untested B1 path).
- [ ] Grep-level checks: no `new Error().stack` in src; no bare `JSON.parse(` without `deepSanitize` in env-getter.service.ts; no `@v`-tag `uses:` left in workflows.
- [ ] Example project (`examples/nestjs-server`) boots against the new build.

---

## Traceability matrix (every finding → work item)

| Finding | Work item | | Finding | Work item |
|---|---|---|---|---|
| Audit-1 F1 (Cron DoS) | P1.1 | | B1 (optional+allowed throws) | P2.1 |
| Audit-1 F2 (stack/serialization) | P1.3 | | B2 (boolean mis-parse) | P2.2 |
| Audit-1 F3 (array sanitize) | P1.4 | | B3 (numeric `___`/overflow) | P2.3 |
| Audit-1 F4 (filePath) | P1.5 + P4.3 | | I1 (strict-vs-lenient) | P2.5 (+P2.1–P2.4) |
| Audit-2 F1 (JSON error leak) | P1.2 | | I2 (time-period overload) | P2.6 |
| Audit-2 F2 ($ corruption + quotes) | P3.1 + P3.2 | | I3 (array sanitize) | P1.4 |
| Audit-2 F3 (fail-open getters) | P2.2 + P2.3 + P2.4 | | E1 ($ corruption) | P3.1 |
| Audit-2 F4 (array sanitize) | P1.4 | | E2 (absent file never watched) | P4.1 |
| Audit-2 F5 (CI/CD) | P5.1–P5.4 | | E3 (delete stops watcher) | P4.1 |
| Info: implicit .env load | P4.3 | | E5 (emitter limit) | P4.2 |
| Info: example creds | P6.2 | | E6 (Math.ceil / non-finite) | P3.3 |
| T1 (rm -rf) | P5.5 | | E7 (# truncation) | P6.1 |
| T2 (function default) | P4.4 | | T3 (doc drift) | P6.1 |

*Note: the findings doc's summary table lists "E4–E7" but details only E5/E6/E7 — E4 is a numbering gap in the source document (its three described items — emitter limit, Math.ceil, # truncation — are all covered above). False-positive-pass items (ReDoS, SSRF, etc.) need no action by definition.*

## Suggested implementation order / PR slicing

1. **PR 1 — Security:** P1.1–P1.4, P3.1 (pure fixes, no API change).
2. **PR 2 — Semantics:** P2.1–P2.6, P2.4, P3.2, P3.3 (the CHANGELOG-heavy one).
3. **PR 3 — Watcher + options:** P4.1–P4.4, P1.5.
4. **PR 4 — CI/packaging:** P5.1–P5.5 (no library code; can land first or in parallel).
5. **PR 5 — Docs + release:** P6.1–P6.3, then tag v1.2.0.
