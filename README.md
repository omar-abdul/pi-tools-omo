# pi-tools-omo

A [Pi](https://github.com/earendil-works/pi-mono) package bundling two extensions and one skill for productive, cost-effective coding sessions.

## Contents

### Extensions

#### `context-manager`

Live context-window management for long coding sessions.

- **Footer gauge** — shows context usage, token counts, cost, active model, compaction count, and git branch.
- **Smart compaction** — uses an available low-cost model for summaries and falls back to Pi's built-in compaction when none is available.
- **Proactive warnings** — notifies at 70% and 90% usage.
- **Compaction log** — successful custom summaries are appended to `.pi/context-log.md`.
- **`/ctx` command:**

  | Command | Effect |
  |---|---|
  | `/ctx` | Show a context report widget above the editor |
  | `/ctx compact` | Force compaction |
  | `/ctx compact <hint>` | Compact with a focus hint, e.g. `keep auth decisions` |
  | `/ctx save` | Write `CONTEXT_SNAPSHOT.md` to the project root |

#### `splash`

Displays a theme-aware startup header for the bundled themes and restores Pi's normal header after the first user input or agent start. The package includes `fantasy`, `anime`, `retro`, `rustic`, `dark`, and `hacker` themes.

### Skill

#### `context-aware-coding`

Loaded automatically (or via `/skill:context-aware-coding`). It teaches the model how to work inside a finite context window, including bootstrap discipline, chunk sizing, compaction hygiene, and end-of-session handoff.

## Install

### From GitHub

```bash
pi install git:github.com/omar-abdul/pi-tools-omo
```

### Local development

```bash
pi install /absolute/path/to/pi-tools-omo
```

## Requirements

- [Pi](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) 0.74 or newer
- For smart compaction: an API key for at least one supported provider (Google, OpenAI, Anthropic, Groq, or DeepSeek)

## Development

The package is intentionally dependency-free at runtime; Pi provides the extension APIs and TypeScript module mappings. After making changes, validate the package with:

```bash
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit --allowJs false
```
