import { useLiveQuery } from 'dexie-react-hooks'
import { Check, FilePen, FilePlus2, Settings as SettingsIcon, Trash2, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useWorldContext } from '../../../app/shell/WorldLayout'
import { useDocumentTitle } from '../../../app/shell/useDocumentTitle'
import { useFormat } from '../../../core/i18n/format'
import { usePage, usePageTitles } from '../../../core/lore/api'
import { categoryName } from '../../../core/lore/categories'
import { LoreError } from '../../../core/lore/errors'
import { cleanFields, fieldLabel, isEmptyValue, isPageRef, isWorldDate, optionLabel } from '../../../core/lore/fields'
import { foldKey } from '../../../core/lore/normalize'
import { findPageByKey } from '../../../core/lore/pages'
import type { Category, FieldDef, ID, Page, WorldDate } from '../../../core/lore/types'
import { acceptProposal, clearReviewed, deleteProposal, rejectProposal, saveProposal, useProposals } from '../../../core/mcp/proposals'
import { useMcpSettings } from '../../../core/mcp/settings'
import type { CreateProposal, Proposal, ProposalWarning, UpdateProposal } from '../../../core/mcp/types'
import { Button } from '../../../ui/Button'
import { CategoryIcon } from '../../../ui/CategoryIcon'
import { ConfirmDialog } from '../../../ui/ConfirmDialog'
import { SelectField, TextAreaField, TextField } from '../../../ui/Field'
import { Infobox } from '../components/Infobox'
import { InfoboxForm } from '../components/InfoboxForm'
import { MarkdownView } from '../components/MarkdownView'
import styles from './Proposals.module.css'

type Notice = { text: string; pageId?: ID }

/** Claude's drafts, waiting for review: preview, edit, accept or reject. */
export function Proposals() {
  const { world } = useWorldContext()
  const { t } = useTranslation()
  const proposals = useProposals(world.id)
  const settings = useMcpSettings()
  const [view, setView] = useState<'waiting' | 'reviewed'>('waiting')
  const [notice, setNotice] = useState<Notice>()
  const [confirmClear, setConfirmClear] = useState(false)
  useDocumentTitle(t('mcp:inbox.title'), world.name)

  if (!proposals) return <div className={styles.page} aria-busy="true" />
  const pending = proposals.filter((p) => p.status === 'pending')
  const reviewed = proposals.filter((p) => p.status !== 'pending')
  const base = `/w/${world.id}`

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>{t('mcp:inbox.title')}</h1>
          <p className={styles.lede}>{t('mcp:inbox.lede')}</p>
        </div>
        <div className={styles.switch} role="group" aria-label={t('mcp:inbox.title')}>
          <button type="button" aria-pressed={view === 'waiting'} onClick={() => setView('waiting')}>
            {t('mcp:inbox.waiting')} <span className={styles.count}>{pending.length}</span>
          </button>
          <button type="button" aria-pressed={view === 'reviewed'} onClick={() => setView('reviewed')}>
            {t('mcp:inbox.reviewed')} <span className={styles.count}>{reviewed.length}</span>
          </button>
        </div>
      </header>

      <div role="status" className={styles.noticeSlot}>
        {notice && (
          <p className={styles.notice}>
            {notice.text}{' '}
            {notice.pageId && <Link to={`${base}/p/${notice.pageId}`}>{t('mcp:proposal.openPage')}</Link>}
          </p>
        )}
      </div>

      {view === 'waiting' ? (
        pending.length ? (
          <ol role="list" className={styles.list}>
            {pending.map((p) => (
              <li key={p.id}>
                <ProposalSlip proposal={p} onDone={setNotice} />
              </li>
            ))}
          </ol>
        ) : (
          <section className={styles.empty}>
            <h2 className={styles.emptyTitle}>{t('mcp:inbox.emptyTitle')}</h2>
            <p className={styles.emptyBody}>{settings?.enabled === false ? t('mcp:inbox.emptyOff') : t('mcp:inbox.emptyBody')}</p>
            <Link to="/settings#claude" className={styles.settingsLink}>
              <SettingsIcon aria-hidden="true" />
              {t('mcp:inbox.openSettings')}
            </Link>
          </section>
        )
      ) : reviewed.length ? (
        <>
          <ol role="list" className={styles.history}>
            {reviewed.map((p) => (
              <li key={p.id}>
                <ReviewedRow proposal={p} />
              </li>
            ))}
          </ol>
          <div className={styles.historyActions}>
            <Button size="sm" variant="quiet" icon={<Trash2 aria-hidden="true" />} onClick={() => setConfirmClear(true)}>
              {t('mcp:inbox.clearHistory')}
            </Button>
          </div>
        </>
      ) : (
        <p className={styles.emptyBody}>{t('mcp:inbox.reviewedEmpty')}</p>
      )}

      <ConfirmDialog
        open={confirmClear}
        title={t('mcp:inbox.clearConfirm')}
        confirmLabel={t('mcp:inbox.clearHistory')}
        onCancel={() => setConfirmClear(false)}
        onConfirm={async () => {
          await clearReviewed(world.id)
          setConfirmClear(false)
        }}
      >
        {t('mcp:inbox.clearBody')}
      </ConfirmDialog>
    </div>
  )
}

function KindMark({ kind }: { kind: Proposal['kind'] }) {
  const { t } = useTranslation()
  const Icon = kind === 'create' ? FilePlus2 : FilePen
  return (
    <span className={styles.kind} data-kind={kind} title={t(kind === 'create' ? 'mcp:proposal.kindCreateHint' : 'mcp:proposal.kindUpdateHint')}>
      <Icon aria-hidden="true" />
      {t(kind === 'create' ? 'mcp:proposal.kindCreate' : 'mcp:proposal.kindUpdate')}
    </span>
  )
}

/** One waiting proposal, as a proof slip: what it is, Claude's note, the preview, and the decision. */
function ProposalSlip({ proposal, onDone }: { proposal: Proposal; onDone: (n: Notice) => void }) {
  const { world, categories } = useWorldContext()
  const { t } = useTranslation()
  const fmt = useFormat()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const target = usePage(proposal.kind === 'update' ? proposal.pageId : undefined)
  const createTitle = proposal.kind === 'create' ? proposal.title : ''
  const conflict = useLiveQuery(
    async () => (createTitle ? ((await findPageByKey(world.id, foldKey(createTitle))) ?? null) : null),
    [world.id, createTitle],
  )
  const categoryId = proposal.kind === 'create' ? proposal.categoryId : target?.page.categoryId
  const category = categories.find((c) => c.id === categoryId)
  const title = proposal.kind === 'create' ? proposal.title : (target?.page.title ?? proposal.pageTitle)
  const headingId = `proposal-${proposal.id}`
  // The title conflict has its own panel with actions; the rest are listed.
  const warnings = proposal.warnings.filter((w) => w.code !== 'title_taken')
  const warningText = (w: ProposalWarning) => {
    switch (w.code) {
      case 'unknown_field':
        return t('mcp:warning.unknown_field', { field: w.field, chapter: category ? categoryName(category, t) : w.chapter })
      case 'bad_value': {
        const def = category?.fields.find((f) => f.id === w.fieldId)
        return t('mcp:warning.bad_value', { value: w.value, field: def ? fieldLabel(def, t) : w.field, type: t(`encyclopedia:fieldType.${w.type}`) })
      }
      case 'bad_date':
        return t('mcp:warning.bad_date', { value: w.value, field: t(w.field === 'date' ? 'encyclopedia:field.date' : 'encyclopedia:field.endDate') })
      default:
        return t(`mcp:warning.${w.code}`, { ...w })
    }
  }

  async function accept(mergeInto?: Page) {
    setBusy(true)
    setError(undefined)
    try {
      const pageId = await acceptProposal(proposal, { mergeInto: mergeInto?.id })
      const text = mergeInto
        ? t('mcp:proposal.mergedNotice', { title: mergeInto.title })
        : proposal.kind === 'create'
          ? t('mcp:proposal.createdNotice', { title })
          : t('mcp:proposal.updatedNotice', { title })
      onDone({ text, pageId })
    } catch (err) {
      setError(err instanceof LoreError ? t(`errors:lore.${err.code}`) : String(err))
      setBusy(false)
    }
  }

  async function reject() {
    setBusy(true)
    await rejectProposal(proposal.id)
    onDone({ text: t('mcp:proposal.rejectedNotice', { title }) })
  }

  const gone = proposal.kind === 'update' && target === null

  return (
    <article className={styles.slip} data-ink={category?.ink} aria-labelledby={headingId}>
      <div className={styles.slipMeta}>
        <KindMark kind={proposal.kind} />
        {category && (
          <span className={styles.chapter}>
            <CategoryIcon name={category.icon} className={styles.chapterIcon} />
            {categoryName(category, t)}
          </span>
        )}
        <span className={styles.when}>{t('mcp:proposal.proposedAt', { when: fmt.relative(proposal.createdAt) })}</span>
      </div>
      <h2 id={headingId} className={styles.slipTitle} lang={world.contentLanguage}>
        {proposal.kind === 'update' && target ? <Link to={`/w/${world.id}/p/${target.page.id}`}>{title}</Link> : title}
      </h2>

      {proposal.note && (
        <blockquote className={styles.note}>
          <p className={styles.noteLabel}>{t('mcp:proposal.note')}</p>
          <p>{proposal.note}</p>
        </blockquote>
      )}
      {warnings.length > 0 && (
        <div className={styles.warnings}>
          <p className={styles.noteLabel}>{t('mcp:proposal.warnings')}</p>
          <ul>
            {warnings.map((w, i) => (
              <li key={i}>
                {warningText(w)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {editing ? (
        proposal.kind === 'create' ? (
          <CreateEditor proposal={proposal} onClose={() => setEditing(false)} />
        ) : target ? (
          <UpdateEditor proposal={proposal} page={target.page} category={category} onClose={() => setEditing(false)} />
        ) : null
      ) : (
        <>
          {proposal.kind === 'create' ? (
            <CreatePreview proposal={proposal} category={category} />
          ) : gone ? (
            <p className={styles.problem}>{t('mcp:proposal.pageGone')}</p>
          ) : target ? (
            <UpdatePreview proposal={proposal} page={target.page} body={target.body} category={category} />
          ) : null}

          {conflict && (
            <div className={styles.conflict} role="group" aria-label={t('mcp:proposal.conflictTitle', { title: conflict.title })}>
              <p className={styles.conflictTitle}>{t('mcp:proposal.conflictTitle', { title: conflict.title })}</p>
              <p className={styles.conflictBody}>{t('mcp:proposal.conflictBody')}</p>
            </div>
          )}
          {error && (
            <p className={styles.problem} role="alert">
              {error}
            </p>
          )}

          <div className={styles.actions}>
            {conflict ? (
              <>
                <Button variant="primary" icon={<Check aria-hidden="true" />} busy={busy} onClick={() => void accept(conflict)}>
                  <span lang={world.contentLanguage}>{t('mcp:proposal.mergeAction', { title: conflict.title })}</span>
                </Button>
                <Button onClick={() => setEditing(true)} disabled={busy}>
                  {t('mcp:proposal.renameAction')}
                </Button>
              </>
            ) : (
              !gone && (
                <>
                  <Button variant="primary" icon={<Check aria-hidden="true" />} busy={busy} onClick={() => void accept()}>
                    {t(proposal.kind === 'create' ? 'mcp:proposal.acceptCreate' : 'mcp:proposal.acceptUpdate')}
                  </Button>
                  <Button onClick={() => setEditing(true)} disabled={busy}>
                    {t('mcp:proposal.edit')}
                  </Button>
                </>
              )
            )}
            <Button variant="quiet" icon={<X aria-hidden="true" />} onClick={() => void reject()} disabled={busy} className={styles.reject}>
              {t('mcp:proposal.reject')}
            </Button>
          </div>
        </>
      )}
    </article>
  )
}

function pseudoPage(p: CreateProposal): Page {
  return {
    id: p.id,
    worldId: p.worldId,
    categoryId: p.categoryId,
    title: p.title,
    titleKey: foldKey(p.title),
    aliases: p.aliases,
    keys: [],
    fields: p.fields,
    date: p.date,
    endDate: p.endDate,
    status: 'draft',
    wordCount: 0,
    excerpt: '',
    createdAt: p.createdAt,
    updatedAt: p.createdAt,
  }
}

function CreatePreview({ proposal, category }: { proposal: CreateProposal; category?: Category }) {
  const { world } = useWorldContext()
  const { t } = useTranslation()
  return (
    <div className={styles.preview}>
      <div className={styles.proof}>
        {proposal.aliases.length > 0 && (
          <p className={styles.aliases} lang={world.contentLanguage}>
            <span className={styles.aliasesLabel}>{t('mcp:proposal.aliases')}</span> {proposal.aliases.join(', ')}
          </p>
        )}
        {proposal.body.trim() ? (
          <MarkdownView markdown={proposal.body} worldId={world.id} lang={world.contentLanguage} />
        ) : (
          <p className={styles.muted}>{t('mcp:proposal.noBody')}</p>
        )}
      </div>
      {(proposal.date || Object.keys(proposal.fields).length > 0) && <Infobox page={pseudoPage(proposal)} category={category} world={world} />}
    </div>
  )
}

/** Plain-text rendering of a stat-block value, for the before/after table. */
function useValueText() {
  const { world } = useWorldContext()
  const { t } = useTranslation()
  const fmt = useFormat()
  return (def: FieldDef | undefined, v: unknown): string => {
    if (v === undefined || v === null || (def && isEmptyValue(def, v))) return ''
    if (isWorldDate(v)) return fmt.worldDate(v, world.calendar)
    if (isPageRef(v)) return v.ref
    if (Array.isArray(v)) return v.map((x) => (isPageRef(x) ? x.ref : String(x))).join(', ')
    if (typeof v === 'boolean') return t(v ? 'common:yes' : 'common:no')
    if (typeof v === 'number') return fmt.number(v)
    if (def?.type === 'select' && typeof v === 'string') return optionLabel(def, v, t)
    return String(v)
  }
}

function UpdatePreview({ proposal, page, body, category }: { proposal: UpdateProposal; page: Page; body: string; category?: Category }) {
  const { world } = useWorldContext()
  const { t } = useTranslation()
  const valueText = useValueText()
  const fieldIds = Object.keys(proposal.fields)
  return (
    <div className={styles.changes}>
      {proposal.replaceBody !== undefined && (
        <section className={styles.change}>
          <h3 className={styles.changeTitle}>{t('mcp:proposal.replaceTitle')}</h3>
          <div className={styles.proof}>
            <MarkdownView markdown={proposal.replaceBody} worldId={world.id} lang={world.contentLanguage} />
          </div>
          {body.trim() && (
            <details className={styles.current}>
              <summary>{t('mcp:proposal.currentText')}</summary>
              <MarkdownView markdown={body} worldId={world.id} lang={world.contentLanguage} />
            </details>
          )}
        </section>
      )}
      {proposal.append && (
        <section className={styles.change}>
          <h3 className={styles.changeTitle}>{t('mcp:proposal.appendTitle')}</h3>
          <div className={`${styles.proof} ${styles.addition}`}>
            <MarkdownView markdown={proposal.append} worldId={world.id} lang={world.contentLanguage} />
          </div>
        </section>
      )}
      {fieldIds.length > 0 && (
        <section className={styles.change}>
          <h3 className={styles.changeTitle}>{t('mcp:proposal.fieldsTitle')}</h3>
          <table className={styles.diff}>
            <thead>
              <tr>
                <th scope="col">{t('mcp:proposal.fieldColumn')}</th>
                <th scope="col">{t('mcp:proposal.nowColumn')}</th>
                <th scope="col">{t('mcp:proposal.proposedColumn')}</th>
              </tr>
            </thead>
            <tbody lang={world.contentLanguage}>
              {fieldIds.map((id) => {
                const def = category?.fields.find((f) => f.id === id)
                const now = valueText(def, page.fields[id])
                const next = proposal.fields[id]
                return (
                  <tr key={id}>
                    <th scope="row" lang={undefined}>{def ? fieldLabel(def, t) : id}</th>
                    <td className={now ? undefined : styles.muted}>{now ? <del>{now}</del> : t('mcp:proposal.empty')}</td>
                    <td className={next === null ? styles.muted : undefined}>{next === null ? t('mcp:proposal.cleared') : <ins>{valueText(def, next)}</ins>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}
      {proposal.aliases.length > 0 && (
        <section className={styles.change}>
          <h3 className={styles.changeTitle}>{t('mcp:proposal.aliasesTitle')}</h3>
          <p lang={world.contentLanguage}>
            <ins>{proposal.aliases.join(', ')}</ins>
          </p>
        </section>
      )}
    </div>
  )
}

const splitAliases = (s: string) => s.split(',').map((a) => a.trim()).filter(Boolean)

function CreateEditor({ proposal, onClose }: { proposal: CreateProposal; onClose: () => void }) {
  const { world, categories } = useWorldContext()
  const { t } = useTranslation()
  const titles = usePageTitles(world.id)
  const [title, setTitle] = useState(proposal.title)
  const [categoryId, setCategoryId] = useState(proposal.categoryId)
  const [aliases, setAliases] = useState(proposal.aliases.join(', '))
  const [body, setBody] = useState(proposal.body)
  const [fields, setFields] = useState(proposal.fields)
  const [date, setDate] = useState<WorldDate | undefined>(proposal.date)
  const [endDate, setEndDate] = useState<WorldDate | undefined>(proposal.endDate)
  const [error, setError] = useState<string>()
  const category = categories.find((c) => c.id === categoryId)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return setError(t('errors:lore.title_required'))
    const dated = category?.builtIn === 'event'
    await saveProposal({
      ...proposal,
      title: title.trim(),
      categoryId,
      aliases: splitAliases(aliases),
      body,
      fields: cleanFields(category?.fields ?? [], fields),
      date: dated ? date : undefined,
      endDate: dated && date ? endDate : undefined,
    })
    onClose()
  }

  return (
    <form className={styles.editor} onSubmit={submit} noValidate>
      <div className={styles.editorRow}>
        <TextField label={t('encyclopedia:page.title')} value={title} onChange={(e) => { setTitle(e.target.value); setError(undefined) }}
          error={error} lang={world.contentLanguage} />
        <SelectField label={t('encyclopedia:page.category')} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{categoryName(c, t)}</option>
          ))}
        </SelectField>
      </div>
      <TextField label={t('mcp:proposal.aliases')} hint={t('mcp:proposal.aliasesHint')} value={aliases} onChange={(e) => setAliases(e.target.value)} lang={world.contentLanguage} />
      <TextAreaField label={t('encyclopedia:editor.body')} value={body} onChange={(e) => setBody(e.target.value)} rows={12} lang={world.contentLanguage} className={styles.bodyInput} />
      {category && (
        <InfoboxForm
          fields={category.fields}
          values={fields}
          onChange={(id, v) => setFields((f) => ({ ...f, [id]: v }))}
          titles={(titles ?? []).map((p) => p.title)}
          calendar={world.calendar}
          lang={world.contentLanguage}
          dates={category.builtIn === 'event' ? { date, endDate, onDate: setDate, onEndDate: setEndDate } : undefined}
        />
      )}
      <div className={styles.actions}>
        <Button type="submit" variant="primary">{t('mcp:proposal.save')}</Button>
        <Button onClick={onClose}>{t('mcp:proposal.cancel')}</Button>
      </div>
    </form>
  )
}

function UpdateEditor({ proposal, page, category, onClose }: { proposal: UpdateProposal; page: Page; category?: Category; onClose: () => void }) {
  const { world } = useWorldContext()
  const { t } = useTranslation()
  const titles = usePageTitles(world.id)
  const merged = useMemo(() => {
    const v = { ...page.fields }
    for (const [k, x] of Object.entries(proposal.fields)) {
      if (x === null) delete v[k]
      else v[k] = x
    }
    return v
  }, [page.fields, proposal.fields])
  const [append, setAppend] = useState(proposal.append ?? '')
  const [replaceBody, setReplaceBody] = useState(proposal.replaceBody)
  const [values, setValues] = useState(merged)
  const [aliases, setAliases] = useState(proposal.aliases.join(', '))

  async function submit(e: FormEvent) {
    e.preventDefault()
    const fields: Record<string, unknown> = {}
    for (const def of category?.fields ?? []) {
      const next = values[def.id]
      const before = page.fields[def.id]
      const nextEmpty = isEmptyValue(def, next)
      if (nextEmpty && isEmptyValue(def, before)) continue
      if (JSON.stringify(nextEmpty ? undefined : next) !== JSON.stringify(before)) fields[def.id] = nextEmpty ? null : next
    }
    await saveProposal({ ...proposal, append: append.trim() || undefined, replaceBody, fields, aliases: splitAliases(aliases) })
    onClose()
  }

  return (
    <form className={styles.editor} onSubmit={submit} noValidate>
      {replaceBody !== undefined && (
        <TextAreaField label={t('mcp:proposal.replace')} value={replaceBody} onChange={(e) => setReplaceBody(e.target.value)} rows={12} lang={world.contentLanguage} className={styles.bodyInput} />
      )}
      <TextAreaField label={t('mcp:proposal.append')} value={append} onChange={(e) => setAppend(e.target.value)} rows={8} lang={world.contentLanguage} className={styles.bodyInput} />
      {category && category.fields.length > 0 && (
        <InfoboxForm
          fields={category.fields}
          values={values}
          onChange={(id, v) => setValues((f) => ({ ...f, [id]: v }))}
          titles={(titles ?? []).filter((p) => p.id !== page.id).map((p) => p.title)}
          calendar={world.calendar}
          lang={world.contentLanguage}
        />
      )}
      <TextField label={t('mcp:proposal.aliasesTitle')} hint={t('mcp:proposal.aliasesHint')} value={aliases} onChange={(e) => setAliases(e.target.value)} lang={world.contentLanguage} />
      <div className={styles.actions}>
        <Button type="submit" variant="primary">{t('mcp:proposal.save')}</Button>
        <Button onClick={onClose}>{t('mcp:proposal.cancel')}</Button>
      </div>
    </form>
  )
}

function ReviewedRow({ proposal }: { proposal: Proposal }) {
  const { world } = useWorldContext()
  const { t } = useTranslation()
  const fmt = useFormat()
  const title = proposal.kind === 'create' ? proposal.title : proposal.pageTitle
  const accepted = proposal.status === 'accepted'
  const status = proposal.direct ? t('mcp:proposal.savedDirectly') : t(accepted ? 'mcp:proposal.accepted' : 'mcp:proposal.rejected')
  return (
    <div className={styles.row} data-status={proposal.status}>
      <span className={styles.rowMark} aria-hidden="true">
        {accepted ? <Check /> : <X />}
      </span>
      <span className={styles.rowMain}>
        <span className={styles.rowTitle} lang={world.contentLanguage}>
          {accepted && proposal.resultPageId ? <Link to={`/w/${world.id}/p/${proposal.resultPageId}`}>{title}</Link> : title}
        </span>
        <span className={styles.rowMeta}>
          <KindMark kind={proposal.kind} />
          {t('mcp:proposal.decidedAt', { status, when: fmt.relative(proposal.decidedAt ?? proposal.createdAt) })}
        </span>
      </span>
      <Button size="sm" variant="quiet" icon={<Trash2 aria-hidden="true" />} onClick={() => void deleteProposal(proposal.id)}
        aria-label={`${t('mcp:proposal.delete')}: ${title}`} title={t('mcp:proposal.delete')} />
    </div>
  )
}
