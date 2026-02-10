---
name: plan
description: Plan a new feature, refactoring, or improvement. Analyzes the codebase, identifies affected files, estimates effort, and produces a structured implementation plan. Use when the user wants to plan work before coding.
user-invocable: true
argument-hint: [feature-or-task-description]
allowed-tools: Read, Grep, Glob
---

# Plan Feature or Task

Plan implementation for: `$ARGUMENTS`

## Planning Process

### Step 1: Understand the Request
- What exactly needs to be built/changed?
- What's the user's goal?
- Are there constraints or preferences?

### Step 2: Analyze Current State
- Read relevant existing files to understand patterns
- Check if similar functionality exists (avoid duplication)
- Identify all files that will be affected
- Check for blockers or prerequisites

### Step 3: Design the Solution
For each piece of work, define:
- **What**: Concrete deliverable
- **Where**: Exact file paths (existing or new)
- **How**: Approach and key implementation details
- **Why**: Reasoning for this approach over alternatives

### Step 4: Write the Plan

Use this format:

```
## [Feature Name]

### Goal
One sentence describing the outcome.

### Prerequisites
- [ ] List anything that must be done first

### Implementation Steps

1. **[Step Name]** (~Xh)
   - File: `path/to/file.ts`
   - What: Description of change
   - Details: Key implementation notes

2. **[Step Name]** (~Xh)
   ...

### Files Affected
| File | Action | Description |
|------|--------|-------------|
| `src/app/api/new/route.ts` | CREATE | New endpoint |
| `src/hooks/useNew.ts` | CREATE | Query hook |
| `src/components/layout/Header.tsx` | MODIFY | Add nav link |

### Testing Plan
- [ ] Unit: What to test
- [ ] E2E: What user flows to verify
- [ ] Manual: What to check visually

### Estimated Effort
Total: ~Xh

### Risks / Open Questions
- List anything uncertain
```

## Rules

1. **Be specific** — file paths, function names, line numbers when possible
2. **Be honest about effort** — round up, not down
3. **Identify dependencies** — what must happen before what
4. **Check for conflicts** — will this break existing functionality?
5. **Consider security** — especially for trading/auth/credential features
6. **Consider mobile** — will this work on small screens?
7. **Reference existing patterns** — new code should match what's already there
8. **Update docs/plan.txt** — after the user approves, add the plan to the file

## Plan File Convention

When updating `docs/plan.txt`:
- Completed phases: Keep as brief summary (title + status + key files)
- Current/next work: Full detail with implementation steps
- Future phases: Keep as high-level bullet points
- Always include effort estimates
- Use `[x]` for done, `[ ]` for pending
