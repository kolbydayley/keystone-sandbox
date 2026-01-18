# Topic: Coding Agent Scaffolding

Best practices for building scaffolding/harnesses for AI coding agents, synthesized from Anthropic (Claude Code), Cursor, OpenAI (Codex), and SWE-agent research.

## Core Architecture

### Tool Set
- [[a1b2c3d4]] **Core tools**: read, write, edit, shell, search — atomic and composable
- [[u1v2w3x4]] **Edit tool design**: search/replace vs diff patches, exact matching, verification loops
- [[y5z6a7b8]] **Dynamic tool discovery**: tool search, MCP servers, programmatic tool calling

### Context Management
- [[e5f6g7h8]] **AGENTS.md/CLAUDE.md**: <300 lines, progressive disclosure, pointers over copies, file-scoped commands

### Architecture Patterns
- [[m3n4o5p6]] **Multi-agent orchestration**: Plan/Explore/Task sub-agents, orchestrator routing
- [[q7r8s9t0]] **Long-running harnesses**: initializer agents, progress files, handoff protocols

### Quality & Safety
- [[c9d0e1f2]] **Test-driven workflows**: TDD loop, file-scoped verification, automatic iteration
- [[g3h4i5j6]] **Safety scaffolding**: permission tiers, container isolation, prompt injection defense
- [[i9j0k1l2]] **Tool design principles**: FQDN indexing, headless IDE, specialists over generalists

## Key Insights Summary

1. **Tool design > model capability** — Well-designed tools beat raw intelligence
2. **Less context is more** — 150-200 instructions max; use pointers
3. **Atomic operations** — Small, composable tools outperform mega-tools
4. **Verify after every edit** — Read → edit → verify → lint cycle
5. **Specialists win** — Focused sub-agents beat one general agent
6. **Progress files are essential** — Long-running work needs persistent state

## Recommended Scaffolding Structure

```
project/
├── AGENTS.md                    # Core context (<300 lines)
├── agent_docs/
│   ├── setup.md                 # Build/run instructions
│   ├── testing.md               # Test commands (file-scoped)
│   ├── architecture.md          # System design
│   └── conventions.md           # Only if not lintable
├── .agent/
│   ├── progress.md              # Current state for handoffs
│   ├── features.md              # Prioritized backlog
│   └── init.sh                  # Session setup script
└── tools/
    ├── read_file
    ├── write_file
    ├── edit_file (search/replace)
    ├── bash (with timeout)
    ├── grep/search
    └── tool_search (for 20+ tools)
```

## Open Questions
- Optimal balance between agent autonomy and user confirmation?
- How to handle hallucinated file paths gracefully?
- Best practices for multi-repo agent navigation?

## Primary Sources
- https://www.anthropic.com/engineering/claude-code-best-practices
- https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
- https://www.anthropic.com/engineering/advanced-tool-use
- https://cursor.com/blog/agent-best-practices
- https://composio.dev/blog/tool-design-is-all-you-need-for-sota-swe-agents
- https://www.humanlayer.dev/blog/writing-a-good-claude-md
- https://www.builder.io/blog/agents-md
