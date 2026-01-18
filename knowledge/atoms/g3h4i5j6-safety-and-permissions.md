---
id: g3h4i5j6
topic: coding-agents
tags: [safety, permissions, sandboxing, security]
sources: [https://www.anthropic.com/engineering/claude-code-best-practices, https://www.builder.io/blog/agents-md]
created: 2026-01-18
confidence: high
---

Coding agents can cause real damage. Safety scaffolding is essential.

**Permission Tiers:**

1. **Auto-allowed** (no prompt):
   - Read files, list directories
   - Single-file typecheck, lint, format
   - Run specific test files

2. **Confirm first** (prompt user):
   - Package installs (npm install)
   - Git push/commit
   - Delete files
   - Full builds or E2E test suites
   - Network requests to external services

3. **Forbidden** (never allow):
   - Arbitrary sudo/elevated commands
   - Credential access outside designated paths
   - Production deployments without explicit approval

**Container Isolation (Anthropic guidance):**
```bash
# Run with --dangerously-skip-permissions only in:
# - Docker container
# - No internet access
# - Ephemeral filesystem
```

**Prompt Injection Defense:**
- Agents parsing external content (GitHub issues, docs) are vulnerable
- Validate and sanitize before tool execution
- Limit blast radius with sandboxing

**AGENTS.md Safety Section:**
```markdown
### Safety and permissions
Allowed without prompt: read, list, lint, format, single tests
Ask first: installs, git push, delete, chmod, full builds
Never: production deploy, secret access
```

Natural language permission lists work well — agents understand them.

## Related
- [[q7r8s9t0]] Container isolation for long-running agents
- [[e5f6g7h8]] Safety rules belong in context files
