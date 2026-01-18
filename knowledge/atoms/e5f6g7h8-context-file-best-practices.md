---
id: e5f6g7h8
topic: coding-agents
tags: [context, AGENTS.md, CLAUDE.md, scaffolding, prompting]
sources: [https://www.humanlayer.dev/blog/writing-a-good-claude-md, https://www.builder.io/blog/agents-md]
created: 2026-01-18
confidence: high
---

Context files (AGENTS.md, CLAUDE.md) onboard the agent to your codebase. Critical best practices:

**Less is More:**
- Frontier LLMs reliably follow ~150-200 instructions max
- Claude Code's system prompt already uses ~50 instructions
- Keep AGENTS.md under 300 lines; shorter is better
- Instruction-following degrades uniformly as count increases

**Progressive Disclosure:**
Instead of stuffing everything in one file, use pointers:
```
agent_docs/
├── building_the_project.md
├── running_tests.md
├── code_conventions.md
└── database_schema.md
```
Tell agent to read relevant files on-demand.

**What to Include:**
- WHAT: Tech stack, project structure, monorepo map
- WHY: Purpose of each component
- HOW: Commands to build, test, verify changes

**What to Exclude:**
- Code style (use linters instead — LLMs are expensive linters)
- Task-specific instructions (put in separate files)
- Code snippets (become stale; use file:line pointers)

**File-Scoped Commands:**
Specify per-file commands to avoid slow full-project builds:
```bash
npm run tsc --noEmit path/to/file.tsx  # Single file typecheck
npm run prettier --write path/to/file.tsx
```

## Related
- [[a1b2c3d4]] Core tools that context files reference
