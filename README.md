# pi-tools-ilbuu

A [pi](https://github.com/earendil-works/pi-mono) package bundling two extensions and one skill for productive, cost-effective long coding sessions.

## Contents

### Extensions

#### `http-request`
Gives the model an `http_request` tool to fetch live documentation, APIs, and web content during a session — no more guessing at API shapes.

**Tool:** `http_request(url, method?, headers?, body?)`

#### `context-manager`
Live context window management for long coding sessions.

- **Footer gauge** — colour-coded bar showing exactly how full the context window is at all times
  ```
  ctx: ████████░░░░░░░░░░ 43% 55k/200k │ claude-sonnet-4-6
  ```
  Green → yellow → orange → red as the window fills.

- **Smart auto-compact** — intercepts every compaction and uses the cheapest model you have authenticated to write the summary (tries Gemini 2.5 Flash → GPT-4o mini → Claude Haiku → Llama 3.3 on Groq → DeepSeek). Falls back to pi's built-in compaction if none are available.

- **Proactive warnings** — notifies at 70 % and again at 90 % so you are never caught mid-task.

- **Compaction audit log** — every compact appends a timestamped structured entry to `.pi/context-log.md`.

- **`/ctx` command:**

  | Command | Effect |
  |---|---|
  | `/ctx` | Report widget above editor (auto-dismisses) |
  | `/ctx compact` | Force compact now |
  | `/ctx compact <hint>` | Compact with a focus hint, e.g. `keep auth decisions` |
  | `/ctx save` | Write `CONTEXT_SNAPSHOT.md` to the project root |

### Skill

#### `context-aware-coding`
Loaded automatically (or via `/skill:context-aware-coding`). Teaches the model how to work inside a finite context window:

- Minimal bootstrap (≤ 3 tool calls to anchor a session)
- Chunk sizing table — micro / small / medium / large
- File access discipline — `grep`/`find` + `read offset+limit` instead of full reads
- Token budget action table (what to do at each usage %)
- Compaction hygiene — finish the edit before compacting
- Post-compact resume flow
- End-of-session handoff via `/ctx save`

## Install

### From git (GitHub)

```bash
pi install git:github.com/YOUR_USERNAME/pi-tools-ilbuu
```

### From npm

```bash
pi install npm:pi-tools-ilbuu
```

### Local (development / personal use)

```bash
pi install /absolute/path/to/pi-tools-ilbuu
```

## Publish

### npm

```bash
cd path/to/pi-tools-ilbuu
npm publish --access public
```

### GitHub

Push this directory to a public repo, then anyone can install it with:

```bash
pi install git:github.com/YOUR_USERNAME/pi-tools-ilbuu
```

## Requirements

- [pi](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) ≥ 0.74.0
- For smart compaction: at least one API key for a supported cheap model (Gemini, OpenAI, Anthropic, Groq, or DeepSeek)
