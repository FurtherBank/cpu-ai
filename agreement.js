#!/usr/bin/env node

import { access, mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));

const agreements = {
  codex: {
    source: resolve(scriptDirectory, "../.codex/agreements/AGENTS.codex.md"),
    rulesDirectory: resolve(scriptDirectory, "rules"),
    target: resolve(homedir(), ".codex/AGENTS.md"),
  },
};

const usage = `Usage: node .codex/agreement.js [agent] [--check | --dry-run]

Synchronize the workspace agreement and every workspace rule to the selected agent's default AGENTS.md.

Agents:
  codex  Sync agreements/AGENTS.codex.md and rules/* to ~/.codex/AGENTS.md (default)

Options:
  --check    Exit non-zero if the target differs from the agreement.
  --dry-run  Report whether a write would occur without changing files.
  --help      Show this message.`;

function fail(message) {
  console.error(`agreement: ${message}`);
  process.exitCode = 1;
}

function parseArguments(args) {
  let agent = "codex";
  let mode = "sync";

  for (const argument of args) {
    if (argument === "--help" || argument === "-h") {
      console.log(usage);
      process.exit(0);
    }
    if (argument === "--check") {
      mode = "check";
      continue;
    }
    if (argument === "--dry-run") {
      mode = "dry-run";
      continue;
    }
    if (argument.startsWith("-")) {
      throw new Error(`unknown option: ${argument}`);
    }
    if (agent !== "codex") {
      throw new Error("only one agent may be specified");
    }
    agent = argument;
  }

  return { agent, mode };
}

async function readIfPresent(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function listRuleFiles(directory, relativeDirectory = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
    const absolutePath = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await listRuleFiles(absolutePath, relativePath));
    } else if (entry.isFile()) {
      files.push({ absolutePath, relativePath });
    }
  }

  return files;
}

async function buildDesiredContent({ source, rulesDirectory }) {
  await access(source, constants.R_OK);
  await access(rulesDirectory, constants.R_OK);

  const agreement = await readFile(source, "utf8");
  const ruleFiles = await listRuleFiles(rulesDirectory);
  const rules = await Promise.all(ruleFiles.map(async ({ absolutePath, relativePath }) => ({
    relativePath,
    content: await readFile(absolutePath, "utf8"),
  })));

  return rules.reduce(
    (content, { relativePath, content: rule }) => `${content.replace(/\n*$/, "")}\n\n<!-- Source: .codex/rules/${relativePath} -->\n\n${rule}`,
    agreement,
  );
}

async function syncAgreement({ source, rulesDirectory, target }, mode) {
  const desired = await buildDesiredContent({ source, rulesDirectory });
  const current = await readIfPresent(target);

  if (current === desired) {
    console.log(`Up to date: ${target}`);
    return;
  }

  if (mode === "check") {
    fail(`out of sync: ${target}`);
    return;
  }

  if (mode === "dry-run") {
    console.log(`Would sync: ${source} -> ${target}`);
    return;
  }

  await mkdir(dirname(target), { recursive: true });
  const temporaryTarget = `${target}.tmp-${process.pid}`;

  try {
    await writeFile(temporaryTarget, desired, "utf8");
    await rename(temporaryTarget, target);
  } finally {
    await unlink(temporaryTarget).catch((error) => {
      if (error.code !== "ENOENT") {
        throw error;
      }
    });
  }

  console.log(`Synced: ${source} -> ${target}`);
}

try {
  const { agent, mode } = parseArguments(process.argv.slice(2));
  const agreement = agreements[agent];

  if (!agreement) {
    throw new Error(`unknown agent: ${agent}. Available agents: ${Object.keys(agreements).join(", ")}`);
  }

  await syncAgreement(agreement, mode);
} catch (error) {
  fail(error.message);
}
