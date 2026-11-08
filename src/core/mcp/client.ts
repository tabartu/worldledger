/**
 * Browser side of the MCP bridge. While the Claude connection is on, one
 * Worldledger tab long-polls the bridge (`GET /poll`), runs each tool call
 * against IndexedDB and posts the answer (`POST /result`). Other tabs wait
 * on a Web Lock so only one tab answers.
 */
import { useEffect, useSyncExternalStore } from 'react'
import { ToolError } from './mapping'
import { useMcpSettings } from './settings'
import { runTool } from './tools'

export type BridgeState =
  | 'off'
  | 'connecting'
  | 'connected'
  /** Nothing answers at the address: the bridge is not running (Claude not open). */
  | 'unreachable'
  /** The bridge refused this site's origin. */
  | 'forbidden'
  /** Another Worldledger tab holds the connection. */
  | 'other-tab'

export interface BridgeStatus {
  state: BridgeState
  /** Tool calls answered since the connection was turned on. */
  calls: number
  lastTool?: string
  lastCallAt?: number
}

let status: BridgeStatus = { state: 'off', calls: 0 }
const listeners = new Set<() => void>()

function setStatus(patch: Partial<BridgeStatus>) {
  status = { ...status, ...patch }
  for (const l of listeners) l()
}

export function useBridgeStatus(): BridgeStatus {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => status,
  )
}

const LOCK = 'worldledger-mcp-bridge'
const CLIENT_ID = Math.random().toString(36).slice(2, 10)
const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      resolve()
    })
  })

interface Call {
  id: string
  tool: string
  args?: Record<string, unknown>
}

async function answer(url: string, call: Call, signal: AbortSignal) {
  let body: { id: string; ok: boolean; result?: unknown; error?: string }
  try {
    body = { id: call.id, ok: true, result: await runTool(call.tool, call.args) }
  } catch (err) {
    const message = err instanceof ToolError ? err.message : `Worldledger could not run ${call.tool}: ${err instanceof Error ? err.message : String(err)}`
    body = { id: call.id, ok: false, error: message }
  }
  await fetch(`${url}/result`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal })
  setStatus({ calls: status.calls + 1, lastTool: call.tool, lastCallAt: Date.now() })
}

/** Poll until `signal` aborts. Exported for tests. */
export async function pollLoop(url: string, signal: AbortSignal): Promise<void> {
  let backoff = 1000
  setStatus({ state: 'connecting' })
  while (!signal.aborted) {
    try {
      const res = await fetch(`${url}/poll?client=${CLIENT_ID}`, { signal, cache: 'no-store' })
      if (res.status === 403) {
        setStatus({ state: 'forbidden' })
        await sleep(10_000, signal)
        continue
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      backoff = 1000
      if (status.state !== 'connected') setStatus({ state: 'connected' })
      if (res.status === 204) continue
      const call = (await res.json()) as Call
      // Answer without blocking the next poll, so slow tools don't queue others.
      void answer(url, call, signal).catch(() => {})
    } catch {
      if (signal.aborted) break
      setStatus({ state: 'unreachable' })
      await sleep(backoff, signal)
      backoff = Math.min(backoff * 2, 15_000)
    }
  }
}

let controller: AbortController | null = null
let runningUrl = ''

function start(url: string) {
  if (controller && runningUrl === url) return
  stop()
  const c = new AbortController()
  controller = c
  runningUrl = url
  const run = () => pollLoop(url, c.signal)
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (!locks) {
    void run()
    return
  }
  void locks.request(LOCK, { ifAvailable: true }, async (lock) => {
    if (lock) return run()
    if (c.signal.aborted) return
    setStatus({ state: 'other-tab' })
    // Take over when the other tab closes or turns the connection off.
    await locks.request(LOCK, { signal: c.signal }, run).catch(() => {})
  })
}

function stop() {
  controller?.abort()
  controller = null
  runningUrl = ''
  setStatus({ state: 'off' })
}

/** Mounted once by the app frame: keeps the bridge connection in step with the settings. */
export function useMcpBridge() {
  const settings = useMcpSettings()
  const enabled = !!settings?.enabled
  const url = settings?.url ?? ''
  useEffect(() => {
    if (!enabled || !url) {
      stop()
      return
    }
    start(url)
  }, [enabled, url])
  useEffect(() => stop, [])
}
