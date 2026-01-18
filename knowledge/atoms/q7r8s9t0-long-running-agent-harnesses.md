---
id: q7r8s9t0
topic: coding-agents
tags: [harness, long-running, context-window, handoff, persistence]
sources: [https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents]
created: 2026-01-18
confidence: high
---

Long-running agents (hours/days) must work across multiple context windows. The core challenge: each new session has no memory of prior work.

**Anthropic's Human Engineer Metaphor:**
Imagine engineers working in shifts where each arrives with no memory. Solution: robust handoff protocols.

**Key Harness Components:**

1. **Initializer Agent**: Runs first in each session to:
   - Read git logs and progress files
   - Understand recent changes
   - Set up development environment
   - Write init.sh scripts for future sessions

2. **Progress Files**:
   - Track completed work
   - Document current state
   - List remaining tasks
   - Store decisions and rationale

3. **Feature Lists**:
   - Prioritized backlog
   - Status markers (done/in-progress/blocked)
   - Dependencies between items

4. **Structured Prompting**:
```
You'll only be able to edit files in this directory.
Read the git logs and progress files to get up to speed.
Read the features list and choose the highest-priority item.
```

5. **End-to-End Verification**:
   - Each session should verify existing functionality before new work
   - Prevents regression across context boundaries

**Container Isolation:**
For safety with `--dangerously-skip-permissions`, run in Docker containers without internet access.

## Related
- [[m3n4o5p6]] Sub-agents help manage long-running complexity
- [[e5f6g7h8]] Context files persist across sessions
