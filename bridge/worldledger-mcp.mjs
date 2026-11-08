#!/usr/bin/env node
/**
 * Worldledger MCP bridge — lets Claude (Desktop, Claude Code, or any MCP
 * client) read your Worldledger worlds and propose new lore.
 *
 * Worldledger keeps your data in the browser, so this bridge talks to the
 * open Worldledger tab:
 *
 *   Claude ──MCP (stdio)──▶ this bridge ◀──HTTP on 127.0.0.1──▶ Worldledger tab
 *
 * - Single file, no dependencies, Node 18+.
 * - Listens on 127.0.0.1 only and accepts browsers only from allowed origins
 *   (localhost dev servers and *.github.io by default; set WORLDLEDGER_ORIGINS
 *   to a comma-separated list to change it).
 * - Writes are proposals: they wait in Worldledger's Proposals inbox until
 *   you accept them, unless you allow direct writes in Worldledger's settings.
 * - Several MCP clients can run it at once: the first one owns the port and
 *   the others forward to it.
 *
 * Usage (normally started by your MCP client):
 *   node worldledger-mcp.mjs
 * Options (environment variables):
 *   WORLDLEDGER_BRIDGE_PORT  default 8788
 *   WORLDLEDGER_ORIGINS      e.g. "https://tabartu.github.io,http://localhost:5173"
 */
import http from 'node:http'
import { randomUUID } from 'node:crypto'

const PORT = Number(process.env.WORLDLEDGER_BRIDGE_PORT ?? 8788)
const VERSION = '1.0.0'
const ORIGINS = (process.env.WORLDLEDGER_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const POLL_MS = 25_000
const CALL_TIMEOUT_MS = 60_000
const log = (...a) => process.stderr.write(`[worldledger-mcp] ${a.join(' ')}\n`)

// ---------------------------------------------------------------- tools
const world = { type: 'string', description: 'World name or id. Optional when only one world exists.' }
const TOOLS = [
  {
    name: 'list_worlds',
    description: 'List the worlds in Worldledger: name, id, genre, tone, content language and page count. Start here.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_world',
    description: "A world's overview: summary, genre, tone, content language, calendar and eras, chapters (categories) with their stat-block fields, and page counts. Read this before writing lore.",
    inputSchema: { type: 'object', properties: { world } },
  },
  {
    name: 'search_pages',
    description: 'Full-text search over page titles, aliases and text in a world. Case and accents are ignored.',
    inputSchema: { type: 'object', properties: { world, query: { type: 'string' }, limit: { type: 'number', description: 'Default 15' } }, required: ['query'] },
  },
  {
    name: 'list_pages',
    description: 'List pages of a world, optionally of one chapter (e.g. "Characters", "faction"). Returns title, chapter, status and a short excerpt.',
    inputSchema: { type: 'object', properties: { world, chapter: { type: 'string' } } },
  },
  {
    name: 'get_page',
    description: 'Get one page by title or alias: Markdown text, stat-block fields, dates, aliases, links to other pages (including missing ones) and pages that link here.',
    inputSchema: { type: 'object', properties: { world, title: { type: 'string' } }, required: ['title'] },
  },
  {
    name: 'get_related_lore',
    description: 'Everything relevant to a page or topic: the page itself plus the pages it links to and that link to it, as compact text. Use it before writing or checking consistency. Works for pages that do not exist yet (gathers what mentions them).',
    inputSchema: { type: 'object', properties: { world, title: { type: 'string' }, depth: { type: 'number', description: '1 (default) or 2 rings of neighbours' } }, required: ['title'] },
  },
  {
    name: 'get_timeline',
    description: "All dated pages in order, with eras, in the world's own calendar. Includes births, deaths and foundings from stat blocks.",
    inputSchema: { type: 'object', properties: { world } },
  },
  {
    name: 'list_missing_pages',
    description: 'Pages that are linked from other pages but not written yet ("red links"), with how many pages mention each. Good candidates for new lore.',
    inputSchema: { type: 'object', properties: { world } },
  },
  {
    name: 'propose_page',
    description:
      "Propose a NEW page. Write in the world's content language, link other pages with [[Exact Title]], and fit established lore. The page goes to the user's Proposals inbox for review (unless they enabled direct writes). Fields use the chapter's stat-block field names from get_world; page references are given as titles.",
    inputSchema: {
      type: 'object',
      properties: {
        world,
        title: { type: 'string' },
        chapter: { type: 'string', description: 'Chapter name or key, e.g. "Character", "location", "Factions"' },
        body: { type: 'string', description: 'Markdown text of the page (no title heading).' },
        aliases: { type: 'array', items: { type: 'string' } },
        fields: { type: 'object', description: 'Stat-block values by field name, e.g. {"Born": 289, "Affiliation": ["House Varn"], "Home": "Varnhold"}' },
        date: { description: 'For events: a year number, or {"year":312,"month":3,"day":1}' },
        end_date: { description: 'For events lasting a while: like date.' },
        note: { type: 'string', description: 'Optional note to the user about this proposal.' },
      },
      required: ['title', 'chapter', 'body'],
    },
  },
  {
    name: 'propose_edit',
    description: "Propose a change to an EXISTING page: append text, replace the text, and/or set stat-block fields. Goes to the Proposals inbox for review (unless direct writes are enabled). Prefer append so the user's own text is kept.",
    inputSchema: {
      type: 'object',
      properties: {
        world,
        title: { type: 'string' },
        append: { type: 'string', description: 'Markdown to add at the end of the page.' },
        replace_body: { type: 'string', description: 'New full Markdown text (use sparingly).' },
        fields: { type: 'object' },
        aliases: { type: 'array', items: { type: 'string' }, description: 'Aliases to add.' },
        note: { type: 'string' },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_proposals',
    description: 'Your earlier proposals in a world and whether the user accepted, rejected or has not reviewed them yet.',
    inputSchema: { type: 'object', properties: { world } },
  },
]

const INSTRUCTIONS = `Worldledger is a lore wiki for game developers. Use these tools to read the user's game world and to propose new lore.
- Start with list_worlds and get_world. Before writing about a topic, call get_related_lore so new text fits established lore.
- Write in the world's content language (shown by get_world), whatever language the user speaks to you.
- Refer to other pages with [[Exact Page Title]]. Linking a page that does not exist yet is fine when it deserves to exist.
- Never contradict established facts; if something is unknown, leave it open.
- propose_page and propose_edit send drafts to the user's Proposals inbox in Worldledger; tell the user to review them there (unless the result says it was saved directly).
- Worldledger must be open in the user's browser with the Claude connection turned on (Settings → Claude connection).`

// ---------------------------------------------------------------- browser side (owner of the port)
const pending = new Map() // id -> { resolve, reject, timer }
const queue = [] // calls waiting for a browser poll
let waiters = [] // open long-polls
let lastSeen = 0
let lastClient = ''

function originAllowed(origin) {
  if (!origin) return false
  if (ORIGINS.length) return ORIGINS.includes(origin)
  try {
    const u = new URL(origin)
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true
    return u.protocol === 'https:' && u.hostname.endsWith('.github.io')
  } catch {
    return false
  }
}

function cors(req, res) {
  const origin = req.headers.origin
  if (originAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Allow-Private-Network', 'true')
  }
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body))
}

async function readBody(req) {
  let s = ''
  for await (const c of req) {
    s += c
    if (s.length > 5_000_000) throw new Error('too large')
  }
  return s ? JSON.parse(s) : {}
}

function dispatch() {
  while (queue.length && waiters.length) {
    const call = queue.shift()
    const w = waiters.shift()
    clearTimeout(w.timer)
    json(w.res, 200, call)
  }
}

function browserConnected() {
  return Date.now() - lastSeen < POLL_MS + 10_000
}

/** Send a tool call to the Worldledger tab and wait for its answer. */
function callBrowser(tool, args) {
  return new Promise((resolve, reject) => {
    if (!browserConnected()) {
      reject(new Error('Worldledger is not connected. Open Worldledger in your browser and turn on Settings → Claude connection, then try again.'))
      return
    }
    const id = randomUUID()
    const timer = setTimeout(() => {
      pending.delete(id)
      const i = queue.findIndex((c) => c.id === id)
      if (i >= 0) queue.splice(i, 1)
      reject(new Error('Worldledger did not answer in time. Is the tab still open?'))
    }, CALL_TIMEOUT_MS)
    pending.set(id, { resolve, reject, timer })
    queue.push({ id, tool, args: args ?? {} })
    dispatch()
  })
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  // Another bridge instance (another MCP client) forwarding a call. No browser origin allowed here.
  if (url.pathname === '/forward' && req.method === 'POST') {
    if (req.headers.origin || req.headers['x-worldledger-bridge'] !== VERSION) return json(res, 403, { error: 'forbidden' })
    try {
      const { tool, args } = await readBody(req)
      json(res, 200, { ok: true, result: await callBrowser(tool, args) })
    } catch (err) {
      json(res, 200, { ok: false, error: err.message })
    }
    return
  }
  cors(req, res)
  if (!originAllowed(req.headers.origin)) return json(res, 403, { error: 'origin not allowed' })
  if (req.method === 'OPTIONS') return res.writeHead(204).end()
  if (url.pathname === '/status') {
    lastSeen = Date.now()
    return json(res, 200, { bridge: 'worldledger-mcp', version: VERSION })
  }
  if (url.pathname === '/poll' && req.method === 'GET') {
    lastSeen = Date.now()
    lastClient = url.searchParams.get('client') ?? ''
    const w = { res, timer: setTimeout(() => {
      waiters = waiters.filter((x) => x !== w)
      res.writeHead(204).end()
    }, POLL_MS) }
    waiters.push(w)
    req.on('close', () => {
      clearTimeout(w.timer)
      waiters = waiters.filter((x) => x !== w)
    })
    dispatch()
    return
  }
  if (url.pathname === '/result' && req.method === 'POST') {
    lastSeen = Date.now()
    try {
      const { id, ok, result, error } = await readBody(req)
      const p = pending.get(id)
      if (p) {
        clearTimeout(p.timer)
        pending.delete(id)
        if (ok) p.resolve(result)
        else p.reject(new Error(error || 'Worldledger reported an error'))
      }
      return json(res, 200, { ok: true })
    } catch (err) {
      return json(res, 400, { error: err.message })
    }
  }
  json(res, 404, { error: 'not found' })
})

let mode = 'starting' // 'owner' | 'forwarder'
await new Promise((resolve) => {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      mode = 'forwarder'
      log(`port ${PORT} is in use; forwarding to the bridge already running there`)
      resolve()
    } else {
      log(`could not start: ${err.message}`)
      process.exit(1)
    }
  })
  server.listen(PORT, '127.0.0.1', () => {
    mode = 'owner'
    log(`listening on http://127.0.0.1:${PORT} for the Worldledger tab`)
    resolve()
  })
})

async function runTool(tool, args) {
  if (mode === 'owner') return callBrowser(tool, args)
  const r = await fetch(`http://127.0.0.1:${PORT}/forward`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Worldledger-Bridge': VERSION },
    body: JSON.stringify({ tool, args }),
  }).catch(() => null)
  if (!r) throw new Error(`Could not reach the Worldledger bridge on port ${PORT}.`)
  const body = await r.json()
  if (!body.ok) throw new Error(body.error)
  return body.result
}

// ---------------------------------------------------------------- MCP over stdio (JSON-RPC 2.0, one message per line)
function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n')
}

async function handle(msg) {
  const { id, method, params } = msg
  if (id === undefined) return // notification
  try {
    switch (method) {
      case 'initialize':
        return send({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: params?.protocolVersion ?? '2025-06-18',
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: 'worldledger', version: VERSION },
            instructions: INSTRUCTIONS,
          },
        })
      case 'ping':
        return send({ jsonrpc: '2.0', id, result: {} })
      case 'tools/list':
        return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } })
      case 'tools/call': {
        const name = params?.name
        if (!TOOLS.some((t) => t.name === name)) {
          return send({ jsonrpc: '2.0', id, error: { code: -32602, message: `Unknown tool: ${name}` } })
        }
        try {
          const result = await runTool(name, params?.arguments ?? {})
          return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }] } })
        } catch (err) {
          return send({ jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: err.message }] } })
        }
      }
      default:
        return send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } })
    }
  } catch (err) {
    send({ jsonrpc: '2.0', id, error: { code: -32603, message: err.message } })
  }
}

let buffer = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
  buffer += chunk
  let nl
  while ((nl = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, nl).trim()
    buffer = buffer.slice(nl + 1)
    if (!line) continue
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })
      continue
    }
    void handle(msg)
  }
})
process.stdin.on('end', () => {
  log('client closed the connection; exiting')
  server.close()
  process.exit(0)
})
