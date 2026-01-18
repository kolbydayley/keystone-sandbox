---
id: y5z6a7b8
topic: coding-agents
tags: [tools, dynamic, MCP, tool-search, scalability]
sources: [https://www.anthropic.com/engineering/advanced-tool-use]
created: 2026-01-18
confidence: high
---

Agents working across hundreds of tools need dynamic tool discovery, not static definitions.

**Anthropic's Tool Search Pattern:**

Instead of loading all tools into context upfront:
1. Define a `tool_search(query)` meta-tool
2. Agent searches for relevant tools when needed
3. Discovered tools added to context just-in-time

**Benefits:**
- Unlimited tool libraries without context bloat
- Prompt caching preserved (deferred tools excluded from initial prompt)
- Better relevance — only contextually appropriate tools loaded

**MCP (Model Context Protocol):**
Standardized protocol for tool integration:
- Slack, GitHub, Datadog, databases
- Each MCP server exposes tools dynamically
- Cursor, Claude Code support MCP natively

**Programmatic Tool Calling:**
For batch operations, Claude can generate Python code that calls tools:
```python
team = get_team_members('engineering')
for member in team:
    expenses = get_expenses(member.id)
    # Process...
```
- Intermediate results processed in sandbox, not Claude's context
- Only final output enters context
- Massive token savings for data-heavy operations

**When to Use:**
- More than ~20 tools → consider tool search
- Batch/loop operations → programmatic tool calling
- External integrations → MCP servers

## Related
- [[a1b2c3d4]] Extends the core tool set dynamically
- [[i9j0k1l2]] Tool design for scalability
