---
id: a1b2c3d4
topic: coding-agents
tags: [tools, scaffolding, file-operations, shell]
sources: [https://www.anthropic.com/engineering/claude-code-best-practices, https://cookbook.openai.com/examples/build_a_coding_agent_with_gpt-5.1]
created: 2026-01-18
confidence: high
---

A coding agent needs a minimal but complete tool set. The essential tools are:

**File Operations:**
- `read_file` — Read file contents (support line ranges for large files)
- `write_file` — Create/overwrite files
- `edit_file` — Surgical edits via search/replace or diff patches
- `list_files` — Directory listing with glob patterns

**Shell Execution:**
- `bash`/`shell` — Run commands with timeout and output capture
- Working directory management
- Background process support for long-running commands

**Search:**
- `grep`/`ripgrep` — Fast text search across codebase
- `find` — File path search
- Semantic/embedding search for concept-level queries

**Code Intelligence (optional but powerful):**
- LSP integration for go-to-definition, find-references
- Tree-sitter parsing for AST-aware operations
- FQDN (Fully Qualified Domain Name) indexing for precise code mapping

The key insight: tools should be **atomic and composable**. A single "code_edit" mega-tool performs worse than separate read → think → edit → verify steps.

## Related
- [[t8k2m4p1]] Atomic notes principle applies to tool design too
