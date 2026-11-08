/**
 * i18n setup. Languages are discovered from `src/locales/<code>/`:
 * adding a language means adding a folder with `meta.json` plus the
 * namespace files — no code changes.
 */
import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

export interface LocaleMeta {
  code: string
  name: string
  nativeName: string
  dir: 'ltr' | 'rtl'
}

export const NAMESPACES = ['common', 'encyclopedia', 'settings', 'onboarding', 'errors', 'ai', 'mcp'] as const
export const DEFAULT_NS = 'common'
export const FALLBACK_LANGUAGE = 'en'
export const LANGUAGE_STORAGE_KEY = 'worldledger.language'

// Keep the language chosen under the app's former name (Lorewright).
try {
  const old = localStorage.getItem('lorewright.language')
  if (old && !localStorage.getItem(LANGUAGE_STORAGE_KEY)) localStorage.setItem(LANGUAGE_STORAGE_KEY, old)
} catch {
  /* storage unavailable */
}

const files = import.meta.glob<{ default: Record<string, unknown> }>('../../locales/*/*.json', { eager: true })

const resources: Record<string, Record<string, Record<string, unknown>>> = {}
const metas: LocaleMeta[] = []

for (const [path, mod] of Object.entries(files)) {
  const match = path.match(/locales\/([^/]+)\/([^/]+)\.json$/)
  if (!match) continue
  const [, code, ns] = match
  if (ns === 'meta') {
    const meta = mod.default as Omit<LocaleMeta, 'code'>
    metas.push({ code, name: meta.name, nativeName: meta.nativeName, dir: meta.dir === 'rtl' ? 'rtl' : 'ltr' })
    continue
  }
  resources[code] ??= {}
  resources[code][ns] = mod.default
}

export const LOCALES: LocaleMeta[] = metas.sort((a, b) =>
  a.code === FALLBACK_LANGUAGE ? -1 : b.code === FALLBACK_LANGUAGE ? 1 : a.nativeName.localeCompare(b.nativeName),
)
export const SUPPORTED_LANGUAGES = LOCALES.map((l) => l.code)

export function localeMeta(code: string): LocaleMeta {
  return LOCALES.find((l) => l.code === code) ?? LOCALES.find((l) => l.code === FALLBACK_LANGUAGE)!
}

function applyDocumentLanguage(code: string) {
  const meta = localeMeta(code)
  document.documentElement.lang = meta.code
  document.documentElement.dir = meta.dir
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    ns: [...NAMESPACES],
    defaultNS: DEFAULT_NS,
    fallbackLng: FALLBACK_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
    returnNull: false,
  })

applyDocumentLanguage(i18n.resolvedLanguage ?? FALLBACK_LANGUAGE)
i18n.on('languageChanged', (lng) => applyDocumentLanguage(i18n.resolvedLanguage ?? lng))

export default i18n
