import { CheckCircle2, CircleDashed, Copy, Download, PlugZap, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFormat } from '../../core/i18n/format'
import { useBridgeStatus, type BridgeState } from '../../core/mcp/client'
import { setMcpSettings, useMcpSettings } from '../../core/mcp/settings'
import { DEFAULT_BRIDGE_URL } from '../../core/mcp/types'
import { Button } from '../../ui/Button'
import { TextField } from '../../ui/Field'
import styles from './McpSettings.module.css'

const PATH_KEY = 'worldledger.bridgePath'

/** Origins the bridge allows without WORLDLEDGER_ORIGINS (keep in step with bridge/worldledger-mcp.mjs). */
function allowedByDefault(origin: string) {
  try {
    const u = new URL(origin)
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1' || (u.protocol === 'https:' && u.hostname.endsWith('.github.io'))
  } catch {
    return false
  }
}

function bridgePort(url: string) {
  try {
    return new URL(url).port || '80'
  } catch {
    return '8788'
  }
}

const STATE_ICON: Record<BridgeState, typeof CheckCircle2> = {
  off: CircleDashed,
  connecting: CircleDashed,
  connected: CheckCircle2,
  'other-tab': CheckCircle2,
  unreachable: XCircle,
  forbidden: XCircle,
}

/** Settings → Claude connection: switch, bridge address, live status, direct writes, setup steps. */
export function McpSettings() {
  const { t } = useTranslation()
  const fmt = useFormat()
  const settings = useMcpSettings()
  const status = useBridgeStatus()
  const [path, setPath] = useState(() => {
    try {
      return localStorage.getItem(PATH_KEY) ?? ''
    } catch {
      return ''
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(PATH_KEY, path)
    } catch {
      /* storage unavailable */
    }
  }, [path])
  if (!settings) return null

  const origin = window.location.origin
  const env: Record<string, string> = {}
  if (!allowedByDefault(origin)) env.WORLDLEDGER_ORIGINS = origin
  const port = bridgePort(settings.url)
  if (port !== '8788') env.WORLDLEDGER_BRIDGE_PORT = port
  const file = path.trim() || t('mcp:settings.pathPlaceholder')
  const desktop = JSON.stringify(
    { mcpServers: { worldledger: { command: 'node', args: [file], ...(Object.keys(env).length ? { env } : {}) } } },
    null,
    2,
  )
  const quote = (s: string) => (/[\s"']/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s)
  const code = ['claude mcp add worldledger', ...Object.entries(env).map(([k, v]) => `-e ${k}=${v}`), '-- node', quote(file)].join(' ')
  const state = settings.enabled ? status.state : 'off'
  const Icon = STATE_ICON[state]

  return (
    <section id="claude" className={styles.section} aria-labelledby="claude-title">
      <h2 id="claude-title" className={styles.title}>{t('mcp:settings.title')}</h2>
      <p className={styles.help}>{t('mcp:settings.lede')}</p>

      <label className={styles.switch}>
        <input type="checkbox" checked={settings.enabled} onChange={(e) => void setMcpSettings({ enabled: e.target.checked })} />
        <span>
          <span className={styles.switchLabel}>{t('mcp:settings.enable')}</span>
          <span className={styles.hint}>{t('mcp:settings.enableHint')}</span>
        </span>
      </label>

      <div className={styles.status} role="status" data-state={state}>
        <Icon aria-hidden="true" className={styles.statusIcon} />
        <span>
          <span className="visually-hidden">{t('mcp:settings.status')}: </span>
          {t(`mcp:settings.state.${state}`)}
          {settings.enabled && status.calls > 0 && status.lastTool && status.lastCallAt && (
            <span className={styles.statusMeta}>
              {t('mcp:settings.calls', { count: status.calls })} · {t('mcp:settings.lastCall', { tool: status.lastTool, when: fmt.relative(status.lastCallAt) })}
            </span>
          )}
        </span>
      </div>

      <label className={styles.switch}>
        <input type="checkbox" checked={settings.directWrites} onChange={(e) => void setMcpSettings({ directWrites: e.target.checked })} />
        <span>
          <span className={styles.switchLabel}>{t('mcp:settings.direct')}</span>
          <span className={styles.hint}>{t('mcp:settings.directHint')}</span>
        </span>
      </label>

      <div className={styles.address}>
        <TextField
          key={settings.url}
          label={t('mcp:settings.address')}
          hint={t('mcp:settings.addressHint')}
          defaultValue={settings.url}
          placeholder={DEFAULT_BRIDGE_URL}
          onBlur={(e) => void setMcpSettings({ url: e.target.value })}
          inputMode="url"
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      <details className={styles.setup} open={!settings.enabled || state === 'unreachable' || state === 'forbidden'}>
        <summary className={styles.setupTitle}>
          <PlugZap aria-hidden="true" />
          {t('mcp:settings.setupTitle')}
        </summary>
        <p className={styles.help}>{t('mcp:settings.setupLede')}</p>
        <ol className={styles.steps}>
          <li>
            <p>{t('mcp:settings.step1')}</p>
            <a className={styles.download} href={`${import.meta.env.BASE_URL}worldledger-mcp.mjs`} download="worldledger-mcp.mjs">
              <Download aria-hidden="true" />
              {t('mcp:settings.download')}
            </a>
            <TextField label={t('mcp:settings.pathLabel')} hint={t('mcp:settings.pathHint')} value={path} onChange={(e) => setPath(e.target.value)}
              placeholder={t('mcp:settings.pathPlaceholder')} spellCheck={false} autoComplete="off" />
          </li>
          <li>
            <p>{t('mcp:settings.step2Desktop')}</p>
            <Snippet text={desktop} />
            <p>{t('mcp:settings.step2Code')}</p>
            <Snippet text={code} />
            {env.WORLDLEDGER_ORIGINS && <p className={styles.hint}>{t('mcp:settings.originNote', { origin })}</p>}
          </li>
          <li>
            <p>{t('mcp:settings.step3')}</p>
          </li>
        </ol>
        <p className={styles.privacy}>{t('mcp:settings.privacy')}</p>
      </details>
    </section>
  )
}

function Snippet({ text }: { text: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])
  return (
    <div className={styles.snippet}>
      <pre className={styles.code}>{text}</pre>
      <Button
        size="sm"
        variant="quiet"
        icon={<Copy aria-hidden="true" />}
        onClick={() => void navigator.clipboard?.writeText(text).then(() => setCopied(true), () => {})}
      >
        <span aria-live="polite">{copied ? t('mcp:settings.copied') : t('mcp:settings.copy')}</span>
      </Button>
    </div>
  )
}
