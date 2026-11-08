import { Inbox, Plus, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { guessCategory } from '../../../core/ai/context'
import { createPage } from '../../../core/lore/pages'
import { AIPanel, type AIRequest } from '../components/AIPanel'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useWorldContext } from '../../../app/shell/WorldLayout'
import { useDocumentTitle } from '../../../app/shell/useDocumentTitle'
import { useFormat } from '../../../core/i18n/format'
import { usePageCounts, useRecentPages, useRedLinks } from '../../../core/lore/api'
import { categoryName } from '../../../core/lore/categories'
import { usePendingCount } from '../../../core/mcp/proposals'
import { ButtonLink } from '../../../ui/Button'
import { CategoryIcon } from '../../../ui/CategoryIcon'
import { StatusMark } from '../components/StatusMark'
import styles from './WorldHome.module.css'

/** The world's title page: summary, table of contents, recent entries, wanted pages. */
export function WorldHome() {
  const { world, categories } = useWorldContext()
  const { t } = useTranslation()
  const fmt = useFormat()
  const counts = usePageCounts(world.id)
  const recent = useRecentPages(world.id, 8)
  const wanted = useRedLinks(world.id)
  const pending = usePendingCount(world.id) ?? 0
  useDocumentTitle(world.name)
  const navigate = useNavigate()
  const [ai, setAi] = useState<AIRequest | null>(null)

  const total = counts ? [...counts.values()].reduce((a, b) => a + b, 0) : undefined
  const byId = new Map(categories.map((c) => [c.id, c]))
  const character = categories.find((c) => c.builtIn === 'character')
  const location = categories.find((c) => c.builtIn === 'location')
  const base = `/w/${world.id}`

  return (
    <div className={styles.page}>
      <header className={styles.titlePage}>
        <h1 className={styles.title} lang={world.contentLanguage}>
          {world.name}
        </h1>
        <p className={styles.meta} lang={world.contentLanguage}>
          {[world.genre, world.tone, fmt.languageName(world.contentLanguage)].filter(Boolean).join(' · ')}
        </p>
        {world.summary ? (
          <p className={styles.summary} lang={world.contentLanguage}>
            {world.summary}
          </p>
        ) : (
          <p className={styles.summaryEmpty}>
            {t('encyclopedia:home.noSummary')} <Link to={`${base}/settings`}>{t('encyclopedia:home.addSummary')}</Link>
          </p>
        )}
      </header>

      {pending > 0 && (
        <aside className={styles.proposals} aria-labelledby="proposals-notice">
          <Inbox aria-hidden="true" className={styles.proposalsIcon} />
          <p id="proposals-notice" className={styles.proposalsText}>{t('mcp:inbox.homeNotice', { count: pending })}</p>
          <ButtonLink to={`${base}/proposals`} size="sm" variant="primary">
            {t('mcp:inbox.homeAction')}
          </ButtonLink>
        </aside>
      )}

      {total === 0 ? (
        <section className={styles.firstSteps} aria-labelledby="first-steps">
          <h2 id="first-steps" className={styles.firstTitle}>
            {t('onboarding:world.title')}
          </h2>
          <p className={styles.firstLede}>{t('onboarding:world.lede')}</p>
          <ol className={styles.firstList}>
            <li>
              <strong>{t('onboarding:world.step1Title')}</strong>
              <span>{t('onboarding:world.step1Body')}</span>
            </li>
            <li>
              <strong>{t('onboarding:world.step2Title')}</strong>
              <span>{t('onboarding:world.step2Body')}</span>
            </li>
            <li>
              <strong>{t('onboarding:world.step3Title')}</strong>
              <span>{t('onboarding:world.step3Body')}</span>
            </li>
          </ol>
          <div className={styles.firstActions}>
            {character && (
              <ButtonLink to={`${base}/new?category=${character.id}`} variant="primary" icon={<Plus aria-hidden="true" />}>
                {t('onboarding:world.firstCharacter')}
              </ButtonLink>
            )}
            {location && (
              <ButtonLink to={`${base}/new?category=${location.id}`} icon={<Plus aria-hidden="true" />}>
                {t('onboarding:world.firstLocation')}
              </ButtonLink>
            )}
          </div>
        </section>
      ) : (
        <div className={styles.spread}>
          <section aria-labelledby="contents">
            <h2 id="contents" className={styles.sectionTitle}>
              {t('encyclopedia:home.contents')}
            </h2>
            <ol role="list" className={styles.toc}>
              {categories.map((c) => (
                <li key={c.id} data-ink={c.ink}>
                  <Link to={`${base}/c/${c.id}`} className={styles.tocRow}>
                    <CategoryIcon name={c.icon} className={styles.tocIcon} />
                    <span className={styles.tocName}>{categoryName(c, t, true)}</span>
                    <span className={styles.tocLeader} aria-hidden="true" />
                    <span className={styles.tocCount}>{fmt.number(counts?.get(c.id) ?? 0)}</span>
                  </Link>
                </li>
              ))}
            </ol>
            <p className={styles.total}>{t('encyclopedia:home.total', { count: total ?? 0 })}</p>
          </section>

          <section aria-labelledby="recent">
            <h2 id="recent" className={styles.sectionTitle}>
              {t('encyclopedia:home.recent')}
            </h2>
            <ul role="list" className={styles.recent}>
              {recent?.map((p) => {
                const c = byId.get(p.categoryId)
                return (
                  <li key={p.id} data-ink={c?.ink}>
                    <Link to={`${base}/p/${p.id}`} className={styles.recentLink}>
                      <span className={styles.recentTitle} lang={world.contentLanguage}>
                        {p.title}
                      </span>{' '}
                      <StatusMark status={p.status} />
                    </Link>
                    <span className={styles.recentMeta}>
                      {c ? categoryName(c, t) : ''} · {fmt.relative(p.updatedAt)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>

          <section aria-labelledby="wanted" className={styles.wanted}>
            <h2 id="wanted" className={styles.sectionTitle}>
              {t('encyclopedia:home.wanted')}
            </h2>
            {wanted && wanted.length > 0 ? (
              <>
                <p className={styles.wantedLede}>{t('encyclopedia:home.wantedLede')}</p>
                <ul role="list" className={styles.wantedList}>
                  {wanted.slice(0, 12).map((w) => (
                    <li key={w.key}>
                      <Link
                        to={`${base}/new?title=${encodeURIComponent(w.title)}`}
                        className={styles.wantedLink}
                        lang={world.contentLanguage}
                      >
                        {w.title}
                      </Link>
                      <span className={styles.wantedCount}>{t('encyclopedia:home.wantedCount', { count: w.count })}</span>
                      <button
                        type="button"
                        className={styles.draftButton}
                        onClick={async () => setAi({ task: 'fillMissing', title: w.title, categoryId: await guessCategory(world, w.title) })}
                        aria-label={t('ai:action.draftFor', { title: w.title })}
                        title={t('ai:action.draftFor', { title: w.title })}
                      >
                        <Sparkles aria-hidden="true" />
                        <span>{t('ai:action.draftShort')}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className={styles.wantedLede}>{t('encyclopedia:home.wantedNone')}</p>
            )}
          </section>
        </div>
      )}
      <AIPanel
        request={ai}
        world={world}
        categories={categories}
        onClose={() => setAi(null)}
        acceptLabel={t('ai:action.createAccept')}
        onAccept={async (text, { categoryId }) => {
          if (!ai) return
          const page = await createPage({ worldId: world.id, categoryId: categoryId ?? categories[0].id, title: ai.title, body: text, status: 'draft' })
          navigate(`${base}/p/${page.id}`, { state: { notice: t('ai:panel.created') } })
        }}
      />
    </div>
  )
}
