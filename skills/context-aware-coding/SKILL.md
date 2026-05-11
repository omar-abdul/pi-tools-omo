---
name: context-aware-coding
description: >
  Context-aware coding strategy for long sessions. Keeps the model productive and
  cost-effective by structuring work into focused chunks that fit cleanly inside
  context windows. Use when starting or resuming a long coding task, when the
  session is growing large, or when the user asks about managing context or token usage.
---

# Context-Aware Coding Strategy

A structured approach to keeping long coding sessions productive, focused, and
cost-effective within the model's context window.

---

## 1. Session Bootstrap (start or resume)

Before writing any code, anchor the session:

```
1. Read AGENTS.md / CONTEXT_SNAPSHOT.md (if present) – get the project summary.
2. Read the top-level README and package.json / Cargo.toml / go.mod – understand scope.
3. List the directory tree one level deep to map the codebase.
4. Ask the user for the single goal of THIS session.
5. State the goal back in one sentence, then list ≤ 5 concrete steps.
```

Keep this bootstrap under **3 tool calls** when possible.

---

## 2. Work in Context-Friendly Chunks

Split work so each "chunk" is self-contained and completable within ~30 k tokens:

| Chunk size        | Good for                                        |
|-------------------|-------------------------------------------------|
| Micro  (< 5 k)    | Single-function edit, quick bug fix             |
| Small  (5–15 k)   | One module / feature                            |
| Medium (15–30 k)  | Full feature with tests                         |
| Large  (30–50 k)  | Refactor spanning multiple files – split if >50 k |

**Rule:** If a planned chunk looks > 50 k tokens, break it in two and do the
first half now, compact, then continue.

---

## 3. File Access Discipline

Reduce context bloat from file reads:

- **Read only what you need.** Prefer `grep`/`find` to locate the right section,
  then `read` with `offset` + `limit`.
- **Never re-read the same file twice in one turn** unless you edited it.
- After a file is modified, mentally note it as "done" and avoid re-reading unless
  a subsequent step requires it.
- Large generated files (lock files, minified bundles, auto-generated types):
  **skip entirely** unless the task explicitly requires them.

---

## 4. Token Budget Awareness

Check `ctx.getContextUsage()` (available via the context-manager extension footer)
before starting a large tool sequence.

| Usage    | Action                                                    |
|----------|-----------------------------------------------------------|
| < 50 %   | Proceed normally                                          |
| 50–70 %  | Finish current chunk, then run `/ctx compact`             |
| 70–90 %  | Finish the **current edit only**, then compact            |
| > 90 %   | **Stop immediately**, compact, then resume                |

When you see the 🟡 or 🟠 notification from the context-manager extension, treat it
as a signal to wrap up the current unit of work cleanly before continuing.

---

## 5. Compaction Hygiene

When compaction is about to happen (auto or manual):

1. **Finish the current edit** – do not leave a file half-written.
2. **Run the build / tests** if the project has them, so the summary can record
   whether things compile.
3. Optionally provide a focus hint: `/ctx compact keep all auth-related decisions`.

The context-manager extension uses a cheaper, faster model for summarisation to
minimise cost.  The summary is also written to `.pi/context-log.md` for audit.

---

## 6. Resuming After Compaction

After the session is compacted:

1. Read `.pi/context-log.md` – the latest entry is the structured summary.
2. Read any `<modified-files>` listed in the summary to re-anchor.
3. Re-state the current goal and remaining steps.
4. Continue with the next step.

---

## 7. End-of-Session Handoff

Before ending a long session:

```bash
# Save a snapshot for the next session
/ctx save
```

The snapshot (`CONTEXT_SNAPSHOT.md`) contains model, token usage, compaction
count, and file lists.  Commit it alongside code changes so any model (or
engineer) can pick up exactly where you left off.

---

## Quick Reference

| Command              | Effect                                               |
|----------------------|------------------------------------------------------|
| `/ctx`               | Live context report widget                           |
| `/ctx compact`       | Force compact (uses cheap model)                     |
| `/ctx compact <hint>`| Compact with focus hint                              |
| `/ctx save`          | Write CONTEXT_SNAPSHOT.md                            |
| `/compact`           | pi's built-in compact (also intercepted by ext)      |
| `Shift+Tab`          | Cycle thinking level (lower = fewer tokens)          |
| `Ctrl+L`             | Switch to a cheaper/smaller model mid-session        |
