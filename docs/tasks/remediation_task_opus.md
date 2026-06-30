# Remediation Task — nestjs-env-getter v1.2.0

**Target release:** `v1.2.0` (single all-in-one release, including behavior changes)
**Source findings:** [`docs/tasks/opus_findings.md`](./opus_findings.md) (three overlapping audit passes — deduped below)
**Audited version:** v1.1.3 (line numbers in this doc match current `src/**`)
**Date:** 2026-06-11

This document is the **source of truth** for the audit-remediation work. It consolidates the three overlapping audit passes in `opus_findings.md` into one canonical, deduplicated work list, encodes the maintainer's settled decisions, and specifies the fix, tests, and docs for every finding.

---

## 1. Settled decisions (do not re-litigate)

These were explicit maintainer choices (2026-06-11). They govern the whole task.

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **All fixes ship as one `v1.2.0`** — including behavior-changing ones. No v2.0.0, no strict-mode flag. | Mitigated by a prominent CHANGELOG **"Behavior changes"** section (see §7). |
| D2 | **Keep `NPM_REGISTRY_PAT`** for npm publish; do **not** switch to OIDC Trusted Publishing. | npm's OIDC is broken on npm's side; maintainer rotates the PAT manually (so it is not long-lived). A `TODO` comment documenting this lives in `publish.job.yml`. |
| D3 | **filePath safety = docs + opt-in `configBaseDir`** module option (not docs-only). | See MOD-1 / SEC-4. |
| D4 | **Watcher gaps get the full code fix** (parent-dir pending watcher for absent/deleted files), not just docs. | See WATCH-1 / WATCH-2. |
| D5 | **Numeric getters: strict integer + safe-integer overflow guard.** Stay integer-only (documented); no float support. | See BUG-3. |
| D6 | **CI/CD hardening: SHA-pin actions + bump Node 20→22 (+ `engines`) + pin transitive dev advisories.** No zizmor/dependency-review enforcement step this round. | See CI-1..CI-3. |
| D7 | **Time period: add no-default optional overload + reject non-finite/negative numbers.** Rounding stays `Math.ceil` (documented). | See TIME-1 / TIME-2. |
| D8 | **dotenv auto-load: add module options (`envFilePath` / `disableDotEnv`) + parse-once-per-process guard.** | See MOD-1. |

---

## 2. Canonical finding map (dedup)

The audit reported the same issues under different labels across its three passes. This task tracks **one** canonical ID per issue:

| Canonical ID | Audit labels (opus_findings.md) | One-line summary |
|---|---|---|
| **SEC-1** | F1 | `CronSchedule` constructor trusts input → infinite loop / unbounded alloc (DoS) |
| **SEC-2** | F2, Finding 1 | Stack trace + raw JSON-parse fragments (secrets) in thrown/logged messages |
| **SEC-3** | F3, Finding 4, I3 | `deepSanitize` not applied on the `getRequiredArray` path |
| **SEC-4** | F4 | `filePath` resolved without confinement (path traversal if fed untrusted input) |
| **BUG-1** | B1 | `getOptionalEnv(name, allowedValues)` throws when the var is unset |
| **BUG-2** | B2, Finding 3 | `getOptionalBooleanEnv` silently mis-parses (`TRUE`→false, fail-open) |
| **BUG-3** | B3, Finding 3 | Numeric validator accepts `"___"`, `"1__2"`, overflows past safe int |
| **BUG-4** | Finding 3, B1/B2 | Empty `KEY=` satisfies "required"; inconsistent emptiness semantics |
| **BUG-5** | I1 | Strict-vs-lenient asymmetry (governing principle behind BUG-1..4) |
| **PARSE-1** | Finding 2, E1 | `$`-pattern expansion corrupts interpolated values (`String.replace` specials) |
| **PARSE-2** | Finding 2, E1 | Single-quoted `.env` values are wrongly variable-expanded |
| **PARSE-3** | E7 | Unquoted `PASSWORD=ab#cd` truncates at `#` (document) |
| **WATCH-1** | E2 | Initially-absent optional config is never watched (dead `.on()`) |
| **WATCH-2** | E3 | File delete stops the watcher; delete-then-recreate goes silent |
| **WATCH-3** | E5 | Shared `EventEmitter` trips `MaxListenersExceededWarning` at >10 subs |
| **TIME-1** | I2 | No `getOptionalTimePeriod(name) => number \| undefined` overload |
| **TIME-2** | E6 | `isTimePeriod(number)` always true (NaN/∞/negative pass); `Math.ceil` undocumented |
| **MOD-1** | F4 + Informational | New module-options mechanism: `configBaseDir`, `envFilePath`, `disableDotEnv`, parse-once |
| **CI-1** | Finding 5 | Actions pinned by mutable tag → pin to commit SHA |
| **CI-2** | Finding 5 | CI on EOL Node 20 → bump to 22; add `engines` floor |
| **CI-3** | Finding 5 | Transitive dev-dep ReDoS advisories → `resolutions` |
| **CI-4** | Finding 5 + D2 | Document PAT-not-OIDC decision in `publish.job.yml` |
| **TOOL-1** | T1 | `prebuild: rm -rf dist` breaks on Windows |
| **TOOL-2** | T2 | `getOptionalConfigFromFile` mis-reads a function-typed default as a class |
| **TOOL-3** | T3 | Doc drift (numeric int-only, B1 contract, new options/overloads) |
| **TOOL-4** | Informational | Example `.env`/creds: add "placeholder values" header comment |

**Won't-fix / out of scope** (validated false positives or by-design — see §8): ReDoS, prototype-pollution main paths, SSRF/injection/crypto/auth, committed example secrets, OIDC switch (D2).

---

## 3. Priority & suggested order

| Priority | Items | Why |
|---|---|---|
| **P1 — correctness/secrets** | SEC-2, BUG-1, BUG-2, BUG-3, BUG-4, BUG-5, PARSE-1, PARSE-2 | Silent fail-open on security toggles + secret fragments in logs are the highest real-world impact. |
| **P2 — hardening/features** | SEC-1, SEC-3, SEC-4, MOD-1, WATCH-1, WATCH-2, WATCH-3, TIME-1, TIME-2 | Defense-in-depth, new module options, watcher robustness, API ergonomics. |
| **P3 — supply chain/tooling/docs** | CI-1, CI-2, CI-3, CI-4, TOOL-1, TOOL-2, TOOL-3, TOOL-4, PARSE-3 | Pipeline + packaging + documentation. |

Suggested execution grouping (minimize file churn): do all `env-getter.service.ts` items together (SEC-2, SEC-3, SEC-4, BUG-1..4, WATCH-1..3, MOD-1, TIME-1), then `cron-schedule.utils.ts` (SEC-1), `env-parser.utils.ts` (PARSE-1/2), `time-period.utils.ts` (TIME-2), then modules (MOD-1 wiring), then CI/packaging/docs.

---

## 4. Library work items

> Code below is illustrative and grounded in the current implementation. Adapt exact wording/messages to match surrounding style. Every behavior change must be covered by tests (§6) and the CHANGELOG (§7).

### SEC-1 — Harden `CronSchedule` against DoS  ·  `src/shared/utils/cron-schedule.utils.ts`
**CWE-835 + CWE-1284.** `new CronSchedule('*/0 * * * *')` → infinite loop (`stepNum = 0`, `i += 0`). `new CronSchedule('1-2000000000 * * * *')` → unbounded array. The constructor (`:309`) trusts input despite the "must be pre-validated" JSDoc; `parseCronField` (`:235`) omits the guards that `isValidCronField` has.

Two layers (do both):

1. **Make the constructor self-validating** (`:309`). `isValidCronExpression` is in the same module — no import cycle:
   ```ts
   constructor(expression: string) {
     if (!isValidCronExpression(expression)) {
       throw new Error(`Invalid cron expression: '${expression}'`);
     }
     this.expression = expression.trim();
     // ...unchanged
   }
   ```
2. **Defense-in-depth guards in `parseCronField`:**
   - Step branch (`:246`): after parsing `stepNum`, `if (!Number.isInteger(stepNum) || stepNum < 1) return [];`
   - Range branch (`:260`): after parsing, `if (startNum < min || endNum > max || startNum > endNum) return [];`
   - Single-value branch (`:283`): `const num = parseInt(field, 10); return Number.isNaN(num) ? [] : [num];`

**Note:** `getRequiredCron`/`getOptionalCron` already pre-validate, so their behavior is unchanged; the only new behavior is direct `new CronSchedule(badString)` now throws instead of hanging.
**Tests:** `cron-schedule.utils.spec.ts` — constructor throws on `*/0 ...`, on out-of-range ranges, on overflowing ranges; valid expressions still parse identically.

---

### SEC-2 — Strip secrets / stack traces from errors & logs  ·  `env-getter.service.ts`
**CWE-532 / CWE-209.** On Node ≥20, `JSON.parse` `SyntaxError` messages embed a raw fragment of the input — and these parse sites are fed credentials by design (`getRequiredObject('DB_CREDS')`, mongo creds files). Fragments reach `console.error`, the thrown `Error`, and `ConfigErrorEvent.error`. Separately, `getRequiredArray` interpolates a full `new Error().stack` (`:487`), and `getErrorMessage` `JSON.stringify`s arbitrary thrown values (`:742`).

1. **Add a private helper** (place near `getErrorMessage`, `:741`):
   ```ts
   /**
    * V8 JSON.parse errors embed a fragment of the raw input
    * (e.g. `Unexpected token 'S', ..."{"pass": SuperSecre"... is not valid JSON`).
    * Config payloads are frequently credentials, so only position info may surface.
    */
   private sanitizeJsonError(error: unknown): string {
     const message = error instanceof Error ? error.message : String(error);
     const pos = /at position (\d+)(?: \(line (\d+) column (\d+)\))?/.exec(message);
     if (pos?.[2]) return `Invalid JSON at line ${pos[2]}, column ${pos[3]}`;
     return pos ? `Invalid JSON at position ${pos[1]}` : "Invalid JSON";
   }
   ```
2. **Apply at all three JSON catch sites:**
   - `getRequiredObject` (`:428`): `this.stopProcess(\`${baseErrorMessage} ${this.sanitizeJsonError(error)}\`);`
   - `getRequiredArray` (`:473`): same (combine with SEC-3 below).
   - `readAndParseConfigFile` (`:838`): build `const safeMessage = \`${baseErrorMessage} Invalid JSON format: ${this.sanitizeJsonError(error)}\`;` and use it for **both** the `stopProcess` and the **rethrow** — the rethrown `err` is what reaches the watcher's `error:<path>` event (`:1006`), so it must be sanitized too.
3. **Drop the stack trace** in the array-validator misuse path (`:485-490`):
   ```ts
   if (!["boolean", "string"].includes(typeof result) || result === "")
     this.stopProcess(
       `The validation func of EnvGetterService.getRequiredArray('${envName}') must return a boolean or non-empty string.`,
     );
   ```
4. **Harden `getErrorMessage`** (`:742`): replace `JSON.stringify(error)` with `String(error)` to avoid serializing object internals.

**Note:** `checkIfEnvHasAllowedValue` (`:783`) echoes the received value — left as-is (allow-lists are enums by design); call out in README that allow-listed getters are not for secrets.
**Tests:** malformed-JSON object/array/file no longer leak the value fragment (assert message matches the `Invalid JSON at ...` shape, not the payload); existing `getRequiredObject` "invalid-json" spec (`:171`) message expectation must be updated; array-validator-misuse spec (`:250`) message updated (no stack).

---

### SEC-3 — Apply `deepSanitize` on the array path  ·  `env-getter.service.ts:472`
**CWE-1321 (defense-in-depth).** `getRequiredObject` (`:427`) and `readAndParseConfigFile` (`:837`) sanitize; `getRequiredArray` returns the raw parse. `deepSanitize` already recurses into arrays (`:60`), so this is a drop-in:
```ts
try {
  parsedArray = this.deepSanitize(JSON.parse(envVal));
} catch (error: unknown) {
  this.stopProcess(`${baseErrorMessage} ${this.sanitizeJsonError(error)}`);  // also SEC-2
}
```
**Tests:** `FORWARD_HEADERS='[{"__proto__":{"isAdmin":true}}]'` → parsed elements have no `__proto__` own key; normal arrays unchanged.

---

### SEC-4 — Confine `filePath` via `configBaseDir`  ·  `env-getter.service.ts:794` (+ MOD-1)
**CWE-22 (by design; opt-in confinement per D3).** `resolveFilePath` takes the path as-is. Add optional confinement driven by the new `configBaseDir` module option (MOD-1). Import `resolve, sep` from `path`:
```ts
private resolveFilePath(filePath: string): string {
  const baseDir = this.options.configBaseDir;
  if (baseDir) {
    const resolved = resolve(baseDir, filePath);        // relative resolves under baseDir; absolute stays absolute
    const root = resolve(baseDir);
    if (resolved !== root && !resolved.startsWith(root + sep)) {
      this.stopProcess(`Config path '${filePath}' escapes configBaseDir '${baseDir}'.`);
    }
    return resolved;
  }
  return isAbsolute(filePath) ? filePath : join(process.cwd(), filePath);  // unchanged default
}
```
**Docs:** README + JSDoc on `getRequiredConfigFromFile`/`getOptionalConfigFromFile`: *"`filePath` must never be derived from untrusted input. Use the `configBaseDir` module option to confine resolution."*
**Tests:** with `configBaseDir` set — relative path resolves under it; `../escape` and an out-of-base absolute path are rejected; without it — behavior identical to today.

---

### BUG-1 — `getOptionalEnv(name, allowedValues)` must not throw when unset  ·  `env-getter.service.ts:148`
The `Array.isArray(...)` branch calls `checkIfEnvHasAllowedValue(envName, envValue ?? null, ...)`, which rejects `null` (`:782`) — so an *optional* var with an allow-list hard-fails when absent. Enforce the allow-list only when a value is present:
```ts
if (Array.isArray(defaultValueOrAllowedValues)) {
  const envValue = process.env[envName];
  if (envValue === undefined || envValue === "") return undefined;   // unset/empty optional → undefined
  this.checkIfEnvHasAllowedValue(envName, envValue, defaultValueOrAllowedValues);
  return envValue;
}
```
**Tests:** `getOptionalEnv('UNSET', ['a','b'])` → `undefined` (currently throws); present-but-invalid still throws; present-and-valid returns the value.

---

### BUG-2 — `getOptionalBooleanEnv` strict parse (fail-closed)  ·  `env-getter.service.ts:225`
`return process.env[envName] ? process.env[envName] === "true" : defaultValue;` silently turns `"TRUE"`, `"1"`, typos into `false`, and treats empty as default. A mistyped security toggle silently flips. Make it consistent with the required variant (case-sensitive `true`/`false`, throw on set-but-invalid):
```ts
getOptionalBooleanEnv(envName: string, defaultValue?: boolean): boolean | undefined {
  const raw = process.env[envName];
  if (raw === undefined || raw === "") return defaultValue;          // absent/empty → default
  if (raw !== "true" && raw !== "false")
    this.stopProcess(`Variable '${envName}' is not of boolean type. Expected 'true' or 'false', received '${raw}'.`);
  return raw === "true";
}
```
**Decision note:** stays **case-sensitive** to match `getRequiredBooleanEnv` (`:210`). Case-insensitive acceptance would be a separate, additive enhancement — out of scope.
**Tests:** `TRUE`/`1`/`yes` → `stopProcess`; absent → default; empty → default; `true`/`false` → boolean.

---

### BUG-3 — Numeric validator: strict integer + safe-integer guard  ·  `env-getter.service.ts:175, :195`
**Per D5.** `/^[0-9_]+$/` accepts `"___"`→0, `"1__2"`, `"12_"`, and silently overflows. Tighten to underscores-only-between-digit-groups, integer-only, and reject values beyond `Number.isSafeInteger`. Add a shared constant:
```ts
// near the top of the class
private static readonly NUMERIC_REGEX = /^\d+(?:_\d+)*$/;   // rejects ___, _1, 1_, 1__2

getRequiredNumericEnv(envName: string): number {
  const envVal = this.getRequiredEnv(envName);
  if (!EnvGetterService.NUMERIC_REGEX.test(envVal))
    this.stopProcess(`Variable '${envName}' is not of number type.`);
  const n = Number(envVal.replace(/_/g, ""));
  if (!Number.isSafeInteger(n))
    this.stopProcess(`Variable '${envName}' exceeds the safe integer range.`);
  return n;
}

getOptionalNumericEnv(envName: string, defaultValue?: number): number | undefined {
  const raw = process.env[envName];
  if (raw === undefined || raw === "") return defaultValue;            // absent/empty → default
  if (!EnvGetterService.NUMERIC_REGEX.test(raw))
    this.stopProcess(`Variable '${envName}' is set but is not of number type: received '${raw}'.`);  // see SEC-2 note: numerics aren't secrets
  const n = Number(raw.replace(/_/g, ""));
  if (!Number.isSafeInteger(n))
    this.stopProcess(`Variable '${envName}' exceeds the safe integer range.`);
  return n;
}
```
**Behavior change:** optional numeric now *throws* on set-but-invalid (previously fell back to default silently). Integer-only is now enforced and documented; `"1.5"` still fails (as today, now intentional).
**Tests:** `"___"`, `"1__2"`, `"12_"`, `"_1"`, a 30-digit string, `"1.5"`, `"abc"` → reject; `"1_000_000"` → 1000000; absent/empty → default.

---

### BUG-4 / BUG-5 — Unified emptiness + strict-optional principle  ·  `env-getter.service.ts:766`, `:155`
**Governing rule (the theme behind B1/B2/B3, finding I1):**
> A **set-but-empty** variable (`KEY=`) is treated as **unset** everywhere. Optional getters fall back to the default **only when the variable is absent or empty**; when it is *present and non-empty but invalid*, they fail as loudly as the required variant.

1. **`checkEnvExisting`** (`:766`) — treat empty as missing:
   ```ts
   private checkEnvExisting(envName: string): boolean | never {
     const value = process.env[envName];
     if (value === undefined || value === "")
       this.stopProcess(`Missing '${envName}' environment variable`);
     return true;
   }
   ```
   This flows into `getRequiredEnv`, and therefore `getRequiredNumericEnv/Boolean/URL/TimePeriod/Object/Array/Cron`.
2. **`getOptionalEnv` non-array branch** (`:154`) — empty wins over default today (`?? `). Make empty fall to default:
   ```ts
   const present = process.env[envName];
   const envValue = present === undefined || present === "" ? defaultValueOrAllowedValues : present;
   if (allowedValues?.length) this.checkIfEnvHasAllowedValue(envName, envValue ?? null, allowedValues);
   return envValue;
   ```
3. The optional numeric/boolean getters already encode empty→default via BUG-2/BUG-3.

**Leave `isEnvSet`** (`:105`, `hasOwnProperty`) **unchanged** — it answers a deliberately different question ("is the key literally present"); document the distinction.
**Tests:** `API_TOKEN=` (empty) → `getRequiredEnv` throws "Missing"; `getOptionalEnv('X','def')` with `X=` → `"def"`; document that `isEnvSet('X')` is still `true` for `X=`.

---

### PARSE-1 — `$`-pattern expansion corrupts interpolated values  ·  `env-parser.utils.ts:145`
**CWE-116.** `result.replace(fullMatch, replacement)` interprets `$$`, `$&`, `` $` ``, `$'` in the *replacement string* even when the search is a plain string — so `DB_PASS='pa$$w0rd'` interpolated into `${DB_PASS}` corrupts the credential. Use a function replacer (taken verbatim):
```ts
result = result.replace(fullMatch, () => replacement);
```
**Tests:** values containing `$$`, `$&`, `` $` ``, `$'`, `$1` survive interpolation byte-for-byte.

---

### PARSE-2 — Single-quoted `.env` values must not be variable-expanded  ·  `env-parser.utils.ts` (`parseLine` + `parseEnvString` second pass)
**Per D1 behavior change.** dotenv convention: single quotes = raw literal (no `${...}` expansion). Today the second pass (`:367-382`) expands **every** variable regardless of quote style. Thread quote info through:

1. In `parseLine`, return whether the value came from a single-quoted literal (the single-quote branches at `:252-263` and the multiline single-quote branch at `:172-178`). Add e.g. `singleQuoted: true` to those returns; default `false` elsewhere.
2. In `parseEnvString`, accumulate a parallel `Map<string, boolean>` (`key → isSingleQuoted`) next to `variables` (`:343-345`).
3. In the second pass (`:368`), skip expansion for single-quoted values:
   ```ts
   for (const [key, value] of Object.entries(variables)) {
     if (singleQuoted.get(key)) { expandedVariables[key] = value; continue; }
     const { result, circularError } = expandVariables(value, variables, systemEnv, new Set([key]), quiet);
     // ...unchanged
   }
   ```
**Behavior change:** a literal `${...}` inside a single-quoted value is now preserved instead of rewritten.
**Tests:** `A='${B}'` with `B=x` → `A` stays `${B}`; double-quoted and unquoted still expand.

---

### PARSE-3 — Document `#` truncation in unquoted values  ·  `env-parser.utils.ts:300-304`
By-design dotenv compatibility: unquoted `PASSWORD=ab#cd` truncates at the inline comment to `ab`. **Docs only** — README "Environment File Parsing" section should note that values containing `#` (and other specials) must be quoted. No code change.

---

### WATCH-1 / WATCH-2 — Watch absent & deleted config files  ·  `env-getter.service.ts:631`, `:971` (per D4)
Two gaps in the otherwise-good watcher:
- **WATCH-1 (E2):** in `getOptionalConfigFromFile`, when the file is missing at call time (`:631-659`) the code returns the default with `.on()` attached but sets up **no watcher** — so if the file appears later (secret mounted post-boot), `updated` never fires.
- **WATCH-2 (E3):** in `setupFileWatcher`, on delete (`:971`) it emits `error:<path>` and returns without re-establishing — `fs.watch` loses the inode and goes silent; delete-then-recreate isn't recovered.

**Fix — a shared "pending creation" watcher on the parent directory.** Add:
```ts
private readonly pendingWatchers = new Map<string, ReturnType<typeof watch>>();

/** Watch the parent dir until `filePath` (re)appears, then load it and switch to the normal file watcher. */
private watchForCreation<C extends ClassConstructor<unknown> | undefined = undefined>(
  filePath: string, cls: C | undefined, options: FileWatcherOptions | undefined, isOptional: boolean,
): void {
  if (this.pendingWatchers.has(filePath)) return;
  const dir = dirname(filePath);
  if (!existsSync(dir)) return;                 // can't watch a non-existent dir; document this limit
  const base = basename(filePath);
  const dirWatcher = watch(dir, (_evt, changed) => {
    if (changed !== base && changed !== null) return;
    if (!existsSync(filePath)) return;
    dirWatcher.close();
    this.pendingWatchers.delete(filePath);
    try {
      this.readAndParseConfigFile(filePath, cls, false, options?.breakOnError ?? true, isOptional);
      this.setupFileWatcher(filePath, cls, options, isOptional);
      this.events.emit(`updated:${filePath}`, { filePath, timestamp: Date.now() } as ConfigUpdatedEvent);
    } catch (error: unknown) {
      this.events.emit(`error:${filePath}`, {
        filePath, error: error instanceof Error ? error : new Error(String(error)), timestamp: Date.now(),
      } as ConfigErrorEvent);
    }
  });
  this.pendingWatchers.set(filePath, dirWatcher);
}
```
- **WATCH-1 wiring:** in the absent-file branches of `getOptionalConfigFromFile` (`:631` and the catch fallback `:707`), after attaching event methods to the default, call `this.watchForCreation(absolutePath, cls, options, true)` (only when watching is enabled).
- **WATCH-2 wiring:** in `setupFileWatcher`'s delete branch (`:971-980`), after emitting the `error` event, call `this.watchForCreation(filePath, cls, options, isOptional)` so a later recreate recovers.
- **Cleanup:** `onModuleDestroy` (`:91`) must also close `pendingWatchers` and clear the map.
- Import `dirname, basename` from `path`.

**Document** the one residual limit: if the **parent directory** itself does not exist at call time, creation can't be watched.
**Tests:** absent optional config → create file → `updated` fires and the returned ref reflects content; existing watched file → delete → recreate → `updated` fires again.

---

### WATCH-3 — Raise the emitter listener cap  ·  `env-getter.service.ts:81`
**E5.** All configs share one `EventEmitter`; >10 subscriptions trip `MaxListenersExceededWarning`. Set unlimited in the constructor (or at declaration):
```ts
this.events.setMaxListeners(0);
```
**Tests:** 15+ `.on()` subscriptions across configs produce no warning (spy on `process.emitWarning` / assert no throw).

---

### TIME-1 — Add a no-default optional time-period overload  ·  `env-getter.service.ts:304` (per D7)
**I2.** Match `getOptionalCron`/`getOptionalURL` ergonomics — return `undefined` when unset and no default is given:
```ts
getOptionalTimePeriod(envName: string): number | undefined;
getOptionalTimePeriod(envName: string, defaultValue: string, resultIn?: TimeMarker): number;
getOptionalTimePeriod(envName: string, defaultValue?: string, resultIn: TimeMarker = "ms"): number | undefined {
  const baseErrorMessage = `'${envName}' is not in the acceptable format. It must be: <number><"ms"|"s"|"m"|"h"|"d">. Ex.: '12h', '2d', '2D', '2 d'`;
  const envVal = process.env[envName];

  if (envVal === undefined || envVal === "") {                 // unset/empty
    if (defaultValue === undefined) return undefined;
    if (!isTimePeriod(defaultValue)) this.stopProcess(`The default value for the environment variable ${baseErrorMessage}`);
    return parseTimePeriod(defaultValue, resultIn);
  }
  if (!isTimePeriod(envVal)) this.stopProcess(`Variable ${baseErrorMessage}`);
  return parseTimePeriod(envVal, resultIn);
}
```
**Tests:** unset + no default → `undefined`; unset + default → parsed default; set + valid → parsed; set + invalid → throws.

---

### TIME-2 — Reject non-finite/negative time periods; document rounding  ·  `time-period.utils.ts:21, :36`
**E6.** `isTimePeriod(number)` is unconditionally `true`, so `NaN`/`Infinity`/negative pass through `getRequiredTimePeriod`/`getOptionalTimePeriod`:
```ts
export function isTimePeriod(value: string | number): boolean {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0;
  if (typeof value === "string") return timePeriodStringRegex.test(value.replace(/_/g, ""));
  return false;
}

export function parseTimePeriod(value: string | number, resultIn: TimeMarker = "ms"): number {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : NaN;
  // ...string branch unchanged (Math.ceil retained — see doc note)
}
```
**Docs:** note that string→unit conversion **rounds up** (`Math.ceil`) — e.g. `1500ms` as `s` → `2` (per D7, rounding stays `Math.ceil`).
**Tests:** `isTimePeriod(NaN/Infinity/-5)` → `false`; `parseTimePeriod(-1)` → `NaN`; `1500ms`→`s` is `2`.

---

### MOD-1 — Module-options mechanism  ·  new wiring across `env-getter.service.ts`, `env-getter.module.ts`, `app-config.module.ts` (per D3, D8)
Introduce a single options object that carries `configBaseDir` (SEC-4) and the dotenv controls. Currently `EnvGetterService` has a no-arg constructor (`:83`) and `EnvGetterModule` provides it directly with no `forRoot`.

1. **New options type + token** (e.g. `src/env-getter/types/env-getter-options.type.ts`, export from the types barrel and `src/index.ts`):
   ```ts
   export interface EnvGetterModuleOptions {
     /** Confine relative config files to this dir; reject paths that escape it. @see getRequiredConfigFromFile */
     configBaseDir?: string;
     /** Path to the .env file auto-loaded on startup. @default ".env" */
     envFilePath?: string;
     /** Disable the automatic .env load entirely. @default false */
     disableDotEnv?: boolean;
   }
   export const ENV_GETTER_OPTIONS = Symbol("ENV_GETTER_OPTIONS");
   ```
2. **Service constructor** (`:83`) — optional injection + parse-once guard (fixes the "every instantiation re-reads `.env`" note):
   ```ts
   private static readonly loadedEnvFiles = new Set<string>();
   constructor(
     @Optional() @Inject(ENV_GETTER_OPTIONS) private readonly options: EnvGetterModuleOptions = {},
   ) {
     if (!this.options.disableDotEnv) {
       const path = this.options.envFilePath ?? ".env";
       if (!EnvGetterService.loadedEnvFiles.has(path)) {
         EnvGetterService.loadedEnvFiles.add(path);
         loadEnvFile(path, { quiet: true });
       }
     }
   }
   ```
   (Import `Optional, Inject` from `@nestjs/common`.)
3. **`EnvGetterModule.forRoot`** — add while keeping bare `EnvGetterModule` working (options default to `{}` via `@Optional`):
   ```ts
   @Global()
   @Module({ providers: [EnvGetterService], exports: [EnvGetterService] })
   export class EnvGetterModule {
     static forRoot(options: EnvGetterModuleOptions = {}): DynamicModule {
       return {
         module: EnvGetterModule,
         providers: [{ provide: ENV_GETTER_OPTIONS, useValue: options }, EnvGetterService],
         exports: [EnvGetterService],
       };
     }
   }
   ```
4. **`AppConfigModule.forRoot`/`forRootAsync`** — accept an optional `envGetter?: EnvGetterModuleOptions` and register the same `ENV_GETTER_OPTIONS` provider alongside `EnvGetterService` (`:41`, `:59`, `:71`).

**Docs/tests:** README "Register the Configuration" gains the options; tests cover `disableDotEnv`, custom `envFilePath`, `configBaseDir` confinement (SEC-4), and that two service instantiations don't double-load `.env`.

---

## 5. CI/CD, tooling & packaging

### CI-1 — Pin actions to commit SHA  ·  all 6 `*.job.yml` (per D6)
Replace mutable tags with full 40-char SHAs + a version comment. Resolve SHAs from the **official** repos at implementation time (do not copy from third parties):
```bash
gh api repos/actions/checkout/git/ref/tags/v6 --jq .object.sha
gh api repos/actions/setup-node/git/ref/tags/v6 --jq .object.sha
gh api repos/actions/upload-artifact/git/ref/tags/v7 --jq .object.sha
gh api repos/actions/download-artifact/git/ref/tags/v8 --jq .object.sha
```
Actions to pin: `actions/checkout@v6` (all jobs), `actions/setup-node@v6` (all jobs), `actions/upload-artifact@v7` (`build.job.yml`), `actions/download-artifact@v8` (`publish.job.yml`). Format: `uses: actions/checkout@<sha> # v6`.

### CI-2 — Bump Node 20→22 + `engines`  ·  6 `*.job.yml` + `package.json` (per D6)
Node 20 reached EOL 2026-04-30. Set `node-version: "22"` in `publish/build/install/lint/typecheck/unit-tests` job files. Add to `package.json`:
```json
"engines": { "node": ">=20" }
```
(Consumer floor `>=20`; CI runs on active LTS 22.)

### CI-3 — Pin transitive dev advisories  ·  `package.json` + `yarn.lock` (per D6)
`yarn audit`: runtime tree **0** advisories (keep), dev tree has ReDoS-class advisories in `picomatch`/`minimatch`/`brace-expansion`/`fast-uri`/`ajv` (via jest/eslint/nest-cli). Add a Yarn 1 `resolutions` block at patched versions (resolve exact patched versions at implementation time, then `yarn install` + re-`yarn audit` to confirm dev advisories cleared):
```json
"resolutions": {
  "picomatch": "<patched>",
  "minimatch": "<patched>",
  "brace-expansion": "<patched>",
  "fast-uri": "<patched>",
  "ajv": "<patched>"
}
```
Build-time only; consumers are unaffected (`"dependencies": {}`).

### CI-4 — Document the PAT decision  ·  `publish.job.yml` (per D2)
Keep `NPM_REGISTRY_PAT` / `NODE_AUTH_TOKEN`, `--provenance`, and `id-token: write` (all already present). Add a `TODO` comment near the auth env explaining: *OIDC Trusted Publishing intentionally not used (broken on npm's side); PAT is rotated manually. Revisit when npm fixes OIDC.* No functional change.

### TOOL-1 — Cross-platform `prebuild`  ·  `package.json:28`
`"prebuild": "rm -rf dist"` fails on Windows. Use a Node one-liner (no new dep, fits the zero-runtime-dep ethos):
```json
"prebuild": "node -e \"require('fs').rmSync('dist',{recursive:true,force:true})\""
```

### TOOL-2 — `getOptionalConfigFromFile` default-vs-class discrimination  ·  `env-getter.service.ts:633, :672`
The overload picks `cls` vs `defaultValue` by `typeof === "function"`, so a **function-typed default** is misread as a class (niche). **Docs:** state that defaults must be plain data, not functions. *(Optional hardening: detect a class via `value.prototype && value.prototype.constructor === value`; low priority — docs suffice this round.)*

### TOOL-3 — Documentation updates  ·  `README.md`, JSDoc
Align docs with the behavior changes (closes T3 doc drift):
- Headline **"Behavior changes in v1.2.0"** callout (mirror CHANGELOG §7).
- Numeric getters are **integer-only**, allow `_` separators between digit groups, and reject values beyond the safe-integer range.
- `getOptionalEnv(name, allowedValues)` returns `undefined` when unset (no longer throws).
- Empty `KEY=` is treated as **unset** everywhere; `isEnvSet` still reports it as present (distinction documented).
- Optional boolean/numeric now **throw** on set-but-invalid.
- `.env`: single-quoted values are **not** interpolated; values with `#`/`$`/specials should be quoted (PARSE-1/2/3).
- New `getOptionalTimePeriod(name)` overload; time-period string→unit conversion **rounds up**.
- New module options (`configBaseDir`, `envFilePath`, `disableDotEnv`); `filePath` must not come from untrusted input.
- Watcher: absent-at-startup configs are now watched for creation; delete-then-recreate recovers; document the parent-dir-must-exist limit.

### TOOL-4 — Example placeholder header  ·  `examples/**` (Informational)
Add a `# Placeholder values — never commit a real .env / real credentials` header to the example `.env` and `*-creds*.json` to make the teaching pattern explicit. (Values are already localhost dummies and excluded from the npm `files` whitelist.)

---

## 6. Testing checklist

Run `yarn lint`, `yarn typecheck`, `yarn test` green. New/updated specs:

- **cron-schedule.utils.spec.ts** — SEC-1: constructor throws on `*/0`, out-of-range and overflowing ranges; valid expressions unchanged.
- **env-getter.service.spec.ts** —
  - SEC-2: malformed JSON (object/array/file) error messages contain no input fragment; update existing `:171` and `:250` expectations.
  - SEC-3: array `__proto__` payload sanitized.
  - SEC-4: `configBaseDir` confinement (allow in-base, reject escape/out-of-base absolute).
  - BUG-1: optional + allow-list unset → `undefined`.
  - BUG-2: optional boolean throws on `TRUE`/`1`; absent/empty → default.
  - BUG-3: numeric rejects `___`/`1__2`/`12_`/`1.5`/overflow; `1_000` ok; optional throws on set-but-invalid.
  - BUG-4: empty `KEY=` → required throws, optional → default; `isEnvSet` still true.
  - WATCH-1/2: create-after-absent and delete-then-recreate both emit `updated`.
  - WATCH-3: many subscriptions, no max-listeners warning.
  - TIME-1: new overload matrix.
  - MOD-1: `disableDotEnv`, custom `envFilePath`, `.env` parsed once across two instances.
- **env-parser.utils.spec.ts** — PARSE-1: `$$`/`$&`/`` $` ``/`$'` survive interpolation; PARSE-2: single-quoted `${...}` preserved, double/unquoted still expand.
- **time-period.utils.spec.ts** — TIME-2: non-finite/negative rejected; ceil rounding asserted.

---

## 7. CHANGELOG — "Behavior changes" section (v1.2.0)

Draft to include verbatim-ish under a prominent heading (per D1):

> **⚠️ Behavior changes in v1.2.0** — this is a minor release but tightens several validation semantics. Review before upgrading.
> 1. **Empty variables are treated as unset.** `KEY=` (set-but-empty) now behaves like an absent variable: required getters throw "Missing…", optional getters return their default/`undefined`. (`isEnvSet('KEY')` still reports `true`.)
> 2. **Optional getters fail loudly on invalid values.** `getOptionalBooleanEnv` and `getOptionalNumericEnv` now **throw** when the variable is *present but invalid*, instead of silently returning the default (or `false`). They still fall back to the default only when the variable is absent/empty.
> 3. **`getOptionalEnv(name, allowedValues)` returns `undefined` when unset** instead of throwing.
> 4. **Numeric getters are stricter:** integer-only, underscores allowed only between digit groups, and values beyond the safe-integer range are rejected.
> 5. **`.env` single-quoted values are no longer variable-expanded** (matches dotenv); `${...}` inside single quotes is preserved literally.
> 6. **`.env` interpolation inserts values literally** — `$`, `$&`, `` $` ``, etc. in a referenced value are no longer interpreted as replacement patterns.
>
> **Additions (non-breaking):** `EnvGetterModule.forRoot({ configBaseDir, envFilePath, disableDotEnv })` and matching `AppConfigModule` options; `getOptionalTimePeriod(name)` (no-default) overload; `CronSchedule` now validates its input on construction; optional config files that are absent at startup (or deleted) are now watched and recover on (re)creation.

---

## 8. Out of scope / won't-fix (with rationale)

Validated by the audit's false-positive pass; recorded so they aren't re-investigated:

- **OIDC Trusted Publishing** — intentionally **not** adopted (D2); npm OIDC is broken, PAT rotated manually.
- **ReDoS** in cron/time-period/key regexes — measured linear (no overlapping nested quantifiers).
- **Prototype pollution (main object/config paths, `.env` keys)** — structurally mitigated (`deepSanitize`, `Object.create(null)`, unsafe-key filtering). Only the array gap (SEC-3) is fixed, as defense-in-depth.
- **SSRF / injection / SQL / shell / eval** — none exist; `new URL()` only parses, never fetches.
- **Weak crypto / insecure RNG / broken auth** — library has no crypto, randomness, or auth surface.
- **Committed example `.env` / `*-creds*.json`** — localhost dummies, excluded from the npm `files` whitelist; only TOOL-4 (placeholder header comment) applies.
- **CLI `bin/nestjs-env-getter.mjs`** — developer-invoked, operates on the local project, no untrusted input; no finding.

---

## 9. Definition of done

- [ ] All P1–P3 items implemented or explicitly deferred with a note.
- [ ] `yarn lint && yarn typecheck && yarn test` green; new tests in §6 added.
- [ ] `package.json` bumped to `1.2.0`; `engines` + `resolutions` added; `prebuild` cross-platform.
- [ ] All 6 workflow job files: actions SHA-pinned, Node 22; `publish.job.yml` carries the PAT-decision `TODO`.
- [ ] `yarn audit` shows dev advisories cleared (or documented residue); runtime tree still 0.
- [ ] README + JSDoc updated (TOOL-3); CHANGELOG "Behavior changes" section added (§7).
- [ ] Example placeholder headers added (TOOL-4).
