/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Context Manager Extension  –  v1.0
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Keeps long coding sessions cost-effective and high-quality by:
 *
 *  1. CONTEXT HEALTH BAR  – live footer gauge shows % window used.
 *     Colour coding:
 *       ░ green   = < 50 %   (plenty of room)
 *       ░ yellow  = 50-75 %  (watch out)
 *       ░ orange  = 75-90 %  (approaching limit)
 *       ░ red     =  > 90 %  (compact soon)
 *
 *  2. SMART AUTO-COMPACT  – uses a cheaper / faster model for the summary so
 *     the main model's budget is spent on code, not book-keeping.
 *     The cheaper model is picked automatically from whatever providers you
 *     have authenticated (preference order below).  Falls back to pi's
 *     built-in compaction when no cheap model is found.
 *
 *  3. PROACTIVE WARNINGS  – notifies at 70 % and 90 % so you are never
 *     surprised by a mid-task compaction.
 *
 *  4. /ctx COMMAND  – show a detailed context snapshot any time:
 *       /ctx          → full report widget
 *       /ctx compact  → force compact now (with optional instructions)
 *                        e.g. /ctx compact focus on auth module
 *       /ctx save     → write a CONTEXT_SNAPSHOT.md of current state
 *
 *  5. SMART SAVE  – on every compaction (manual or auto) the extension
 *     appends a timestamped entry to .pi/context-log.md so you can audit
 *     what was pruned.
 *
 *  Placement:  ~/.pi/agent/extensions/context-manager/index.ts
 *  Reload:     /reload inside pi, or restart pi.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { complete } from "@earendil-works/pi-ai";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { convertToLlm, serializeConversation } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";

// ─── tuneable constants ───────────────────────────────────────────────────────

/** Warn once when usage passes this fraction. */
const WARN_LEVEL_1 = 0.70;
/** Warn again (more urgently) at this fraction. */
const WARN_LEVEL_2 = 0.90;

/**
 * Candidate cheap models for summarisation, in preference order.
 * These are well-suited: fast, low-cost, large context.
 * The extension picks the first one that is actually available.
 */
const CHEAP_SUMMARISER_CANDIDATES: Array<{ provider: string; model: string; label: string }> = [
  { provider: "google",    model: "gemini-2.5-flash",         label: "Gemini 2.5 Flash" },
  { provider: "google",    model: "gemini-2.0-flash",         label: "Gemini 2.0 Flash" },
  { provider: "openai",    model: "gpt-4o-mini",              label: "GPT-4o mini" },
  { provider: "anthropic", model: "claude-haiku-4-5",         label: "Claude Haiku" },
  { provider: "groq",      model: "llama-3.3-70b-versatile",  label: "Llama 3.3 70B (Groq)" },
  { provider: "deepseek",  model: "deepseek-chat",            label: "DeepSeek-V3" },
];

/** Maximum tokens the summariser is asked to emit. */
const SUMMARY_MAX_TOKENS = 8192;

// ─── helpers ─────────────────────────────────────────────────────────────────

function pct(tokens: number, window: number): number {
  return window > 0 ? Math.min(1, tokens / window) : 0;
}

function bar(fraction: number, width = 20): string {
  const filled = Math.round(fraction * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function fmtK(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function fmtCost(n: number): string {
  return `$${n.toFixed(n >= 1 ? 2 : 4)}`;
}

function colourForFraction(fraction: number, theme: ExtensionContext["ui"]["theme"]): (s: string) => string {
  if (fraction >= 0.9) return (s) => theme.fg("error",   s);
  if (fraction >= 0.75) return (s) => theme.fg("warning", s);
  if (fraction >= 0.5) return (s) => "\x1b[38;5;214m" + s + "\x1b[0m"; // orange (not in pi theme)
  return (s) => theme.fg("success", s);
}

// ─── extension factory ───────────────────────────────────────────────────────

export default function contextManagerExtension(pi: ExtensionAPI) {

  // ── state ──────────────────────────────────────────────────────────────────
  let warnedLevel1 = false;
  let warnedLevel2 = false;
  let lastTokens   = 0;
  let lastWindow   = 0;
  let compactCount = 0;
  let sessionCwd   = process.cwd();

  // ── footer: live context gauge ─────────────────────────────────────────────

  function installFooter(ctx: ExtensionContext) {
    ctx.ui.setFooter((tui, theme, footerData) => {
      const unsub = footerData.onBranchChange(() => tui.requestRender());
      return {
        dispose: unsub,
        invalidate() {},
        render(width: number): string[] {
          const usage  = ctx.getContextUsage();
          const tokens = usage?.tokens  ?? lastTokens;
          const window = usage?.contextWindow ?? ctx.model?.contextWindow ?? lastWindow;

          if (window === 0) {
            // No model loaded yet – show minimal footer
            const modelName = ctx.model?.id ?? "no model";
            return [truncateToWidth(theme.fg("dim", modelName), width)];
          }

          const fraction = usage?.percent != null ? usage.percent / 100 : pct(tokens ?? 0, window);
          const colour   = colourForFraction(fraction, theme);
          const gauge    = colour(bar(fraction, 18));
          const pctStr   = colour(`${Math.round(fraction * 100)}%`);
          let sessionCost = 0;
          for (const entry of ctx.sessionManager.getBranch()) {
            if (entry.type === "message" && entry.message.role === "assistant") {
              const message = entry.message as AssistantMessage;
              sessionCost += message.usage?.cost?.total ?? 0;
            }
          }

          const tokStr   = theme.fg("dim", `${fmtK(tokens)}/${fmtK(window)}`);
          const costStr  = theme.fg("dim", fmtCost(sessionCost));
          const label    = theme.fg("dim", "ctx:");
          const sep      = theme.fg("dim", " │ ");
          const modelStr = theme.fg("dim", ctx.model?.id ?? "—");
          const compact  = compactCount > 0
            ? theme.fg("dim", ` [compacted ×${compactCount}]`)
            : "";
          const branch   = footerData.getGitBranch()
            ? theme.fg("dim", ` (${footerData.getGitBranch()})`)
            : "";

          const right = `${label}${gauge} ${pctStr} ${tokStr} ${costStr}${compact}${sep}${modelStr}${branch}`;
          return [truncateToWidth(right, width)];
        },
      };
    });
  }

  // ── pick cheap summariser ──────────────────────────────────────────────────

  async function findCheapModel(ctx: ExtensionContext) {
    for (const candidate of CHEAP_SUMMARISER_CANDIDATES) {
      const model = ctx.modelRegistry.find(candidate.provider, candidate.model);
      if (!model) continue;
      const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
      if (auth.ok && auth.apiKey) return { model, label: candidate.label };
    }
    return null;
  }

  // ── generate summary via cheap model ──────────────────────────────────────

  async function generateSummary(
    ctx: ExtensionContext,
    messagesToSummarise: unknown[],
    previousSummary: string | undefined,
    signal: AbortSignal,
    customInstructions?: string,
  ): Promise<string | null> {
    const found = await findCheapModel(ctx);
    if (!found) return null;

    const { model, label } = found;
    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
    if (!auth.ok || !auth.apiKey) return null;

    ctx.ui.notify(`📝 Summarising with ${label} (cost-effective)…`, "info");

    // Serialise conversation to plain text
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conversationText = serializeConversation(convertToLlm(messagesToSummarise as any));
    const prevCtx = previousSummary ? `\n\nPrevious summary:\n${previousSummary}` : "";
    const extraInstr = customInstructions
      ? `\n\nSpecial focus for this summary:\n${customInstructions}`
      : "";

    const prompt = `You are a senior software engineer summarising a coding-agent session.
Create a concise but complete summary so that the conversation can continue seamlessly.
${prevCtx}${extraInstr}

The summary MUST cover:
1. **Goal** – what the user is trying to accomplish
2. **Constraints & Preferences** – requirements, code-style rules, constraints
3. **Progress**
   - Done (checked tasks / files already modified)
   - In Progress (current task)
   - Blocked (if any)
4. **Key Decisions** – architectural choices and their rationale
5. **Critical Technical Context** – functions, classes, APIs, data shapes the model must know
6. **Next Steps** – ordered list of what to do next
7. **<read-files>** – newline-separated list of files that were read
8. **<modified-files>** – newline-separated list of files that were changed

Be precise. No fluff. The summary replaces the full conversation history.

<conversation>
${conversationText}
</conversation>`;

    try {
      const response = await complete(
        model,
        {
          messages: [
            {
              role: "user",
              content: [{ type: "text", text: prompt }],
              timestamp: Date.now(),
            },
          ],
        },
        { apiKey: auth.apiKey, headers: auth.headers, maxTokens: SUMMARY_MAX_TOKENS, signal },
      );

      return response.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("\n")
        .trim() || null;
    } catch (err) {
      if (!signal.aborted) {
        ctx.ui.notify(`Summarisation failed: ${err instanceof Error ? err.message : String(err)}`, "error");
      }
      return null;
    }
  }

  // ── append to context log ──────────────────────────────────────────────────

  function logCompaction(cwd: string, summary: string, tokensBefore: number) {
    try {
      const dir = join(cwd, ".pi");
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const logPath = join(dir, "context-log.md");
      const stamp = new Date().toISOString();
      const entry = `\n---\n## Compaction – ${stamp}\n**Tokens before:** ${tokensBefore.toLocaleString()}\n\n${summary}\n`;
      appendFileSync(logPath, entry, "utf-8");
    } catch {
      // best effort
    }
  }

  // ── session_before_compact – intercept and use cheap model ────────────────

  pi.on("session_before_compact", async (event, ctx) => {
    const { preparation, signal } = event;
    const { messagesToSummarize, turnPrefixMessages, tokensBefore, firstKeptEntryId, previousSummary } = preparation;

    const allMessages = [...messagesToSummarize, ...turnPrefixMessages];
    if (allMessages.length === 0) return; // nothing to do

    const summary = await generateSummary(
      ctx,
      allMessages,
      previousSummary,
      signal,
    );

    if (!summary || signal.aborted) return; // fall back to default

    compactCount++;
    logCompaction(sessionCwd, summary, tokensBefore);
    ctx.ui.notify(`✅ Compact #${compactCount} done – summary saved to .pi/context-log.md`, "success");

    return {
      compaction: {
        summary,
        firstKeptEntryId,
        tokensBefore,
      },
    };
  });

  // ── session_compact – update counter ──────────────────────────────────────

  pi.on("session_compact", async (_event, ctx) => {
    // Footer re-render to update compactCount display
    installFooter(ctx);
  });

  // ── turn_end – check warnings ──────────────────────────────────────────────

  pi.on("turn_end", async (_event, ctx) => {
    const usage = ctx.getContextUsage();
    if (!usage || usage.contextWindow === 0) return;

    lastTokens = usage.tokens ?? lastTokens;
    lastWindow = usage.contextWindow;
    const fraction = usage.percent != null ? usage.percent / 100 : pct(usage.tokens ?? 0, usage.contextWindow);

    if (!warnedLevel1 && fraction >= WARN_LEVEL_1) {
      warnedLevel1 = true;
      ctx.ui.notify(
        `⚠️  Context at ${Math.round(fraction * 100)}% (${fmtK(usage.tokens ?? 0)}/${fmtK(usage.contextWindow)}) — consider /ctx compact`,
        "warning",
      );
    }

    if (!warnedLevel2 && fraction >= WARN_LEVEL_2) {
      warnedLevel2 = true;
      ctx.ui.notify(
        `🔴 Context at ${Math.round(fraction * 100)}% — auto-compact will trigger soon!`,
        "error",
      );
    }

    // Reset flags after a compaction so warnings fire again in the next cycle
    if (fraction < WARN_LEVEL_1) {
      warnedLevel1 = false;
      warnedLevel2 = false;
    }
  });

  // ── model_select – reset window info on model switch ─────────────────────

  pi.on("model_select", async (event, ctx) => {
    lastWindow = event.model.contextWindow ?? lastWindow;
    installFooter(ctx);
  });

  // ── /ctx command ──────────────────────────────────────────────────────────

  pi.registerCommand("ctx", {
    description: "Context Manager: report | compact [instructions] | save",
    handler: async (args, ctx) => {
      const [sub, ...rest] = (args ?? "").trim().split(/\s+/);
      const extra = rest.join(" ").trim();

      // ── /ctx compact ─────────────────────────────────────────────────────
      if (sub === "compact") {
        ctx.compact({
          customInstructions: extra || undefined,
          onComplete: () => ctx.ui.notify("✅ Manual compact complete", "success"),
          onError: (e) => ctx.ui.notify(`Compact error: ${e.message}`, "error"),
        });
        return;
      }

      // ── /ctx save ─────────────────────────────────────────────────────────
      if (sub === "save") {
        const usage  = ctx.getContextUsage();
        const tokens = usage?.tokens  ?? lastTokens;
        const window = usage?.contextWindow ?? ctx.model?.contextWindow ?? lastWindow;
        const fraction = usage?.percent != null ? usage.percent / 100 : pct(tokens ?? 0, window);

        const branch = ctx.sessionManager.getBranch();
        const msgCount = branch.filter((e) => e.type === "message").length;

        const lines: string[] = [
          `# Context Snapshot`,
          ``,
          `**Generated:** ${new Date().toISOString()}`,
          `**Model:** ${ctx.model?.id ?? "unknown"} (context window: ${fmtK(window)})`,
          `**Tokens used:** ${fmtK(tokens)} / ${fmtK(window)} (${Math.round(fraction * 100)}%)`,
          `**Messages in branch:** ${msgCount}`,
          `**Compaction count:** ${compactCount}`,
          ``,
          `## Context Bar`,
          ``,
          `\`\`\``,
          `${bar(fraction, 40)} ${Math.round(fraction * 100)}%`,
          `\`\`\``,
          ``,
          `## Status`,
          ``,
          fraction >= 0.9  ? `🔴 **CRITICAL** – compact immediately` :
          fraction >= 0.75 ? `🟠 **HIGH**     – compact soon` :
          fraction >= 0.5  ? `🟡 **MEDIUM**   – monitor usage` :
                             `🟢 **HEALTHY**  – plenty of room`,
          ``,
          `## Recent Files`,
          ``,
        ];

        // List files from session entries
        const files = new Set<string>();
        for (const entry of branch) {
          if (entry.type === "message" && (entry as { message?: { role?: string } }).message?.role === "assistant") {
            // best effort: collect tool-call paths from the branch
          }
          if (entry.type === "compaction") {
            const d = (entry as { details?: { readFiles?: string[]; modifiedFiles?: string[] } }).details;
            if (d?.readFiles) d.readFiles.forEach((f: string) => files.add(`📖 ${f}`));
            if (d?.modifiedFiles) d.modifiedFiles.forEach((f: string) => files.add(`✏️  ${f}`));
          }
        }

        if (files.size > 0) {
          lines.push(...[...files].slice(0, 30).map((f) => `- ${f}`));
        } else {
          lines.push("_No file records in compaction entries yet._");
        }

        const snapshotPath = join(sessionCwd, "CONTEXT_SNAPSHOT.md");
        try {
          writeFileSync(snapshotPath, lines.join("\n"), "utf-8");
          ctx.ui.notify(`💾 Snapshot saved → CONTEXT_SNAPSHOT.md`, "success");
        } catch (e) {
          ctx.ui.notify(`Could not save snapshot: ${e}`, "error");
        }
        return;
      }

      // ── /ctx  (default: show report widget) ──────────────────────────────
      const usage   = ctx.getContextUsage();
      const tokens  = usage?.tokens  ?? lastTokens;
      const window  = usage?.contextWindow ?? ctx.model?.contextWindow ?? lastWindow;
      const fraction = usage?.percent != null ? usage.percent / 100 : pct(tokens ?? 0, window);

      const statusIcon =
        fraction >= 0.9  ? "🔴 CRITICAL" :
        fraction >= 0.75 ? "🟠 HIGH" :
        fraction >= 0.5  ? "🟡 MEDIUM" :
                           "🟢 HEALTHY";

      const lines: string[] = [
        ``,
        ` ╔══════════════════════════════════════╗`,
        ` ║       Context Manager Report         ║`,
        ` ╚══════════════════════════════════════╝`,
        ``,
        `  Model   : ${ctx.model?.id ?? "unknown"}`,
        `  Window  : ${fmtK(window)} tokens`,
        `  Used    : ${fmtK(tokens)} tokens (${Math.round(fraction * 100)}%)`,
        `  Status  : ${statusIcon}`,
        `  Compacts: ${compactCount}`,
        ``,
        `  [${bar(fraction, 34)}]`,
        `   0%` + " ".repeat(28) + `100%`,
        ``,
        `  Thresholds:`,
        `    ⚠️  Warn  at  70% (${fmtK(Math.round(window * 0.70))})`,
        `    🔴 Urgent at 90% (${fmtK(Math.round(window * 0.90))})`,
        `    🤖 Auto-compact when pi's reserve budget is hit`,
        ``,
        `  Commands:`,
        `    /ctx compact [focus]  – compact now (optional focus hint)`,
        `    /ctx save             – write CONTEXT_SNAPSHOT.md`,
        ``,
        `  Log: .pi/context-log.md`,
        ``,
      ];

      ctx.ui.setWidget(
        "ctx-report",
        lines,
        { placement: "aboveEditor" },
      );

      // Auto-dismiss after next user input
      const dismiss = () => ctx.ui.setWidget("ctx-report", undefined);
      const cleanup = pi.on("input", () => { dismiss(); cleanup(); });
    },
  });

  // ── session_start – wire everything up ───────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    sessionCwd = ctx.cwd;
    installFooter(ctx);

    const usage = ctx.getContextUsage();
    if (usage) {
      lastTokens = usage.tokens ?? 0;
      lastWindow = usage.contextWindow;
    } else if (ctx.model) {
      lastWindow = ctx.model.contextWindow ?? 0;
    }

    // Restore compact count from session entries
    compactCount = ctx.sessionManager
      .getEntries()
      .filter((e) => e.type === "compaction").length;

    // Footer status label
    ctx.ui.setStatus(
      "ctx-mgr",
      ctx.ui.theme.fg("dim", "ctx-mgr ✓"),
    );
  });

  pi.on("session_shutdown", async () => {
    warnedLevel1 = false;
    warnedLevel2 = false;
    lastTokens   = 0;
    lastWindow   = 0;
    compactCount = 0;
  });
}
