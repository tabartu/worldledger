import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { getPageWithBody } from '../lore/api'
import { LoreError } from '../lore/errors'
import { foldKey, newId } from '../lore/normalize'
import { createPage, updatePage } from '../lore/pages'
import type { ID } from '../lore/types'
import type { CreateProposal, Proposal, UpdateProposal } from './types'

type NewProposal = Omit<CreateProposal, 'id' | 'status' | 'createdAt'> | Omit<UpdateProposal, 'id' | 'status' | 'createdAt'>

export async function addProposal(p: NewProposal): Promise<Proposal> {
  const proposal = { ...p, id: newId(), status: 'pending', createdAt: Date.now() } as Proposal
  await db.proposals.add(proposal)
  return proposal
}

/** Edit a pending proposal before accepting it. */
export async function saveProposal(proposal: Proposal): Promise<void> {
  await db.proposals.put(proposal)
}

export async function rejectProposal(id: ID): Promise<void> {
  await db.proposals.update(id, { status: 'rejected', decidedAt: Date.now() })
}

export async function deleteProposal(id: ID): Promise<void> {
  await db.proposals.delete(id)
}

/** Remove reviewed proposals of a world (the inbox history). */
export async function clearReviewed(worldId: ID): Promise<void> {
  await db.proposals.where('worldId').equals(worldId).filter((p) => p.status !== 'pending').delete()
}

export interface PageChange {
  append?: string
  replaceBody?: string
  /** Field id → value; `null` clears the field. */
  fields?: Record<string, unknown>
  aliases?: string[]
}

/** The text a page will have after `change`. */
export function changedBody(current: string, change: Pick<PageChange, 'append' | 'replaceBody'>): string {
  let body = change.replaceBody ?? current
  const extra = change.append?.trim()
  if (extra) body = body.trimEnd() ? `${body.trimEnd()}\n\n${extra}\n` : `${extra}\n`
  return body
}

/** Apply an edit to an existing page: append or replace text, set fields, add aliases. */
export async function applyPageChange(pageId: ID, change: PageChange): Promise<void> {
  const data = await getPageWithBody(pageId)
  if (!data) throw new LoreError('not_found')
  const { page, body } = data
  const fields = { ...page.fields }
  for (const [k, v] of Object.entries(change.fields ?? {})) {
    if (v === null) delete fields[k]
    else fields[k] = v
  }
  const keys = new Set([page.titleKey, ...page.aliases.map(foldKey)])
  const aliases = [...page.aliases]
  for (const a of change.aliases ?? []) {
    const k = foldKey(a)
    if (k && !keys.has(k)) {
      keys.add(k)
      aliases.push(a.trim())
    }
  }
  await updatePage(pageId, { body: changedBody(body, change), fields, aliases })
}

/**
 * Accept a proposal. A new page is created as a draft; with `mergeInto`, a
 * new-page proposal whose title is taken is added to that page instead.
 * Throws LoreError('title_taken') when a new page's title already exists.
 */
export async function acceptProposal(proposal: Proposal, opts: { mergeInto?: ID; direct?: boolean } = {}): Promise<ID> {
  let pageId: ID
  if (proposal.kind === 'create') {
    if (opts.mergeInto) {
      pageId = opts.mergeInto
      await applyPageChange(pageId, { append: proposal.body, fields: proposal.fields, aliases: proposal.aliases })
    } else {
      const fields = Object.fromEntries(Object.entries(proposal.fields).filter(([, v]) => v !== null))
      const page = await createPage({
        worldId: proposal.worldId,
        categoryId: proposal.categoryId,
        title: proposal.title,
        body: proposal.body,
        aliases: proposal.aliases,
        fields,
        date: proposal.date,
        endDate: proposal.endDate,
        status: 'draft',
      })
      pageId = page.id
    }
  } else {
    pageId = proposal.pageId
    await applyPageChange(pageId, proposal)
  }
  await db.proposals.put({ ...proposal, status: 'accepted', decidedAt: Date.now(), resultPageId: pageId, direct: opts.direct || undefined })
  return pageId
}

export async function getProposals(worldId: ID): Promise<Proposal[]> {
  const all = await db.proposals.where('worldId').equals(worldId).toArray()
  return all.sort((a, b) => b.createdAt - a.createdAt)
}

export function useProposals(worldId: ID | undefined): Proposal[] | undefined {
  return useLiveQuery(async () => (worldId ? getProposals(worldId) : []), [worldId])
}

export function usePendingCount(worldId: ID | undefined): number | undefined {
  return useLiveQuery(
    async () => (worldId ? db.proposals.where('[worldId+status]').equals([worldId, 'pending']).count() : 0),
    [worldId],
  )
}

/** How many proposals a world has ever had (decides whether the inbox tab shows). */
export function useProposalTotal(worldId: ID | undefined): number | undefined {
  return useLiveQuery(async () => (worldId ? db.proposals.where('worldId').equals(worldId).count() : 0), [worldId])
}
