# Worldledger

*[Türkçe README](README.tr.md)*

Worldledger is a local-first wiki for game developers to write and manage the lore of their game worlds, independent of genre or engine.

Its first module, the **Lore Encyclopedia**, keeps a world as a sourcebook. Categories are chapters, pages are entries, and every entry can link to any other. Everything is stored in your browser: no server and no account.

> **Status:** in development. All six stages are done: worlds, pages, chapters, internal links, search, backlinks, stat blocks, timeline, relationship graph, maps, AI assistance, export and backup, and the EN/TR interface.

## Features

Available now:

- **Multiple worlds.** Each world has a name, genre, tone, content language, summary, cover colour and calendar label.
- **Pages in Markdown.** Pages are sorted into chapters: Character, Location, Faction, Event, Item, Creature, Concept, plus chapters of your own.
- **Internal links.**
  - `[[Page Name]]` or `[[Page Name|label]]` creates a link.
  - Links to pages that don't exist yet appear as dashed red links; clicking one creates the page.
  - Renaming a page updates every link that points to it.
  - Aliases ("also known as") resolve links too.
- **Wanted pages.** The world home lists red links, ranked by how often they're used.
- **Search.** Press Ctrl/⌘+K anywhere in a world to search titles, aliases and text.
  - Case and accents don't matter, Turkish dotted/dotless i included: `istanbul` finds *İstanbul*, `isikli` finds *Işıklı*.
  - The same palette jumps to chapters and settings, and creates a page from what you typed.
- **Timeline.** Every dated page appears in order, in the world's own calendar.
  - Name the calendar, add months, a label for years before year 0, and eras such as *Age of Ash*, all under world settings.
  - Eras appear as coloured bands.
  - Births, deaths and foundings from stat blocks can be shown too.
  - Filter by chapter, and switch between compact spacing (with "N years later" markers) and to-scale spacing with zoom.
- **Relationship graph.** All links between pages, drawn as a network and coloured by chapter.
  - Filter by chapter, and show or hide unlinked pages.
  - Click a page to highlight its connections; double-click to open it.
  - A list view shows the same connections as text.
- **Maps.** Upload your own map image, then zoom and pan it.
  - Click to place markers and drag them to move. Link each marker to a page; the marker takes the colour of the page's chapter, and a page that isn't written yet shows a hollow ring.
  - Every page shows "On the map" links that jump to its marker.
  - The marker list beside the map is the text version.
- **AI assistance (optional).** Works with Anthropic (Claude), OpenAI, Google Gemini and OpenRouter. It also works with Ollama and LM Studio, which run free on your own computer, and with any OpenAI-compatible service (Groq, Mistral, DeepSeek…).
  - **Expand this page:** new material that fits the existing lore.
  - **Draft a missing page:** a first draft for a red link, from what links to it.
  - **Consistency check:** finds contradictions such as date conflicts or dead characters who appear later, and links to the pages involved.
  - Answers stream in as they're written. Nothing is saved until you review, edit and accept it.
  - The AI writes in the world's content language.
  - Only the relevant pages are sent: the page, what it links to and what links to it, and one more ring for consistency checks. The whole world is never sent.
- **Claude connection (MCP).** Claude Desktop, Claude Code or any MCP client can read your worlds and propose new pages and edits. Proposals wait in each world's **Proposals** inbox until you review, edit and accept them. See [Claude connection (MCP)](#claude-connection-mcp).
- **Export and backup.** In each world's settings:
  - **JSON backup**: everything, including maps. Restore it from the shelf with **Restore from backup**, either replacing the world or importing it as a copy.
  - **Markdown zip**: one `.md` file per page with YAML front matter, in a folder per chapter; works with Obsidian.
  - **Single HTML page**: a readable, printable file with contents and working links.
  - Exports never contain AI keys.
- **Backlinks.** Every page lists the pages that link to it, from their text or their stat block.
- **Stat blocks (infoboxes).** Each chapter has fields, such as born, species, affiliation and home for characters.
  - Field types: short and long text, number, world date, link(s) to pages, choice list, tags, yes/no.
  - Page-link fields count as links, so they show in backlinks and red links.
  - Add your own fields to any chapter under **Edit chapters**.
  - Event pages have a date range in the world's calendar.
- **Editor.** CodeMirror with `[[` autocomplete, live preview or side-by-side view, Ctrl/⌘+S to save, and a guard against losing unsaved changes.
- **Multilingual interface.** English and Turkish are included.
  - The browser language is detected on first visit, and your choice is remembered.
  - Dates and numbers follow the interface language.
  - Layouts use CSS logical properties, so right-to-left languages work.
- **Content language is separate from interface language.** You can use an English interface and write Turkish lore.
- **Light and dark themes**, and layouts for phones.

## Getting started

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). On first run, pick **Open a sample world** to explore a linked demo world, or create your own.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Unit tests (Vitest) |
| `npm run i18n:check` | Fail on missing, extra or unknown translation keys |
| `npm run css:check` | Fail on physical CSS properties (keeps layouts RTL-ready) |
| `npm run check` | All of the above plus lint |

## Deploying to GitHub Pages

`.github/workflows/deploy.yml` runs every check, builds, and publishes the app on each push to `main`. The Vite `base` comes from the repository name, so the app is served at `https://<user>.github.io/<repo>/`. Hash routing means deep links work without server rewrites.

One-time setup:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. On a free GitHub plan, the repository must be public for Pages to work.

## AI providers

AI is optional; everything else works without it. To set up a provider, go to **Settings → AI assistants → Add a provider**, choose a provider, then:

1. Paste your API key (local providers need none).
2. Click **Load models** and pick one, or type the model name.
3. Click **Test connection**.

You can save several providers and mark one as the default. Under **Model per task** you can choose a different model for each job, for example a strong model for consistency checks and a fast, cheap one for drafts.

| Provider | Address (default) | Notes |
|---|---|---|
| Anthropic (Claude) | `https://api.anthropic.com` | Key from console.anthropic.com. Works directly from the browser. |
| OpenAI | `https://api.openai.com/v1` | Key from platform.openai.com. |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta` | Key from aistudio.google.com. |
| OpenRouter | `https://openrouter.ai/api/v1` | One key for many models; model names look like `anthropic/claude-sonnet-4.5`. |
| Ollama (local, free) | `http://localhost:11434` | See below. |
| LM Studio (local, free) | `http://localhost:1234/v1` | In LM Studio: Developer tab → start server → enable **CORS**. |
| Custom (OpenAI-compatible) | your service's `/v1` URL | Groq, Mistral, DeepSeek, Together… may need the local proxy. |

**Where your keys go.** API keys are stored only in your browser, in a separate IndexedDB database named `worldledger-secrets`. They are never written into exports, backups or the repository, and they are sent only to the provider you configured.

### Ollama

Install it from [ollama.com](https://ollama.com), download a model, and start it so browsers may connect:

```bash
ollama pull llama3.2
```

```bash
OLLAMA_ORIGINS="*" ollama serve
```

If you use the hosted app (GitHub Pages), set `OLLAMA_ORIGINS` to that address instead of `*`, for example `https://<user>.github.io`. On Windows, set `OLLAMA_ORIGINS` as an environment variable and restart Ollama.

### Local proxy (for services that block browsers)

Some services refuse requests that come straight from a web page (CORS). If **Test connection** says the request was blocked:

1. Run the small proxy that ships with Worldledger. It has no dependencies, listens only on `127.0.0.1:8787` and stores nothing:
   ```bash
   npm run proxy
   ```
2. In Settings, tick **Use local proxy** for that provider.

Options:

- `PORT=9000 npm run proxy` uses another port. Update the proxy address under **Settings → Local proxy** to match.
- `ALLOW_HOSTS=api.groq.com,api.mistral.ai npm run proxy` restricts which services the proxy will forward to.

Safari blocks web pages served over https from calling `http://localhost`, so with the hosted app use Chrome, Edge or Firefox for local models and the proxy.

### Adding an AI provider (for developers)

Add one file to `src/core/ai/providers/` that default-exports an `AIProvider`; the registry picks it up automatically.

- For an OpenAI-style API, `openAICompatible({ id, defaultBaseUrl, needsKey, browserFriendly })` from `src/core/ai/lib/openaiCompatible.ts` does almost all the work.
- Add its name and help text to `src/locales/*/ai.json` under `provider.<id>`.
- Prompts live in `src/core/ai/prompts/` and are provider-agnostic.

## Claude connection (MCP)

Worldledger can act as an [MCP](https://modelcontextprotocol.io) server, so Claude can read your lore and propose new lore while you talk to it. Your worlds stay in the browser; a small bridge on your computer passes Claude's requests to the open Worldledger tab:

```
Claude ──MCP (stdio)──▶ bridge/worldledger-mcp.mjs ◀──HTTP, 127.0.0.1:8788──▶ Worldledger tab
```

The same thing as a list: Claude starts the bridge and talks to it over standard input and output. The Worldledger tab asks the bridge for work over HTTP on your own computer (port 8788), runs each request against its IndexedDB and sends back the answer.

**Setup** (once per computer; needs Node.js 18 or newer):

1. In Worldledger, open **Settings → Claude connection** and download `worldledger-mcp.mjs` (or use `bridge/worldledger-mcp.mjs` from this repository). It is a single file with no dependencies.
2. Register it with Claude:
   - **Claude Desktop:** Settings → Developer → Edit Config, then add to `claude_desktop_config.json`:
     ```json
     { "mcpServers": { "worldledger": { "command": "node", "args": ["/path/to/worldledger-mcp.mjs"] } } }
     ```
     and restart Claude Desktop.
   - **Claude Code:** `claude mcp add worldledger -- node /path/to/worldledger-mcp.mjs`
3. Turn on **Connect to Claude** in Settings. The status line says when the bridge is connected. Keep a Worldledger tab open while you work.

The settings page fills in these commands for you, including the path if you type where you saved the file.

**Tools Claude gets:**

| Tool | What it does |
|---|---|
| `list_worlds`, `get_world` | Worlds, and a world's summary, calendar, eras, chapters and their stat-block fields |
| `search_pages`, `list_pages`, `get_page` | Full-text search, page lists by chapter, one page with text, fields, links and backlinks |
| `get_related_lore` | A page (or a topic with no page yet) plus the pages around it, as compact text |
| `get_timeline`, `list_missing_pages` | The dated history by era; red links ranked by how often they're used |
| `propose_page`, `propose_edit` | A new page, or an edit to an existing one (append text, replace text, set fields, add aliases) |
| `list_proposals` | Claude's earlier proposals and whether you accepted them |

Claude may name chapters and fields in any interface language ("Character", "Karakter", "born", "Doğum"); page references are titles and dates are a year or `{year, month, day}`. Anything that doesn't fit is left out and reported back to Claude and in the inbox.

**Reviewing.** Each world's **Proposals** tab (the inbox icon, with the number waiting) shows every proposal as it would appear: the page text and stat block, or for an edit, the added text and a before/after table of fields. You can accept it, edit it first or reject it. Accepted pages are added as drafts. If a proposed new page has the title of an existing page, you can add it to that page instead or give it another title. **Save Claude's changes directly** in Settings skips the review (off by default).

**Options for the bridge** (environment variables):

- `WORLDLEDGER_BRIDGE_PORT` (default `8788`). Change the bridge address in Settings to match.
- `WORLDLEDGER_ORIGINS`: which sites may connect, comma-separated. By default, `localhost` and `https://*.github.io`. If you host Worldledger elsewhere, set it to that origin; the settings page includes it in the commands.

**Privacy.** The bridge listens only on `127.0.0.1` and accepts only the allowed origins. Claude sees only what its tools return, and proposals are not part of backups. Several Claude apps can use the bridge at once (the second one forwards to the first), and with several Worldledger tabs open only one answers. Safari blocks https pages from calling `http://127.0.0.1`, so use Chrome, Edge or Firefox with the hosted app.

## Your data

All worlds live in your browser's IndexedDB, in a database named `worldledger`. Nothing leaves your machine. Clearing site data for the app deletes your worlds, so download a JSON backup from each world's settings now and then.

## How to add a new language

Interface languages are discovered automatically from `src/locales/`. To add one, for example German:

1. Copy the English folder:
   ```bash
   cp -r src/locales/en src/locales/de
   ```
2. Edit `src/locales/de/meta.json`:
   ```json
   { "name": "German", "nativeName": "Deutsch", "dir": "ltr" }
   ```
   Use `"dir": "rtl"` for right-to-left languages such as Arabic or Hebrew. The layout mirrors automatically.
3. Translate the values in every other JSON file in the folder. Keep the keys and the `{{placeholders}}` unchanged.
   - Plural keys end in `_one` / `_other`. Add `_zero`, `_two`, `_few` or `_many` if your language needs them; see [i18next plurals](https://www.i18next.com/translation-function/plurals).
4. Run the check:
   ```bash
   npm run i18n:check
   ```
   It reports any missing or extra keys and mismatched placeholders.

No code changes are needed. The new language appears in the language menu and in **Settings**, and is picked automatically for browsers set to that language.

## Project structure

```
src/
├─ app/            App shell: router, masthead, world layout, app-level screens
├─ core/
│  ├─ db/          Dexie (IndexedDB) schema
│  ├─ i18n/        i18next setup, locale discovery, Intl formatters
│  ├─ lore/        Domain layer: types, worlds, pages, links, calendar
│  │               api.ts is the read API every module uses
│  └─ mcp/         Claude connection: bridge client, tool handlers, proposals
├─ modules/
│  ├─ registry.ts  Installed modules (routes are mounted from here)
│  └─ encyclopedia/  Module 1: Lore Encyclopedia (screens, components)
├─ ui/             Design tokens and shared UI primitives
├─ locales/        One folder per interface language
└─ sample-data/    Demo worlds (English and Turkish)
bridge/            MCP bridge for Claude (single file, no dependencies) and its test
scripts/           Repository checks (i18n, logical CSS)
```

### Adding a module

Future modules such as *NPC Personality Lab*, *Playtest Feedback Hub* and *Store Page Studio* plug in the same way:

1. Create `src/modules/<name>/manifest.tsx` exporting a `WorldledgerModule`, which declares its routes under `/w/:worldId/<basePath>`.
2. Add it to `src/modules/registry.ts`.
3. Read lore through `src/core/lore/api.ts`, for example `getPages(worldId, { builtIn: 'character' })` or `getLinkedPages(id)`.
4. If the module needs its own tables, add namespaced stores in a new Dexie version in `src/core/db/db.ts`.
5. Put its translations in a new namespace file in each locale folder, and register the namespace in `src/core/i18n/index.ts`.

## Tech stack

| Area | Library |
|---|---|
| App | Vite, React 19, TypeScript, React Router (hash routing) |
| Storage | Dexie on IndexedDB |
| Translation | i18next and react-i18next |
| Markdown | react-markdown, remark-gfm, rehype-sanitize |
| Editor | CodeMirror 6 |
| Fonts | Literata and Archivo, self-hosted via Fontsource |
