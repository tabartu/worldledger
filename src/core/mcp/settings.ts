import { useLiveQuery } from 'dexie-react-hooks'
import { secrets } from '../ai/secrets'
import { DEFAULT_BRIDGE_URL, DEFAULT_MCP_SETTINGS, type McpSettings } from './types'

/**
 * Claude connection settings live with the AI settings: per browser,
 * never exported or backed up.
 */
export async function getMcpSettings(): Promise<McpSettings> {
  const row = await secrets.settings.get('mcp')
  return { ...DEFAULT_MCP_SETTINGS, ...((row?.value as Partial<McpSettings>) ?? {}) }
}

export async function setMcpSettings(patch: Partial<McpSettings>): Promise<void> {
  const next = { ...(await getMcpSettings()), ...patch }
  next.url = next.url.trim().replace(/\/+$/, '') || DEFAULT_BRIDGE_URL
  await secrets.settings.put({ key: 'mcp', value: next })
}

export function useMcpSettings(): McpSettings | undefined {
  return useLiveQuery(getMcpSettings, [])
}
