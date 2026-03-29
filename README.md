```
███████╗████████╗ █████╗ ██████╗ ████████╗███╗   ███╗███████╗
██╔════╝╚══██╔══╝██╔══██╗██╔══██╗╚══██╔══╝████╗ ████║██╔════╝
███████╗   ██║   ███████║██████╔╝   ██║   ██╔████╔██║█████╗
╚════██║   ██║   ██╔══██║██╔══██╗   ██║   ██║╚██╔╝██║██╔══╝
███████║   ██║   ██║  ██║██║  ██║   ██║   ██║ ╚═╝ ██║███████╗
╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝     ╚═╝╚══════╝

Auto-generated codebase orientation for AI.
One scan. One file. Any model.
```

# startme

> Stop letting AI waste tokens scanning your codebase. Give it the answer.

`startme` scans your project and generates a **STARTME.txt** — an ultra-compact orientation file that tells any AI assistant exactly what your project is, how to run it, and where everything lives. Under 50 lines, under 200 tokens. Works with Claude, GPT, Gemini, Codex, or anything else.

---

## The Problem

Every time an AI opens your codebase:

```
"Let me scan through the project structure to understand..."
"Looking at package.json..."
"Reading the README..."
"Checking the source directory..."
```

That's **5,000-50,000 tokens** burned on orientation. Every. Single. Session.

## The Solution

```bash
npx startme --write
```

Generates a `STARTME.txt` like this:

```
wade — AI screen automation with token-efficient capture.
Stack: node, commander, @anthropic-ai/sdk, @modelcontextprotocol/sdk

COMMANDS
  start: node bin/wade.js
  mcp: node src/mcp-server.js
  chat: node bin/wade-chat.js
  test: node --test 'test/**/*.test.js'

ENTRY POINTS
  wade → bin/wade.js
  wade-chat → bin/wade-chat.js

STRUCTURE
  bin/ (2 files)
  src/ (9 files)
  swift-bridge/ (2 files)
  test/ (4 files)

DEPS: 4 runtime, 0 dev
```

**~140 tokens.** The AI reads this one file and knows everything. No scanning.

---

## Usage

```bash
# Scan current directory, print to stdout
npx startme

# Write STARTME.txt to project root
npx startme --write

# Output as a section for AGENTS.md or CLAUDE.md
npx startme --section

# Scan a specific directory
npx startme /path/to/project

# Scan ALL projects in a parent directory
npx startme --all /path/to/projects

# Raw JSON output
npx startme --json
```

## Batch Mode

Scan every project on your drive at once:

```bash
npx startme --all ~/projects --write
```

Output:
```
  kalshi-betting-bot → STARTME.txt (89 tokens)
  wade               → STARTME.txt (140 tokens)
  claudemail         → STARTME.txt (62 tokens)
  transcript-api     → STARTME.txt (118 tokens)

Total: 18 projects, ~1124 tokens
```

**1,124 tokens for 18 entire projects.** That's less than reading one medium-sized source file.

---

## What It Detects

| Source | What it extracts |
|--------|-----------------|
| `package.json` | Name, description, scripts, entry points, key deps |
| `pyproject.toml` | Name, description, Python stack |
| `Cargo.toml` | Name, description, Rust stack |
| `go.mod` | Module name, Go stack |
| `Dockerfile` | Exposed ports, CMD, docker stack |
| `docker-compose.yml` | Compose command |
| `Makefile` | Build targets |
| `.env.example` | Required environment variables |
| Source files | Port numbers |
| `LICENSE` | License type |
| Directory tree | Structure with file counts |

## How It Differs From...

| Tool | What it does | How startme differs |
|------|-------------|-------------------|
| **CLAUDE.md** | Instructions for Claude (rules, preferences) | startme is orientation, not instructions. Model-agnostic. |
| **AGENTS.md** | Mixed instructions + context | startme is auto-generated, pure orientation, minimal tokens. |
| **Repomix** | Dumps entire codebase into one file | startme is ~200 tokens, not ~50,000. |
| **llms.txt** | Website docs for AI consumption | startme is for codebases, not websites. |
| **README.md** | Human-readable project docs | startme is machine-readable, no prose. |

## STARTME.txt vs CLAUDE.md

They complement each other:

```
STARTME.txt  →  "What is this project and how do I run it?"  (auto-generated)
CLAUDE.md    →  "How should I behave while working on it?"   (hand-written)
```

Use both. Or paste startme output into the top of your CLAUDE.md with `npx startme --section`.

---

## Zero Dependencies

Pure Node.js built-ins. No `npm install`. Just `npx startme`.

---

## License

MIT
