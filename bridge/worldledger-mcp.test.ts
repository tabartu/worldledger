/**
 * End-to-end test of the MCP bridge: starts the real bridge process, plays
 * the Worldledger tab (long-poll + result) and the MCP client (stdio JSON-RPC).
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const SCRIPT = fileURLToPath(new URL('./worldledger-mcp.mjs', import.meta.url))
const PORT = 18000 + Math.floor(Math.random() * 1000)
const BASE = `http://127.0.0.1:${PORT}`
const ORIGIN = 'http://localhost:5173'

class McpClient {
  proc: ChildProcessWithoutNullStreams
  private buf = ''
  private nextId = 1
  private waiting = new Map<number, (msg: any) => void>()
  stderr = ''
  constructor() {
    this.proc = spawn(process.execPath, [SCRIPT], { env: { ...process.env, WORLDLEDGER_BRIDGE_PORT: String(PORT), WORLDLEDGER_ORIGINS: '' } })
    this.proc.stdout.setEncoding('utf8')
    this.proc.stdout.on('data', (c: string) => {
      this.buf += c
      let nl
      while ((nl = this.buf.indexOf('\n')) >= 0) {
        const msg = JSON.parse(this.buf.slice(0, nl))
        this.buf = this.buf.slice(nl + 1)
        this.waiting.get(msg.id)?.(msg)
      }
    })
    this.proc.stderr.on('data', (c) => (this.stderr += c))
  }
  /** Resolves once the bridge has logged that it is listening or forwarding. */
  ready() {
    return new Promise<void>((resolve) => {
      const check = () => (/listening|forwarding/.test(this.stderr) ? resolve() : setTimeout(check, 20))
      check()
    })
  }
  request(method: string, params?: unknown): Promise<any> {
    const id = this.nextId++
    return new Promise((resolve) => {
      this.waiting.set(id, resolve)
      this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
    })
  }
  close() {
    this.proc.stdin.end()
  }
}

/** A fake Worldledger tab: answers tool calls until stopped. */
function fakeBrowser(handle: (tool: string, args: any) => unknown) {
  const abort = new AbortController()
  const loop = (async () => {
    while (!abort.signal.aborted) {
      const res = await fetch(`${BASE}/poll?client=test`, { headers: { Origin: ORIGIN }, signal: abort.signal }).catch(() => null)
      if (!res) break
      if (res.status !== 200) continue
      const call = await res.json()
      let body
      try {
        body = { id: call.id, ok: true, result: await handle(call.tool, call.args) }
      } catch (err) {
        body = { id: call.id, ok: false, error: (err as Error).message }
      }
      await fetch(`${BASE}/result`, { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    }
  })()
  return { stop: () => (abort.abort(), loop) }
}

const text = (r: any) => r.result.content[0].text as string

describe('worldledger-mcp bridge', () => {
  let owner: McpClient
  let forwarder: McpClient
  beforeAll(async () => {
    owner = new McpClient()
    await owner.ready()
    forwarder = new McpClient()
    await forwarder.ready()
  })
  afterAll(() => {
    owner?.close()
    forwarder?.close()
  })

  it('speaks MCP: initialize and tools/list', async () => {
    const init = await owner.request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } })
    expect(init.result.serverInfo.name).toBe('worldledger')
    expect(init.result.instructions).toMatch(/Proposals inbox/)
    const list = await owner.request('tools/list')
    expect(list.result.tools.map((t: any) => t.name)).toContain('propose_page')
    const unknown = await owner.request('nope/nope')
    expect(unknown.error.code).toBe(-32601)
  })

  it('reports a clear error while no Worldledger tab is connected', async () => {
    const r = await owner.request('tools/call', { name: 'list_worlds', arguments: {} })
    expect(r.result.isError).toBe(true)
    expect(text(r)).toMatch(/not connected/)
  })

  it('refuses browsers from other origins', async () => {
    const res = await fetch(`${BASE}/status`, { headers: { Origin: 'https://evil.example' } })
    expect(res.status).toBe(403)
    const forward = await fetch(`${BASE}/forward`, { method: 'POST', headers: { Origin: ORIGIN }, body: '{}' })
    expect(forward.status).toBe(403)
    const ok = await fetch(`${BASE}/status`, { headers: { Origin: 'https://someone.github.io' } })
    expect(ok.status).toBe(200)
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://someone.github.io')
  })

  it('relays tool calls to the tab and back, from both MCP clients', async () => {
    const browser = fakeBrowser((tool, args) => {
      if (tool === 'list_worlds') return [{ name: 'Ashfall', pages: 3 }]
      if (tool === 'get_page') throw new Error(`No page titled "${args.title}"`)
      return `ran ${tool}`
    })
    // The first call may arrive before the tab's first poll; the bridge waits for it.
    const a = await owner.request('tools/call', { name: 'list_worlds', arguments: {} })
    expect(JSON.parse(text(a))).toEqual([{ name: 'Ashfall', pages: 3 }])
    const b = await forwarder.request('tools/call', { name: 'get_timeline', arguments: { world: 'Ashfall' } })
    expect(text(b)).toBe('ran get_timeline')
    const c = await forwarder.request('tools/call', { name: 'get_page', arguments: { title: 'Nobody' } })
    expect(c.result.isError).toBe(true)
    expect(text(c)).toBe('No page titled "Nobody"')
    const d = await owner.request('tools/call', { name: 'drop_tables', arguments: {} })
    expect(d.error.code).toBe(-32602)
    await browser.stop()
  }, 15_000)
})
