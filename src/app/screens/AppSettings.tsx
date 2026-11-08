import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router'
import { LOCALES } from '../../core/i18n'
import layout from '../../ui/layout.module.css'
import { Masthead } from '../shell/Masthead'
import { useDocumentTitle } from '../shell/useDocumentTitle'
import { useTheme, type ThemePref } from '../theme'
import { AISettings } from './AISettings'
import styles from './AppSettings.module.css'
import { McpSettings } from './McpSettings'

const THEMES: ThemePref[] = ['system', 'light', 'dark']

export function AppSettings() {
  const { t, i18n } = useTranslation()
  const [theme, setTheme] = useTheme()
  useDocumentTitle(t('common:nav.appSettings'))
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    const timer = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }), 50)
    return () => clearTimeout(timer)
  }, [hash])
  return (
    <>
      <Masthead />
      <main id="main" className={`${layout.page} ${layout.narrow}`}>
        <header className={layout.header}>
          <div>
            <h1 className={layout.title}>{t('common:nav.appSettings')}</h1>
            <p className={layout.lede}>{t('settings:lede')}</p>
          </div>
        </header>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>{t('settings:language.title')}</legend>
          <p className={styles.help}>{t('settings:language.help')}</p>
          <div className={styles.options}>
            {LOCALES.map((l) => (
              <label key={l.code} className={styles.option}>
                <input
                  type="radio"
                  name="language"
                  checked={i18n.resolvedLanguage === l.code}
                  onChange={() => void i18n.changeLanguage(l.code)}
                />
                <span lang={l.code} className={styles.optionLabel}>
                  {l.nativeName}
                </span>
                <span className={styles.optionMeta}>{l.code}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>{t('settings:theme.title')}</legend>
          <div className={styles.options}>
            {THEMES.map((th) => (
              <label key={th} className={styles.option}>
                <input type="radio" name="theme" checked={theme === th} onChange={() => setTheme(th)} />
                <span className={styles.optionLabel}>{t(`common:theme.${th}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <AISettings />

        <McpSettings />

        <section className={styles.group}>
          <h2 className={styles.legend}>{t('settings:data.title')}</h2>
          <p className={styles.help}>{t('settings:data.help')}</p>
        </section>
      </main>
    </>
  )
}
