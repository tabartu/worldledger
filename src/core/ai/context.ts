import { db } from '../db/db'
import { formatWorldDate } from '../lore/calendar'
import { isPageRef, isWorldDate } from '../lore/fields'
import { foldKey } from '../lore/normalize'
import type { Category, ID, Page, World } from '../lore/types'
import { categoryLabel, fieldLabelEn } from '../mcp/mapping'

/**
 * Choose which lore to send with a request: the focus page in full, then the
 * pages it links to and that link to it, then (for consistency checks) one
 * more ring, until the character budget is used. The whole world is never sent.
 */
export async function buildContext(
  world: World,
  focus: { pageId?: ID; title?: string },
  opts: { budget?: number; rings?: 1 | 2 } = {},
): Promise<{ text: string; titles: string[] }> {
  const budget = opts.budget ?? 24000
  const categories = await db.categories.where('worldId').equals(world.id).toArray()
  const byCat = new Map(categories.map((c) => [c.id, c]))
  const chosen: Page[] = []
  const seen = new Set<ID>()
  const add = (p?: Page) => {
    if (p && !seen.has(p.id)) {
      seen.add(p.id)
      chosen.push(p)
    }
  }

  let ring: ID[] = []
  if (focus.pageId) {
    add(await db.pages.get(focus.pageId))
    ring = [focus.pageId]
  } else if (focus.title) {
    // A page that doesn't exist yet: start from everything that links to it.
    const links = await db.links.where('[worldId+toKey]').equals([world.id, foldKey(focus.title)]).toArray()
    ring = [...new Set(links.map((l) => l.fromPageId))]
    for (const p of await db.pages.bulkGet(ring)) add(p)
  }

  for (let depth = 0; depth < (opts.rings ?? 1); depth++) {
    const next = await neighbours(ring)
    const scored = [...next.entries()].filter(([id]) => !seen.has(id)).sort((a, b) => b[1] - a[1])
    const pages = await db.pages.bulkGet(scored.map(([id]) => id))
    for (const p of pages) add(p)
    ring = scored.map(([id]) => id)
  }

  const bodies = new Map((await db.pageBodies.bulkGet(chosen.map((p) => p.id))).filter((b) => !!b).map((b) => [b!.pageId, b!.body]))
  const parts: string[] = []
  const titles: string[] = []
  let used = 0
  for (const [i, p] of chosen.entries()) {
    const isFocus = i === 0 && !!focus.pageId
    const limit = isFocus ? 9000 : 1600
    const block = serialize(p, byCat.get(p.categoryId), bodies.get(p.id) ?? '', world, limit)
    if (used + block.length > budget && !isFocus) break
    parts.push(block)
    titles.push(p.title)
    used += block.length
  }
  return { text: parts.join('\n\n---\n\n'), titles }
}

/** Pages linked to or from `ids`, weighted by how many links connect them. */
async function neighbours(ids: ID[]): Promise<Map<ID, number>> {
  const score = new Map<ID, number>()
  if (!ids.length) return score
  const out = await db.links.where('fromPageId').anyOf(ids).toArray()
  const inc = await db.links.where('toPageId').anyOf(ids).toArray()
  for (const l of out) if (l.toPageId) score.set(l.toPageId, (score.get(l.toPageId) ?? 0) + 2)
  for (const l of inc) score.set(l.fromPageId, (score.get(l.fromPageId) ?? 0) + 1)
  for (const id of ids) score.delete(id)
  return score
}

function serialize(p: Page, cat: Category | undefined, body: string, world: World, limit: number): string {
  const lines = [`## ${p.title}${cat ? ` (${categoryLabel(cat)})` : ''}`]
  if (p.aliases.length) lines.push(`Also known as: ${p.aliases.join(', ')}`)
  const date = (d: { year: number; month?: number; day?: number; approximate?: boolean }) => {
    const f = formatWorldDate(d, world.calendar, 'en')
    return `${f.approximate ? 'c. ' : ''}${f.day ? `${f.day} ` : ''}${f.month ? `${f.month} ` : ''}${f.year} ${f.era}`.trim()
  }
  if (p.date) lines.push(`Date: ${date(p.date)}${p.endDate ? ` to ${date(p.endDate)}` : ''}`)
  const facts: string[] = []
  for (const f of cat?.fields ?? []) {
    const v = p.fields[f.id]
    if (v === undefined || v === null || v === '') continue
    const name = fieldLabelEn(f)
    if (isWorldDate(v)) facts.push(`${name}: ${date(v)}`)
    else if (isPageRef(v)) facts.push(`${name}: [[${v.ref}]]`)
    else if (Array.isArray(v)) facts.push(`${name}: ${v.map((x) => (isPageRef(x) ? `[[${x.ref}]]` : String(x))).join(', ')}`)
    else facts.push(`${name}: ${String(v)}`)
  }
  if (facts.length) lines.push(`Facts: ${facts.join('; ')}`)
  const text = body.length > limit ? `${body.slice(0, limit)}…` : body
  if (text.trim()) lines.push('', text.trim())
  return lines.join('\n')
}

/**
 * Best chapter for a page that doesn't exist yet: if stat-block fields point
 * at it (e.g. a character's Home), use the chapter those fields expect.
 */
export async function guessCategory(world: World, title: string): Promise<ID | undefined> {
  const categories = await db.categories.where('worldId').equals(world.id).toArray()
  const links = await db.links.where('[worldId+toKey]').equals([world.id, foldKey(title)]).toArray()
  const votes = new Map<ID, number>()
  for (const l of links) {
    if (l.source === 'body') continue
    const from = await db.pages.get(l.fromPageId)
    const field = categories.find((c) => c.id === from?.categoryId)?.fields.find((f) => f.id === l.source)
    const target = field?.refCategory && categories.find((c) => c.builtIn === field.refCategory || c.id === field.refCategory)
    if (target) votes.set(target.id, (votes.get(target.id) ?? 0) + 1)
  }
  return [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
}
