#!/usr/bin/env node

import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const COMMANDS = {
  HELP: new Set(["help", "--help", "-h"]),
  INIT: new Set(["init", "i"]),
};

const MODULE_PREFIX = "[nestjs-env-getter]";
const PACKAGE_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * Prints an informational message prefixed with the package tag.
 * @param {string} message - The message to print.
 */
function logInfo(message) {
  console.log(`${MODULE_PREFIX} ${message}`);
}

/**
 * Prints an error message prefixed with the package tag.
 * @param {string} message - The message to print.
 */
function logError(message) {
  console.error(`${MODULE_PREFIX} ${message}`);
}

/**
 * Displays the CLI usage help in the console.
 */
function printHelp() {
  logInfo("Usage: nestjs-env-getter <command>");
  console.log("");
  console.log("Commands:");
  console.log("  help              Show this help.");
  console.log("  init | i          Scaffold AppConfig integration in the current project.");
}

/**
 * Resolves the project paths that will be used by the CLI.
 * @param {string} cwd - Current working directory.
 * @returns {{ cwd: string, srcDir: string, appModulePath: string, appConfigPath: string, templateConfigPath: string }} Resolved paths.
 */
function resolveProjectPaths(cwd) {
  const srcDir = join(cwd, "src");
  return {
    cwd,
    srcDir,
    appModulePath: join(srcDir, "app.module.ts"),
    appConfigPath: join(srcDir, "app.config.ts"),
    templateConfigPath: join(PACKAGE_DIR, "..", "src", "app-config", "app.config.ts.example"),
  };
}

/**
 * Ensures that the NestJS project has the expected structure.
 * @param {ReturnType<typeof resolveProjectPaths>} paths - Resolved project paths.
 */
function ensureSrcAndAppModule(paths) {
  if (!existsSync(paths.srcDir)) {
    logError('Unable to find "src" directory in the current working directory.');
    process.exit(1);
  }

  if (!existsSync(paths.appModulePath)) {
    logError('Unable to find "src/app.module.ts". Are you in a NestJS project root?');
    process.exit(1);
  }
}

/**
 * Copies the template config file if it does not exist.
 * @param {ReturnType<typeof resolveProjectPaths>} paths - Resolved project paths.
 * @returns {boolean} True when a new config file is created.
 */
function ensureAppConfigFile(paths) {
  if (existsSync(paths.appConfigPath)) {
    logInfo("Skipped creating src/app.config.ts because it already exists.");
    return false;
  }

  if (!existsSync(paths.templateConfigPath)) {
    logError("Template config file is missing inside nestjs-env-getter package.");
    process.exit(1);
  }

  copyFileSync(paths.templateConfigPath, paths.appConfigPath);
  logInfo("Created src/app.config.ts based on the package template.");
  return true;
}

/**
 * Ensures the app.module.ts file wires up the AppConfigModule.
 * @param {ReturnType<typeof resolveProjectPaths>} paths - Resolved project paths.
 * @returns {boolean} True when the module file is updated.
 */
function updateAppModule(paths) {
  const content = readFileSync(paths.appModulePath, "utf8");

  if (/AppConfigModule\.forRoot/.test(content) || /AppConfigModule\.forRootAsync/.test(content)) {
    logInfo("Detected existing AppConfigModule setup in app.module.ts. No changes applied.");
    return false;
  }

  let updated = content;

  updated = ensureAppConfigModuleImport(updated);
  updated = ensureAppConfigImport(updated);
  updated = insertConfigModuleCall(updated);

  writeFileSync(paths.appModulePath, updated, "utf8");
  logInfo("Updated src/app.module.ts with AppConfigModule.forRoot(AppConfig).");
  return true;
}

/**
 * Ensures the AppConfigModule import exists.
 * @param {string} source - File contents.
 * @returns {string} Updated source.
 */
function ensureAppConfigModuleImport(source) {
  const importRegex = /import\s+{([^}]+)}\s+from\s+["']nestjs-env-getter["'];?/;
  const match = source.match(importRegex);

  if (match) {
    const imports = match[1]
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (!imports.includes("AppConfigModule")) {
      imports.push("AppConfigModule");
      const uniqueImports = Array.from(new Set(imports));
      const replacement = `import { ${uniqueImports.join(", ")} } from 'nestjs-env-getter';`;
      return source.replace(importRegex, replacement);
    }

    return source;
  }

  const lastImportIndex = findLastImportIndex(source);
  const importLine = "import { AppConfigModule } from 'nestjs-env-getter';\n";
  if (lastImportIndex === -1) {
    return `${importLine}${source}`;
  }

  return `${source.slice(0, lastImportIndex)}${importLine}${source.slice(lastImportIndex)}`;
}

/**
 * Ensures the AppConfig import exists.
 * @param {string} source - File contents.
 * @returns {string} Updated source.
 */
function ensureAppConfigImport(source) {
  const appConfigImportRegex = /import\s+{[^}]*AppConfig[^}]*}\s+from\s+["'][^"']*app\.config["'];?/;
  if (appConfigImportRegex.test(source)) {
    return source;
  }

  const lastImportIndex = findLastImportIndex(source);
  const importLine = "import { AppConfig } from './app.config';\n";

  if (lastImportIndex === -1) {
    return `${importLine}${source}`;
  }

  return `${source.slice(0, lastImportIndex)}${importLine}${source.slice(lastImportIndex)}`;
}

/**
 * Finds the index immediately after the last import statement.
 * @param {string} source - File contents.
 * @returns {number} Index of the last import, or -1 when not found.
 */
function findLastImportIndex(source) {
  const importMatches = [...source.matchAll(/import[^;]+;\s*/g)];
  if (importMatches.length === 0) {
    return -1;
  }

  const lastMatch = importMatches[importMatches.length - 1];
  return lastMatch.index + lastMatch[0].length;
}

/**
 * Injects the AppConfigModule.forRoot call at the top of the module imports array.
 * @param {string} source - File contents.
 * @returns {string} Updated source.
 */
function insertConfigModuleCall(source) {
  const openMatch = /imports\s*:\s*\[/.exec(source);
  const openIndex = openMatch ? openMatch.index + openMatch[0].length - 1 : -1;
  const closeIndex = openIndex === -1 ? -1 : findMatchingBracket(source, openIndex);

  if (closeIndex === -1) {
    logError("Could not locate the imports array in app.module.ts to add AppConfigModule.");
    process.exit(1);
  }

  const lineStart = source.lastIndexOf("\n", openMatch.index) + 1;
  const lineIndent = /^[ \t]*/.exec(source.slice(lineStart))[0];
  const entryIndent = `${lineIndent}  `;
  const entry = "AppConfigModule.forRoot(AppConfig),";
  const inner = source.slice(openIndex + 1, closeIndex);

  let newInner;
  if (inner.trim() === "") {
    newInner = `\n${entryIndent}${entry}\n${lineIndent}`;
  } else if (inner.includes("\n")) {
    newInner = `\n${entryIndent}${entry}${inner}`;
  } else {
    newInner = `${entry} ${inner.trimStart()}`;
  }

  return `${source.slice(0, openIndex + 1)}${newInner}${source.slice(closeIndex)}`;
}

/**
 * Finds the `]` that closes the `[` at `openIndex`, skipping brackets inside strings and comments.
 * @param {string} source - File contents.
 * @param {number} openIndex - Index of the opening `[`.
 * @returns {number} Index of the matching `]`, or -1 when the array is unterminated.
 */
function findMatchingBracket(source, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      i = skipString(source, i, ch);
    } else if (ch === "/" && source[i + 1] === "/") {
      const newline = source.indexOf("\n", i);
      i = newline === -1 ? source.length : newline;
    } else if (ch === "/" && source[i + 1] === "*") {
      const commentEnd = source.indexOf("*/", i + 2);
      i = commentEnd === -1 ? source.length : commentEnd + 1;
    } else if (ch === "[") {
      depth++;
    } else if (ch === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Returns the index of the closing quote of the string literal starting at `start`.
 * @param {string} source - File contents.
 * @param {number} start - Index of the opening quote.
 * @param {string} quote - The quote character.
 * @returns {number} Index of the closing quote (or the end of the source).
 */
function skipString(source, start, quote) {
  for (let i = start + 1; i < source.length; i++) {
    if (source[i] === "\\") {
      i++;
    } else if (source[i] === quote) {
      return i;
    }
  }
  return source.length;
}

/**
 * Executes the init command workflow.
 */
function runInitCommand() {
  const paths = resolveProjectPaths(process.cwd());

  ensureSrcAndAppModule(paths);
  const createdConfig = ensureAppConfigFile(paths);
  const updatedModule = updateAppModule(paths);

  if (!createdConfig && !updatedModule) {
    logInfo("No changes were necessary. Project already configured.");
  }
}

/**
 * CLI entrypoint.
 */
function run() {
  const [, , rawCommand] = process.argv;

  if (!rawCommand || COMMANDS.HELP.has(rawCommand)) {
    printHelp();
    return;
  }

  if (COMMANDS.INIT.has(rawCommand)) {
    runInitCommand();
    return;
  }

  logError(`Unknown command: ${rawCommand}`);
  printHelp();
  process.exit(1);
}

run();
