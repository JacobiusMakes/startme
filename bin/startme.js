#!/usr/bin/env node

/**
 * startme — Auto-generate AI-readable codebase orientation files.
 *
 * One scan, one file, any model.
 *
 * Usage:
 *   npx startme                  # scan cwd, print to stdout
 *   npx startme --write          # write STARTME.txt to project root
 *   npx startme --section        # output as AGENTS.md / CLAUDE.md section
 *   npx startme /path/to/project # scan a specific directory
 *   npx startme --all /parent    # scan all subdirectories
 */

import { resolve, join, basename } from 'node:path';
import { writeFileSync, readdirSync, statSync } from 'node:fs';
import { scanProject } from '../lib/scanner.js';
import { generate, generateSection, estimateTokens } from '../lib/generator.js';

const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith('--')));
const paths = args.filter(a => !a.startsWith('--'));
const targetDir = paths[0] ? resolve(paths[0]) : process.cwd();

// ── Colors ──
const c = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  green: '\x1b[32m', cyan: '\x1b[36m', yellow: '\x1b[33m',
};

if (flags.has('--help') || flags.has('-h')) {
  console.log(`${c.bold}startme${c.reset} — AI-readable codebase orientation generator\n`);
  console.log('Usage:');
  console.log('  npx startme                  Scan cwd, print to stdout');
  console.log('  npx startme --write          Write STARTME.txt to project root');
  console.log('  npx startme --section        Output as AGENTS.md section');
  console.log('  npx startme --all <dir>      Scan all subdirectories');
  console.log('  npx startme --json           Output raw scan data as JSON');
  console.log('  npx startme <path>           Scan a specific directory');
  process.exit(0);
}

if (flags.has('--all')) {
  // Scan all subdirectories
  const parent = targetDir;
  console.error(`${c.bold}startme${c.reset} scanning ${parent}...\n`);

  const entries = readdirSync(parent, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules');

  let totalTokens = 0;

  for (const entry of entries) {
    const dir = join(parent, entry.name);
    // Skip if no manifest file
    const hasManifest = ['package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod', 'Makefile', 'Dockerfile']
      .some(f => { try { statSync(join(dir, f)); return true; } catch { return false; } });

    if (!hasManifest) continue;

    const scan = scanProject(dir);
    const output = generate(scan);
    const tokens = estimateTokens(output);
    totalTokens += tokens;

    if (flags.has('--write')) {
      writeFileSync(join(dir, 'STARTME.txt'), output, { mode: 0o644 });
      console.error(`${c.green}  ${entry.name}${c.reset} → STARTME.txt (${tokens} tokens)`);
    } else {
      console.log(`${'═'.repeat(60)}`);
      console.log(`${c.bold}${entry.name}${c.reset}`);
      console.log(`${'─'.repeat(60)}`);
      console.log(output);
    }
  }

  console.error(`\n${c.dim}Total: ${entries.length} projects, ~${totalTokens} tokens${c.reset}`);
  process.exit(0);
}

// ── Single project scan ──
const scan = scanProject(targetDir);

if (flags.has('--json')) {
  console.log(JSON.stringify(scan, null, 2));
  process.exit(0);
}

const output = flags.has('--section') ? generateSection(scan) : generate(scan);
const tokens = estimateTokens(output);

if (flags.has('--write')) {
  const outPath = join(targetDir, 'STARTME.txt');
  writeFileSync(outPath, output, { mode: 0o644 });
  console.error(`${c.green}Wrote${c.reset} ${outPath} (${tokens} tokens)`);
} else {
  console.log(output);
  console.error(`${c.dim}~${tokens} tokens${c.reset}`);
}
