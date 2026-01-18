---
id: i9j0k1l2
topic: coding-agents
tags: [tools, design, SWE-agent, performance]
sources: [https://composio.dev/blog/tool-design-is-all-you-need-for-sota-swe-agents, https://arxiv.org/abs/2405.15793]
created: 2026-01-18
confidence: high
---

Tool design is the key differentiator for coding agent performance. From SWE-bench SOTA analysis:

**FQDN (Fully Qualified Domain Names) for Code Mapping:**
```
project.analytics.DataProcessor.process_data
```
- Creates searchable index of every code element
- Retrieves specific segments without loading entire files
- Maintains unambiguous references across codebase
- Built using Tree-sitter + LSP (Jedi for Python)

**Three Pillars of Reliable Agents:**
1. **Better Tool Design** — Precise, efficient tools beat raw model capability
2. **Headless IDE** — Code intelligence (autocomplete, navigation, syntax checking) improves accuracy
3. **Specialists over Generalists** — Multiple focused agents outperform one general agent

**Agent-Computer Interface (ACI) Design:**
SWE-agent's research shows custom ACIs significantly enhance:
- File creation and editing
- Repository navigation
- Test execution

The interface design matters as much as the underlying model.

**Isolated Environments:**
- Dockerized workspaces for each agent
- Safe, independent codebase interaction
- Prevents cross-contamination between tasks

## Related
- [[a1b2c3d4]] Core tool set these principles apply to
- [[m3n4o5p6]] Multi-agent architectures use specialists
