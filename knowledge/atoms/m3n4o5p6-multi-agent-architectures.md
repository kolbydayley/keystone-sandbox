---
id: m3n4o5p6
topic: coding-agents
tags: [architecture, multi-agent, orchestration, sub-agents]
sources: [https://www.anthropic.com/engineering/claude-code-best-practices, https://cursor.com/blog/agent-best-practices]
created: 2026-01-18
confidence: high
---

Complex coding tasks benefit from multi-agent orchestration patterns.

**Claude Code Sub-Agent Pattern:**
- **Plan Agent**: Returns step-by-step plans, identifies critical files, considers architectural trade-offs
- **Explore Agent**: Searches/reads files to understand code behavior without making changes
- **Task Agent**: Executes specific implementation after planning

Each sub-agent has a focused prompt and tool subset.

**Cursor's Agent Hierarchy:**
- Main orchestrator decides what to do
- Delegates to specialized tools/agents
- Browser agent for visual verification
- MCP servers for external integrations (Slack, Datadog, databases)

**When to Use Sub-Agents (Anthropic guidance):**
- Only delegate when task clearly benefits from separate context window
- Avoid over-delegation — most tasks don't need it
- Sub-agents work best for: parallel exploration, isolated experiments, specialized domains

**Orchestrator Responsibilities:**
1. Parse user intent
2. Decide routing (direct execution vs delegation)
3. Manage context/memory across sub-tasks
4. Synthesize results

The overhead of sub-agents only pays off for genuinely complex, multi-file, or specialized tasks.

## Related
- [[i9j0k1l2]] Tool design principle: specialists > generalists
- [[q7r8s9t0]] Long-running agents need sub-agent patterns
