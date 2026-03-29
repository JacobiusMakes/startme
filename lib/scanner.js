/**
 * Codebase Scanner — extracts orientation data from a project directory.
 *
 * Scans package.json, pyproject.toml, Dockerfile, Makefile, etc.
 * to understand what a project IS and how to run it.
 * Zero dependencies — uses only Node.js built-ins.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

/**
 * Scan a project directory and return structured orientation data.
 * @param {string} dir — project root
 * @returns {object} — orientation data
 */
export function scanProject(dir) {
  const result = {
    name: basename(dir),
    description: null,
    stack: [],
    commands: {},
    entryPoints: [],
    structure: [],
    env: [],
    ports: [],
    deps: { runtime: 0, dev: 0 },
  };

  // ── Package Managers / Manifests ──
  const pkg = tryReadJSON(join(dir, 'package.json'));
  const pyproject = tryReadTOML(join(dir, 'pyproject.toml'));
  const cargo = tryReadTOML(join(dir, 'Cargo.toml'));
  const gomod = tryReadFile(join(dir, 'go.mod'));

  if (pkg) {
    result.name = pkg.name || result.name;
    result.description = pkg.description || null;
    result.stack.push('node');
    if (pkg.type === 'module') result.stack.push('esm');

    // Scripts → commands
    if (pkg.scripts) {
      for (const [name, cmd] of Object.entries(pkg.scripts)) {
        if (['start', 'dev', 'build', 'test', 'lint', 'serve', 'watch', 'deploy', 'mcp', 'chat'].includes(name)) {
          result.commands[name] = cmd;
        }
      }
    }

    // Entry points
    if (pkg.main) result.entryPoints.push(pkg.main);
    if (pkg.bin) {
      const bins = typeof pkg.bin === 'string' ? { [pkg.name]: pkg.bin } : pkg.bin;
      for (const [name, path] of Object.entries(bins)) {
        result.entryPoints.push(`${name} → ${path}`);
      }
    }

    // Dep counts
    result.deps.runtime = Object.keys(pkg.dependencies || {}).length;
    result.deps.dev = Object.keys(pkg.devDependencies || {}).length;

    // Key deps worth mentioning
    const keyDeps = extractKeyDeps(pkg);
    if (keyDeps.length) result.stack.push(...keyDeps);
  }

  if (pyproject) {
    result.stack.push('python');
    const project = pyproject.project || pyproject.tool?.poetry || {};
    result.name = project.name || result.name;
    result.description = project.description || result.description;
  }

  if (cargo) {
    result.stack.push('rust');
    const cargoPkg = cargo.package || {};
    result.name = cargoPkg.name || result.name;
    result.description = cargoPkg.description || result.description;
  }

  if (gomod) {
    result.stack.push('go');
    const modLine = gomod.split('\n')[0];
    if (modLine.startsWith('module ')) result.name = modLine.replace('module ', '').trim();
  }

  // ── Dockerfile ──
  const dockerfile = tryReadFile(join(dir, 'Dockerfile'));
  if (dockerfile) {
    result.stack.push('docker');
    const exposeMatch = dockerfile.match(/EXPOSE\s+(\d+)/g);
    if (exposeMatch) {
      result.ports.push(...exposeMatch.map(e => e.replace('EXPOSE ', '')));
    }
    const cmdMatch = dockerfile.match(/CMD\s+(.+)/);
    if (cmdMatch) result.commands['docker-cmd'] = cmdMatch[1].trim();
  }

  // ── Docker Compose ──
  if (existsSync(join(dir, 'docker-compose.yml')) || existsSync(join(dir, 'docker-compose.yaml')) || existsSync(join(dir, 'compose.yml'))) {
    result.commands['compose'] = 'docker compose up';
    if (!result.stack.includes('docker')) result.stack.push('docker');
  }

  // ── Makefile ──
  const makefile = tryReadFile(join(dir, 'Makefile'));
  if (makefile) {
    const targets = makefile.match(/^([a-zA-Z_-]+):/gm);
    if (targets) {
      for (const t of targets.slice(0, 8)) {
        const name = t.replace(':', '');
        if (!['all', '.PHONY', '.DEFAULT'].includes(name)) {
          result.commands[`make ${name}`] = `make ${name}`;
        }
      }
    }
  }

  // ── Environment Variables ──
  const envFile = tryReadFile(join(dir, '.env.example')) || tryReadFile(join(dir, '.env.sample'));
  if (envFile) {
    const vars = envFile.split('\n')
      .filter(l => l.match(/^[A-Z_]+=/) && !l.startsWith('#'))
      .map(l => l.split('=')[0]);
    result.env = vars.slice(0, 15); // cap at 15
  }

  // ── Port Detection ──
  if (result.ports.length === 0) {
    // Scan common files for port numbers
    const portPatterns = scanForPorts(dir);
    result.ports = [...new Set(portPatterns)];
  }

  // ── Directory Structure (top-level only) ──
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '__pycache__' || entry.name === '.git') continue;
      if (entry.isDirectory()) {
        const subCount = countFiles(join(dir, entry.name));
        result.structure.push(`${entry.name}/ (${subCount} files)`);
      } else if (isImportantFile(entry.name)) {
        result.structure.push(entry.name);
      }
    }
  } catch {}

  // ── License ──
  if (existsSync(join(dir, 'LICENSE')) || existsSync(join(dir, 'LICENSE.md'))) {
    const licFile = tryReadFile(join(dir, 'LICENSE')) || tryReadFile(join(dir, 'LICENSE.md')) || '';
    if (licFile.includes('MIT')) result.stack.push('MIT');
    else if (licFile.includes('Apache')) result.stack.push('Apache-2.0');
    else if (licFile.includes('AGPL')) result.stack.push('AGPL-3.0');
  }

  return result;
}

// ── Helpers ──

function tryReadJSON(path) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return null; }
}

function tryReadTOML(path) {
  try {
    const raw = readFileSync(path, 'utf-8');
    // Minimal TOML parser — handles [section], key = "value", key = number
    const result = {};
    let section = result;
    let sectionName = '';
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || !trimmed) continue;
      const secMatch = trimmed.match(/^\[([^\]]+)\]/);
      if (secMatch) {
        sectionName = secMatch[1];
        const parts = sectionName.split('.');
        section = result;
        for (const p of parts) {
          section[p] = section[p] || {};
          section = section[p];
        }
        continue;
      }
      const kvMatch = trimmed.match(/^(\w+)\s*=\s*"([^"]*)"/);
      if (kvMatch) section[kvMatch[1]] = kvMatch[2];
      const kvNum = trimmed.match(/^(\w+)\s*=\s*(\d+)/);
      if (kvNum) section[kvNum[1]] = parseInt(kvNum[2]);
    }
    return result;
  } catch { return null; }
}

function tryReadFile(path) {
  try { return readFileSync(path, 'utf-8'); } catch { return null; }
}

function extractKeyDeps(pkg) {
  const all = { ...pkg.dependencies, ...pkg.devDependencies };
  const notable = [
    'express', 'fastify', 'koa', 'hapi', 'next', 'react', 'vue', 'svelte', 'angular',
    'prisma', 'sequelize', 'mongoose', 'typeorm', 'drizzle-orm',
    'jest', 'vitest', 'mocha', 'playwright', 'puppeteer', 'cypress',
    'typescript', 'esbuild', 'vite', 'webpack', 'rollup',
    'commander', 'yargs', 'inquirer',
    '@anthropic-ai/sdk', 'openai', '@modelcontextprotocol/sdk',
    'socket.io', 'ws', 'redis', 'ioredis', 'bull', 'bullmq',
    'sqlite3', 'better-sqlite3', 'pg', 'mysql2',
    'tailwindcss', 'styled-components',
  ];
  return notable.filter(d => d in all);
}

function scanForPorts(dir) {
  const ports = [];
  const files = ['src/index.js', 'src/index.ts', 'src/server.js', 'src/server.ts', 'src/app.js', 'src/app.ts', 'index.js', 'server.js', 'app.py', 'main.py'];
  for (const f of files) {
    const content = tryReadFile(join(dir, f));
    if (content) {
      const matches = content.match(/(?:port|PORT|listen)\s*[=(,:]\s*(\d{4,5})/g);
      if (matches) {
        for (const m of matches) {
          const num = m.match(/(\d{4,5})/);
          if (num) ports.push(num[1]);
        }
      }
    }
  }
  return ports;
}

function countFiles(dir) {
  try {
    let count = 0;
    const walk = (d) => {
      const entries = readdirSync(d, { withFileTypes: true });
      for (const e of entries) {
        if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === '__pycache__') continue;
        if (e.isFile()) count++;
        else if (e.isDirectory() && count < 500) walk(join(d, e.name));
      }
    };
    walk(dir);
    return count;
  } catch { return 0; }
}

function isImportantFile(name) {
  const important = [
    'Dockerfile', 'Makefile', 'Procfile', 'Jenkinsfile',
    'docker-compose.yml', 'docker-compose.yaml', 'compose.yml',
    'package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod',
    'tsconfig.json', '.env.example',
    'CLAUDE.md', 'AGENTS.md', 'README.md',
  ];
  return important.includes(name);
}
