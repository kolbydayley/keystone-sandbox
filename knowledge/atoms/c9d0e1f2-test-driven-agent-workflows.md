---
id: c9d0e1f2
topic: coding-agents
tags: [testing, TDD, verification, workflows]
sources: [https://cursor.com/blog/agent-best-practices, https://www.anthropic.com/engineering/claude-code-best-practices]
created: 2026-01-18
confidence: high
---

Test-driven workflows dramatically improve coding agent reliability.

**TDD Pattern for Agents:**
1. Write tests based on expected input/output pairs
2. Tell agent explicitly: "We're doing TDD — no mock implementations"
3. Agent writes code, runs tests, iterates until pass
4. Automatic loop: code → test → fix → repeat

**Cursor's Approach:**
- Agent can run tests and iterate automatically
- "Yolo mode" — keeps running until tests pass (with limits)
- Browser agent takes screenshots to verify visual changes

**Verification Commands (file-scoped for speed):**
```bash
# Type check single file
npx tsc --noEmit src/component.tsx

# Lint single file
npx eslint --fix src/component.tsx

# Run specific test
npx vitest run src/component.test.tsx
```

**Why File-Scoped Matters:**
- Full project builds take minutes
- Single-file checks take seconds
- Faster feedback loops = better agent performance
- Always run after each edit

**Anthropic's Recommendation:**
"Ask the initializer agent to write an init.sh script that can run the development server, then run through a basic end-to-end test before implementing a new feature."

Pre-flight checks prevent regression across agent sessions.

## Related
- [[e5f6g7h8]] Context files should specify verification commands
- [[q7r8s9t0]] Long-running agents need verification between sessions
