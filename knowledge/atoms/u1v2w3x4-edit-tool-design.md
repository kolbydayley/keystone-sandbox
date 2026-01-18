---
id: u1v2w3x4
topic: coding-agents
tags: [tools, file-editing, diff, patch, precision]
sources: [https://www.anthropic.com/engineering/claude-code-best-practices, https://cookbook.openai.com/examples/build_a_coding_agent_with_gpt-5.1]
created: 2026-01-18
confidence: high
---

File editing is the most error-prone tool. Design it carefully.

**Two Main Approaches:**

1. **Search/Replace (Claude Code style)**:
```json
{
  "old_string": "exact text to find",
  "new_string": "replacement text"
}
```
- Requires exact match (whitespace-sensitive)
- Fails explicitly if old_string not found
- Good for surgical, targeted edits

2. **Unified Diff Patch (OpenAI style)**:
```diff
--- a/file.py
+++ b/file.py
@@ -10,6 +10,7 @@
 def existing():
     pass
+def new_function():
+    return True
```
- More complex but handles multi-location edits
- Better for larger changes
- Requires robust patch application logic

**Critical Design Decisions:**

- **Line numbers are fragile**: Don't rely on them; code changes between reads
- **Exact match required**: Fuzzy matching causes subtle bugs
- **Fail loudly**: If edit target not found, error immediately
- **Show diff preview**: Let agent verify intent before applying
- **Atomic operations**: Each edit should be independently reversible

**OpenAI's apply_patch Tool:**
```python
def apply_patch(patch: str, file_content: str) -> str:
    # Parse unified diff format
    # Apply changes with conflict detection
    # Return new content or error
```

**Verification Loop:**
After every edit: read file → verify change applied → run type check/lint on that file.

## Related
- [[a1b2c3d4]] Part of core tool set
- [[i9j0k1l2]] Precision in tool design matters
