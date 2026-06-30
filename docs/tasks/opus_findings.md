Security Audit — nestjs-env-getter v1.1.3
Scope: src/** (library), bin/nestjs-env-getter.mjs (CLI), .github/workflows/**, examples/\*\*, package.json.
Standards: OWASP Top 10 (2021), MITRE CWE.
Methodology: Manual data-flow tracing from every entry point to sinks; sink sweep (child_process/eval/Function/dynamic require/crypto/Math.random — none present); empirical PoC validation of candidate findings under bounded execution.

Trust model (governs every rating below)
This is a configuration library. Its inputs are process.env, on-disk .env/JSON config files, and developer-supplied arguments (envName, filePath, validator cls). These are operator-controlled (trusted) in the normal threat model — an actor who can set env vars or write config files already has host-level capability. Consequently, "injection from env" style flags are not, by themselves, vulnerabilities here. The exception is the exported helper API (isValidCronExpression, CronSchedule, isTimePeriod, parseTimePeriod, the env-parser), which a downstream app may wire to genuinely untrusted (network) input. That is where the one real finding lives.

Findings
F1 — Denial of Service via unvalidated CronSchedule constructor
CWE ID & Risk Rating: CWE-835 (Loop with Unreachable Exit Condition) + CWE-1284 (Improper Validation of Quantity) | Severity: Medium contextually — CVSS 7.5 (High) AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H if untrusted cron strings reach the constructor.
Location: src/shared/utils/cron-schedule.utils.ts:235 (parseCronField, step branch ~L246–257 and range branch ~L259–271) and the public constructor cron-schedule.utils.ts:309. CronSchedule is exported from src/index.ts:20.
Vulnerability Mechanism: isValidCronField correctly rejects zero/negative steps (stepNum < 1, L33) and out-of-range ranges (L45). But parseCronField — invoked directly by the CronSchedule constructor, which performs no validation of its own despite the "must be pre-validated" JSDoc — omits both guards:
Infinite loop: new CronSchedule('_/0 _ \* \* _') → parseCronField('_/0', 0, 59) → stepNum = 0 → for (let i = 0; i < 60; i += 0) never advances. Confirmed empirically: index frozen at 0, capped at 1,000,000 iterations. The event loop hangs permanently.
Unbounded allocation: new CronSchedule('1-2000000000 \* \* \* \*') → range branch loops start..end with no clamp to max. Confirmed: 1-1000000 on a 0–59 field allocated a 1,000,000-element array; a larger bound OOM-crashes the process.
The library's own getRequiredCron/getOptionalCron call isValidCronExpression first and are not affected. Exploitation requires a consumer to construct CronSchedule directly from input that bypasses that validator (e.g., a scheduling UI that accepts a user cron string).
Remediation: Harden parseCronField (defense-in-depth) and make the constructor self-validating so the public type is safe regardless of caller discipline:
// cron-schedule.utils.ts — parseCronField, step branch
const stepMatch = /^(.+)\/(\d+)$/.exec(field);
if (stepMatch) {
const base = stepMatch[1] as string;
const stepNum = parseInt(stepMatch[2] as string, 10);
if (!Number.isInteger(stepNum) || stepNum < 1) return []; // reject 0/negative steps
const baseValues = parseCronField(base, min, max);
const result: number[] = [];
for (let i = 0; i < baseValues.length; i += stepNum) {
result.push(baseValues[i] as number);
}
return result;
}

// parseCronField, range branch
const rangeMatch = /^(\d+)-(\d+)$/.exec(field);
if (rangeMatch) {
  const startNum = parseInt(rangeMatch[1] as string, 10);
  const endNum = parseInt(rangeMatch[2] as string, 10);
  if (startNum < min || endNum > max || startNum > endNum) return []; // enforce bounds
  const result: number[] = [];
  for (let i = startNum; i <= endNum; i++) result.push(i);
  return result;
}
// CronSchedule constructor — validate instead of trusting the contract
constructor(expression: string) {
  if (!isValidCronExpression(expression)) {
    throw new Error(`Invalid cron expression: '${expression}'`);
}
this.expression = expression.trim();
// ...unchanged
}
(isValidCronExpression lives in the same module — no import cycle.)

F2 — Stack trace / raw error embedded in thrown & logged messages
CWE ID & Risk Rating: CWE-209 (Information Exposure Through an Error Message) | Severity: Low — CVSS 3.3 AV:L/AC:L/PR:L/UI:N/S:U/C:L/I:N/A:N.
Location: src/env-getter/env-getter.service.ts:487 (new Error().stack interpolated into the message) and getErrorMessage at env-getter.service.ts:742 (JSON.stringify(error)).
Vulnerability Mechanism: On a misused validator, getRequiredArray throws/console.errors a message containing a full stack trace (absolute paths, internal frames). getErrorMessage JSON-stringifies arbitrary thrown values, potentially serializing object internals. Impact is bounded: these fire at config-load time, server-side, to stderr/logs — there is no remote attacker channel. It is a hardening item, not an exploitable path.
Remediation: Drop the stack from the user-facing message; keep diagnostics behind a debug flag.
if (!["boolean", "string"].includes(typeof result) || result === "")
this.stopProcess(
`The validation func of EnvGetterService.getRequiredArray('${envName}') must return a boolean or non-empty string.`,
);
F3 — Prototype-pollution hardening is not applied uniformly
CWE ID & Risk Rating: CWE-1321 (Prototype Pollution) | Severity: Informational (defense-in-depth; not currently exploitable).
Location: src/env-getter/env-getter.service.ts:472 — getRequiredArray calls JSON.parse(envVal) with no deepSanitize, unlike getRequiredObject (L427) and the config-file path (L837).
Vulnerability Mechanism: Not a live sink — JSON.parse('[{"__proto__":{…}}]') creates **proto** as an own property and the library never deep-merges array contents into another object, so Object.prototype is never reached. It is flagged only because the surrounding code is otherwise consistently hardened (deepSanitize, Object.create(null), isUnsafeKey), and the asymmetry could become a real sink if a future change merges parsed arrays. Apply the same guard for consistency.
Remediation: parsedArray = this.deepSanitize(JSON.parse(envVal));
F4 — filePath is resolved without confinement
CWE ID & Risk Rating: CWE-22 (Path Traversal) | Severity: Informational (by design; consumer-side guidance).
Location: resolveFilePath at src/env-getter/env-getter.service.ts:794, used by getRequiredConfigFromFile/getOptionalConfigFromFile.
Vulnerability Mechanism: filePath is taken as-is (isAbsolute ? filePath : join(cwd, filePath)). This is the correct contract for a developer-supplied path, identical to fs.readFileSync. It only becomes a vulnerability if a consumer forwards untrusted input as filePath (arbitrary file read). No fix needed in the library; document the constraint.
Remediation: Add to the JSDoc/README: "filePath must never be derived from untrusted input." Optionally offer an opt-in baseDir to confine resolution (const p = resolve(baseDir, filePath); if (!p.startsWith(resolve(baseDir) + sep)) throw …).
False-Positive Elimination Pass
I actively tested and discarded the following so they are not reported as findings:

ReDoS (CWE-1333): Hypothesized catastrophic backtracking in the cron step regex ^(.+)\/(\d+)$ (cron-schedule.utils.ts:28) and timePeriodStringRegex (time-period.utils.ts:10). Measured: 0.1 ms on a 32,000-char adversarial input — linear, not super-linear. The quantifiers are non-overlapping; V8 evaluates them in linear time. No ReDoS.
Prototype pollution (main paths): Genuinely mitigated — deepSanitize strips **proto**/constructor/prototype recursively, configs are built on Object.create(null), and new cls(parsedObj) receives already-sanitized input. Verified the **proto**, nested-**proto**, and constructor.prototype payloads are neutralized. Not reported.
Injection / Broken Auth / SSRF: No SQL, no shell, no eval/Function, no dynamic require, no outbound HTTP. new URL() only parses/validates (never fetches). The library has no authentication surface. N/A.
Weak crypto / insecure RNG (CWE-327/CWE-338): The library uses no cryptography and no Math.random. N/A.
Hardcoded secrets (CWE-798): The example mongo URIs are mongodb://localhost… with no real credentials; example.env contains obviously-fake placeholders (user:pass, truncated PRIVATE_KEY). The example even masks passwords in logs (mongo-connection.service.ts:83). No real secrets committed.
CI secret handling: publish.job.yml consumes secrets.NPM_REGISTRY_PAT via NODE_AUTH_TOKEN env, uses --provenance + id-token: write, and pins actions to major versions. Correct. N/A.
CLI: bin/nestjs-env-getter.mjs is developer-invoked, uses only fs (no shell), and operates on the local project. Its regexes (import[^;]+;, the imports-array matcher) run on the developer's own source. No finding.
Supply-Chain Integrity
Strong posture. "dependencies": {} — zero runtime dependencies, so consumers inherit no transitive supply-chain risk from this package. peerDependencies is just @nestjs/common >=9. devDependencies are exact-pinned; yarn.lock covers dev tooling only (not shipped). No obsolete/abandoned runtime packages to flag. If you'd like, I can run yarn npm audit / OSV against the dev lockfile, but it does not affect installed consumers.

Positive controls worth keeping
Prototype-pollution defenses, Object.create(null) storage, strict numeric/boolean/URL validation, watcher cleanup in onModuleDestroy, no-override env semantics, and npm provenance on publish.

Security Audit — nestjs-env-getter v1.1.3 - another try
Scope: src/** (shipped library), bin/nestjs-env-getter.mjs (CLI), package.json / yarn.lock, .github/workflows/**. Examples and test fixtures reviewed for committed secrets.
Posture summary: This is a configuration-loading library with zero runtime dependencies, no network I/O, no crypto, no auth, and no request-facing sinks. Its trust boundary is the operator (env vars, local config files), not end users — which eliminates entire OWASP classes by construction (verified below). The maintainers clearly thought about prototype pollution and largely neutralized it. The valid findings are: secret fragments leaking into error messages/logs, a credential-corrupting interpolation bug, fail-open validation semantics in typed getters, one gap in the pollution defenses, and CI/CD supply-chain hardening items. Nothing critical.

Finding 1 — Secret fragments inserted into logs and error events on JSON parse failure
CWE ID & Risk Rating: CWE-532 (Insertion of Sensitive Information into Log File) / CWE-209 (Error Message Information Exposure) | Severity: Medium (CVSS 3.1 ≈ 5.5, AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N)
Location: env-getter.service.ts:427-429 (getRequiredObject), env-getter.service.ts:472-474 (getRequiredArray), env-getter.service.ts:836-844 (readAndParseConfigFile), propagating through stopProcess:751-755 (console.error + thrown Error) and the watcher's error:<path> events at env-getter.service.ts:1000-1006.
Vulnerability Mechanism: On Node ≥ 20, V8's JSON.parse SyntaxError messages embed a raw fragment of the input. Verified on this machine (Node v26): JSON.parse('{"pass": SuperSecretValue123}') → Unexpected token 'S', "{"pass": SuperSecre"... is not valid JSON. The exact payloads fed to these parse sites are, by this library's own documented purpose, credentials — getRequiredObject('DB_CREDS'), mongo-creds.json with a connectionString (the hot-reload "Vault agent flow" the code explicitly supports). A malformed secret — most realistically a partially-written file during Vault rotation that lands outside the 350 ms debounce, or an operator quoting mistake — causes the fragment to be (a) printed to console.error, (b) embedded in the thrown Error (boot logs, exception trackers), and (c) shipped in ConfigErrorEvent.error to consumer code, which typically logs it. Centralized log pipelines (CloudWatch, Datadog, Loki) then persist the secret fragment with broader read access than the secret itself. Related lower-risk echo: checkIfEnvHasAllowedValue:783 prints the received value verbatim (but received '${envVal}'); allowed-values are normally enums, but the API doesn't prevent use with sensitive vars.
Remediation: Strip the V8 input fragment, keep only positional info. Add one private helper and use it at all three JSON catch sites:
/\*\*

- V8 JSON.parse errors embed a fragment of the raw input
- (e.g. `Unexpected token 'S', ..."{"pass": SuperSecre"... is not valid JSON`).
- Config payloads are frequently credentials, so only position info may be logged.
  \*/
  private sanitizeJsonError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const position = /at position (\d+)(?: \(line (\d+) column (\d+)\))?/.exec(message);
  if (position?.[2]) return `Invalid JSON at line ${position[2]}, column ${position[3]}`;
  return position ? `Invalid JSON at position ${position[1]}` : "Invalid JSON";
  }
  In getRequiredObject (same pattern in getRequiredArray):

try {
parsedObj = this.deepSanitize(JSON.parse(envVal));
} catch (error: unknown) {
this.stopProcess(`${baseErrorMessage} ${this.sanitizeJsonError(error)}`);
}
In readAndParseConfigFile — note the rethrow must also be sanitized, because that err is what reaches the watcher's error:<path> event:

let parsedConfig: Record<string, unknown>;
try {
parsedConfig = this.deepSanitize(JSON.parse(fileContent));
} catch (error: unknown) {
const safeMessage = `${baseErrorMessage} ${this.sanitizeJsonError(error)}`;
if ((isInitialLoad || breakOnError) && !isOptional) {
this.stopProcess(safeMessage);
}
throw new Error(safeMessage);
}
Finding 2 — $-pattern expansion corrupts interpolated secrets in .env parsing
CWE ID & Risk Rating: CWE-116 (Improper Encoding or Escaping of Output) / CWE-20 | Severity: Low–Medium (CVSS 3.1 ≈ 4.0, AV:L/AC:H/PR:L/UI:N/S:U/C:L/I:L/A:L — silent integrity corruption of credentials)
Location: env-parser.utils.ts:145 — result = result.replace(fullMatch, replacement);
Vulnerability Mechanism: String.prototype.replace interprets special patterns in the replacement string even when the search pattern is a plain string: $$ → $, $& → the match, $` → text before the match, $' → text after the match. Verified on this machine: 'x ${GREET} y'.replace('${GREET}', 'pre-$&-post') yields x pre-${GREET}-post y. Concretely: .env containing DB_PASS='pa$$w0rd' and DB_URL=postgres://app:${DB_PASS}@db:5432/main produces DB_URL with password pa$w0rd — the app authenticates with a wrong credential, silently, and $'/$` sequences splice adjacent connection-string text into the secret. $ is common in generated passwords, so this fires in realistic deployments and manifests as unexplainable auth failures (or, worse, values containing duplicated surrounding content propagated to downstream systems). A second deviation amplifies exposure: the interpolation pass at env-parser.utils.ts:367-382 runs on every variable, including single-quoted ones — dotenv convention is that single quotes suppress expansion, so a literal ${...} inside a single-quoted secret is unexpectedly rewritten.
Remediation: Use a function replacer — replacement strings passed via function are taken verbatim, with no $ processing:
result = result.replace(fullMatch, () => replacement);
Additionally, to restore standard dotenv semantics, track quote style in parseLine's return value and skip the expandVariables pass for values parsed from single-quoted literals.

Finding 3 — Fail-open validation semantics in typed getters
CWE ID & Risk Rating: CWE-20 (Improper Input Validation) | Severity: Low (CVSS 3.1 ≈ 3.9 — requires operator misconfiguration; impact is silent acceptance of wrong security-relevant values)
Location & Mechanism: Three confirmed cases in env-getter.service.ts:
Underscore-only numerics → 0 (lines 172-178, 190-196): /^[0-9_]+$/ accepts "\_***"; Number("".replace(...)) → verified to return 0. A garbled RATE_LIMIT or SESSION_TTL of * passes "validation" as zero — e.g., a rate limit of 0 or instant-expiry sessions — instead of failing fast. Similarly "1**2\_" is accepted (not valid numeric-separator syntax).
Case-sensitive boolean silently inverts (lines 225-227): getOptionalBooleanEnv("ENFORCE_TLS", true) with ENFORCE_TLS=TRUE returns false — the set-but-unparseable value doesn't throw (as getRequiredBooleanEnv and getOptionalURL both do) and doesn't fall back to the secure default; it returns the opposite of operator intent. This is the classic fail-open misconfiguration primitive for security toggles.
Empty string satisfies "required" (lines 766-770): checkEnvExisting only tests hasOwnProperty, so API_TOKEN= (set-but-empty, common in templated k8s manifests) passes getRequiredEnv and the app boots with an empty credential. Related inconsistency: getOptionalEnv uses ?? (empty string wins over default) while getOptionalBooleanEnv uses truthiness (empty string loses) — two different emptiness semantics in one API. getOptionalNumericEnv likewise swallows malformed values into the default with no signal.
Remediation:
getRequiredNumericEnv(envName: string): number {
const envVal = this.getRequiredEnv(envName);

// digits required; underscores only as separators between digit groups
if (!/^[0-9]+(?:\_[0-9]+)\*$/.test(envVal)) this.stopProcess(`Variable '${envName}' is not of number type.`);

return Number(envVal.replace(/\_/g, ""));
}

getOptionalNumericEnv(envName: string, defaultValue?: number): number | undefined {
const rawVal = process.env[envName];

if (rawVal === undefined || rawVal === "") return defaultValue;

if (!/^[0-9]+(?:\_[0-9]+)\*$/.test(rawVal))
    this.stopProcess(`Variable '${envName}' is set but is not of number type: received '${rawVal}'.`);

return Number(rawVal.replace(/\_/g, ""));
}

getOptionalBooleanEnv(envName: string, defaultValue?: boolean): boolean | undefined {
const envVal = process.env[envName];

if (envVal === undefined || envVal === "") return defaultValue;

if (!/^(true|false)$/i.test(envVal))
    this.stopProcess(`Variable '${envName}' is not of boolean type. Expected 'true' or 'false', received '${envVal}'.`);

return envVal.toLowerCase() === "true";
}

private checkEnvExisting(envName: string): boolean | never {
const value = process.env[envName];
if (value === undefined || value === "") this.stopProcess(`Missing '${envName}' environment variable`);
return true;
}
Throwing on set-but-invalid optional values matches the precedent this library already established in getOptionalURL and getOptionalTimePeriod. The checkEnvExisting change alters observable behavior for empty-set vars — document it as a breaking-ish patch or gate it behind an option, but empty-passes-required is the wrong default for a validation library.

Finding 4 — Prototype-pollution sanitizer not applied on the array path
CWE ID & Risk Rating: CWE-1321 (Prototype Pollution) — defense-in-depth gap | Severity: Low (CVSS 3.1 ≈ 3.0 — requires a subsequent unsafe merge in consumer code)
Location: env-getter.service.ts:472 — parsedArray = JSON.parse(envVal); in getRequiredArray.
Vulnerability Mechanism: The library treats **proto**/constructor/prototype in env-supplied JSON as hostile and scrubs them in getRequiredObject (line 427) and readAndParseConfigFile (line 837) — but getRequiredArray returns the raw parse. JSON.parse creates own **proto** properties (it bypasses the setter), so FORWARD_HEADERS='[{"__proto__":{"isAdmin":true}}]' yields array elements carrying pollution gadgets that detonate if the consumer later deep-merges or clones them with a vulnerable utility. Within this library's own threat model (it built deepSanitize precisely for this input class), the array path is an inconsistent application of its own control.
Remediation:
try {
parsedArray = this.deepSanitize(JSON.parse(envVal));
} catch (error: unknown) {
this.stopProcess(`${baseErrorMessage} ${this.sanitizeJsonError(error)}`);
}
deepSanitize already handles arrays recursively (lines 59-73), so this is a drop-in.

Finding 5 — CI/CD supply-chain hardening (publish pipeline)
CWE ID & Risk Rating: CWE-1357 (Reliance on Insufficiently Trustworthy Component) / CWE-829 | Severity: Low–Medium (pipeline risk; consumers of the published package are unaffected at runtime — dependencies: {})
Location: publish.job.yml, build.job.yml, install.job.yml, lint.job.yml, package.json:37-61, yarn.lock.
Vulnerability Mechanism / Findings:
Actions pinned by mutable tag (actions/checkout@v6, setup-node@v6, upload-artifact@v7, download-artifact@v8). A compromised or force-moved tag executes arbitrary code in the job that holds id-token: write and the npm token — the exact vector of the 2025 tj-actions/changed-files incident, applicable to any tag-referenced action.
Long-lived npm PAT (NPM_REGISTRY_PAT as NODE_AUTH_TOKEN). Any code execution in the publish job exfiltrates a durable publish credential.
EOL runtime in CI: every job runs node-version: "20"; Node 20 reached end-of-life 2026-04-30 (six weeks ago) and no longer receives security patches.
Dev-tree advisories: yarn audit against the lockfile: runtime dependencies 0 packages / 0 vulnerabilities (excellent); devDependency tree 126 findings (53 moderate, 73 high), all ReDoS-class advisories concentrated in transitive picomatch, minimatch, brace-expansion, fast-uri, ajv (via jest/eslint/nest-cli chains). Build-time exposure only, but these run inside the release pipeline.
Existing good controls worth preserving: --frozen-lockfile installs, npm publish --provenance, pull_request (not pull_request_target) with contents: read on the all-branches workflow, exact-pinned devDependency versions, Dependabot security updates active (per git history).
Remediation:
Pin every action to a full commit SHA, resolved from the official repo (do not copy SHAs from third-party sources):
gh api repos/actions/checkout/git/ref/tags/v6 --jq .object.sha

- uses: actions/checkout@<resolved-40-char-sha> # v6
  Enforce going forward with the actions/dependency-review-action or zizmor in CI.
  Replace the PAT with npm Trusted Publishing (OIDC): configure the GitHub repo/workflow as a trusted publisher on npmjs.com for nestjs-env-getter, then delete NPM_REGISTRY_PAT and the NODE_AUTH_TOKEN env from publish.job.yml — id-token: write is already present and npm publish --provenance --access public works unchanged (npm CLI ≥ 11.5).
  Bump all node-version fields to "22" (active LTS) and add "engines": { "node": ">=20" } to package.json so consumers get an explicit floor.
  Refresh transitive pins: with Yarn 1, add a resolutions block for the five flagged packages at their patched versions (all are mainstream, well-vetted libraries), or run a lockfile-wide upgrade and re-audit.
  Informational (no formal finding)
  Implicit .env load from CWD (env-getter.service.ts:84): the service constructor silently loads ./.env on every instantiation with no opt-out (CWE-426 flavor). Risk is materially mitigated by override=false (real environment always wins), matching dotenv's accepted model — but consider a constructor/module option to disable or redirect it, and note that each EnvGetterService instantiation re-reads the file.
  Committed .env and "creds" files in examples/ (examples/nestjs-server/.env, configs/mongo-creds-*.json): all values are localhost placeholders (postgres://user:pass@localhost, a truncated fake RSA block) — not live secrets. Examples are excluded from the npm package (files whitelist). Acceptable as documentation; a # placeholder values — never commit a real .env header would make the teaching pattern explicit.
  False-Positive Elimination Pass (checked and discarded)
  Candidate Why eliminated
  Prototype pollution via env/config JSON objects Neutralized structurally: deepSanitize, Object.create(null) storage, and unsafe-key filtering at every object path (env-getter.service.ts:33-73, 871-880). Only the array gap (Finding 4) survives, as defense-in-depth.
  Prototype pollution via .env keys **proto** passes KEY_REGEX, but assigning a string through the inherited **proto** setter is a JS no-op — no own property is created, nothing for Object.assign to copy. Verified semantics; no path to pollution.
  SSRF (OWASP A10) The library performs zero outbound requests. getRequiredURL only constructs URL objects from operator-set values; no fetch sink exists.
  Injection (OWASP A03) No SQL/command/eval/template sinks anywhere. The CLI rewrites app.module.ts via regex, but only on explicit local invocation against the developer's own cwd — no untrusted input crosses into it.
  URL value leaked in error messages Tested on Node v26: new URL(bad) message is exactly "Invalid URL" — input is not embedded on any Node ≥ 16.5 (the floor implied by @nestjs/common >=9).
  ReDoS in validators All regexes reviewed (KEY_REGEX, INTERPOLATION_REGEX, timePeriodStringRegex, cron field patterns): no overlapping nested quantifiers; cron recursion is bounded by field syntax. Linear behavior.
  Unhandled EventEmitter error crash Watcher failures emit namespaced error:<path> events, never the bare error event, so Node's throw-on-unhandled-error rule can't fire (env-getter.service.ts:978).
  Weak crypto / insecure randomness / broken auth (OWASP A02, A07) Not applicable — the codebase contains no cryptographic primitives, no randomness, and no authentication logic at all.
  Fork-PR workflow abuse all-branches.yml uses pull_request (not pull_request_target) with permissions: contents: read; fork PRs get no secrets.
  Hardcoded production credentials mongo-creds-prod.json and the example DATABASE_URL are localhost dummy values in non-published example/fixture directories (see Informational).
  mock.ts / test files shipped to npm tsconfig.build.json excludes test, \*\*/*spec.ts, \**/*mock.ts; package files whitelists only dist, bin, the .example template, and CHANGELOG.md.

ANOTHER FINDINGS:
Summary

# Type Severity Location

B1 Bug — "optional" env throws when unset High getOptionalEnv
B2 Bug — boolean env silently mis-parses High getOptionalBooleanEnv
B3 Bug — numeric validator accepts "\_\_\_", overflows Medium getRequired/OptionalNumericEnv
I1 Inconsistency — required=strict, optional=silent Medium getter family
I2 Inconsistency — no undefined-returning time-period Low getOptionalTimePeriod
I3 Inconsistency — array parse skips deepSanitize Low getRequiredArray
E1 Edge — $ in interpolated value corrupts output Medium env-parser
E2 Edge — initially-absent optional config never watched Medium getOptionalConfigFromFile
E3 Edge — file delete stops the watcher Low setupFileWatcher
E4–E7 Edge — emitter limit, Math.ceil, # truncation Low various
T1–T3 Polish — Windows rm -rf, overload ambiguity, doc drift Low tooling
Confirmed correctness bugs
B1 — getOptionalEnv(name, allowedValues) throws when the variable is unset
env-getter.service.ts:148. The "optional + allowed-values, no default" overload is documented as returning string | undefined when unset, but the implementation calls checkIfEnvHasAllowedValue(envName, envValue ?? null, …), and that helper rejects null (L781). So getOptionalEnv('UNSET', ['a','b']) hard-fails — making an "optional" var effectively required. The test suite only covers unset without allowedValues (spec L92), so this path is untested.

if (Array.isArray(defaultValueOrAllowedValues)) {
const envValue = process.env[envName];
// only enforce the allow-list when a value is actually present
if (envValue !== undefined) {
this.checkIfEnvHasAllowedValue(envName, envValue, defaultValueOrAllowedValues);
}
return envValue;
}
B2 — getOptionalBooleanEnv silently mis-parses
env-getter.service.ts:225: return process.env[envName] ? process.env[envName] === "true" : defaultValue;

Two problems: (1) any non-"true" value — "TRUE", "1", "yes", or a typo — silently becomes false; (2) an explicitly empty KEY= (which the README says is a set-but-empty string) is falsy, so it returns the default instead of false. The required variant validates strictly (/^(true|false)$/, errors otherwise), so the two are inconsistent — and a mistyped feature flag silently turns the feature off, the exact failure a config library should prevent.

getOptionalBooleanEnv(envName: string, defaultValue?: boolean): boolean | undefined {
const raw = process.env[envName];
if (raw === undefined) return defaultValue; // absent → default
if (raw !== "true" && raw !== "false") // present but invalid → loud failure
this.stopProcess(`Variable '${envName}' is not of boolean type.`);
return raw === "true";
}
B3 — numeric validator accepts pathological inputs
env-getter.service.ts:175 (and getOptionalNumericEnv at L195) use /^[0-9_]+$/, which accepts:

"***" → Number("") → 0 (all-underscores passes)
"\_1*", "1**2", "12\_" (underscores anywhere)
very long digit strings → silent precision loss / Infinity
Also note both are integer-only ("1.5" fails) — undocumented. Tighter validation:

const NUMERIC = /^\d(?:_?\d)\*$/;                        // digit-grouped underscores only
if (!NUMERIC.test(envVal)) this.stopProcess(`Variable '${envName}' is not of number type.`);
const n = Number(envVal.replace(/_/g, ""));
if (!Number.isSafeInteger(n)) this.stopProcess(`Variable '${envName}' exceeds the safe integer range.`);
return n;
API inconsistencies
I1 — strict-vs-lenient asymmetry (the theme behind B1/B2). Required getters hard-fail on malformed input; optional getters swallow it. getOptionalNumericEnv silently returns the default when PORT=abc; getOptionalBooleanEnv silently coerces. Recommended rule across the whole family: fall back to the default only when the variable is absent; when it is present but invalid, fail as loudly as the required variant. That keeps "optional" meaning "may be omitted," not "may be wrong."

I2 — no truly-optional time period. getOptionalCron(name) returns undefined when unset, but getOptionalTimePeriod requires defaultValue: string (L304) — there's no (name) => number | undefined overload. Inconsistent ergonomics vs cron/url/numeric.

I3 — getRequiredArray skips deepSanitize (L472) while getRequiredObject (L427) and file parsing (L837) apply it. Same point as F3 in the security pass — apply for consistency: parsedArray = this.deepSanitize(JSON.parse(envVal));

Robustness / edge cases
E1 — interpolation corrupts values containing $. env-parser.utils.ts:145: result = result.replace(fullMatch, replacement). String.replace treats $&, $1, $` etc. in the replacement string as special. If a referenced var's value contains those (common in generated secrets/tokens), the output is mangled. Use a function replacer so the value is inserted literally:

result = result.replace(fullMatch, () => replacement);
E2 — an initially-absent optional config is never watched. In getOptionalConfigFromFile, when the file is missing at call time the code returns the default with event methods attached but sets up no watcher (L631–659). If the file appears later (e.g. a secret mounted post-boot), no updated event ever fires and the attached .on() is dead. Either watch the parent directory for creation, or document "the file must exist at startup to be watched."

E3 — a file delete stops watching. env-getter.service.ts:971: on delete the watcher emits error and returns without re-establishing. Atomic replace (Vault-style) is handled by the success-path re-establish, but plain delete-then-recreate isn't — fs.watch loses the inode and goes silent. Worth documenting the supported replacement semantics.

E4–E7 (minor):

E5 All configs share one EventEmitter; >10 subscriptions trip MaxListenersExceededWarning. Consider this.events.setMaxListeners(0).
E6 parseTimePeriod uses Math.ceil (time-period.utils.ts:45) — 1500ms→s gives 2. And isTimePeriod(number) is unconditionally true, so NaN/negative/Infinity pass through. Document rounding; reject non-finite/negative.
E7 Unquoted PASSWORD=ab#cd truncates to ab (dotenv-compatible, but a silent-secret footfun) — the README mentions empty values but should also flag #.
Tooling / packaging / docs
T1 prebuild: "rm -rf dist" (package.json:28) breaks on Windows. Use the rimraf/node -e "fs.rmSync(...)" form.
T2 getOptionalConfigFromFile discriminates cls vs defaultValue by typeof === "function" — a function-typed default would be misread as a class. Niche; guard or document "defaults must be data."
T3 Doc drift: README's getOptionalEnv(name, default?, allowed?) contract doesn't match the unset+allowed behavior (B1); numeric getters' integer-only nature is undocumented. Aligning after B1/B3 closes the gap.
