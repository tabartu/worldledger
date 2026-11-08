/**
 * Handlers for the MCP bridge's tools. Each takes Claude's arguments and
 * returns a JSON-friendly value (or text). Output is in English with the
 * world's own content; field and chapter names use English built-in labels,
 * and any interface language's label is accepted back.
 */
import type MiniSearch from 'minisearch'
import { buildContext } from '../ai/context'
import { db } from '../db/db'
import { getBacklinks, getCategories, getPages, getRedLinks } from '../lore/api'
import { foldKey } from '../lore/normalize'
import { findPageByKey, getPageBody } from '../lore/pages'
import { buildSearchIndex, searchPages, type SearchDoc } from '../lore/search'
import { buildTimeline, groupByEra } from '../lore/timeline'
import type { ID, Page, World } from '../lore/types'
import {
  categoryLabel,
  describeDate,
  describeFieldDefs,
  describeFields,
  fieldLabelEn,
  mapFields,
  parseWorldDate,
  resolveCategory,
  ToolError,
  warningText,
} from './mapping'
import { acceptProposal, addProposal, getProposals } from './proposals'
import { getMcpSettings } from './settings'
import type { Proposal } from './types'

type Args = Record<string, unknown>
type Handler = (args: Args) => Promise<unknown>

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const strList = (v: unknown) => (Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : []).map((x) => String(x).trim()).filter(Boolean)

async function resolveWorld(args: Args): Promise<World> {
  const worlds = await db.worlds.toArray()
  const ref = str(args.world)
  if (!worlds.length) throw new ToolError('There are no worlds in Worldledger yet. Ask the user to create one first.')
  if (!ref) {
    if (worlds.length === 1) return worlds[0]
    throw new ToolError(`Several worlds exist; pass "world". Worlds: ${worlds.map((w) => w.name).join(', ')}.`)
  }
  const key = foldKey(ref)
  const w = worlds.find((x) => x.id === ref) ?? worlds.find((x) => foldKey(x.name) === key) ?? worlds.find((x) => foldKey(x.name).includes(key))
  if (!w) throw new ToolError(`No world named "${ref}". Worlds: ${worlds.map((x) => x.name).join(', ')}.`)
  return w
}

async function worldScope(args: Args) {
  const world = await resolveWorld(args)
  const categories = await getCategories(world.id)
  const byId = new Map(categories.map((c) => [c.id, c]))
  return { world, categories, chapter: (p: Page) => (byId.has(p.categoryId) ? categoryLabel(byId.get(p.categoryId)!) : '') }
}

async function findPage(world: World, title: string): Promise<Page> {
  if (!title) throw new ToolError('Pass the page "title".')
  const page = await findPageByKey(world.id, foldKey(title))
  if (page) return page
  const hits = searchPages(await searchIndex(world.id), title, 5)
  const hint = hits.length ? ` Did you mean: ${hits.map((h) => h.title).join(', ')}?` : ''
  throw new ToolError(`No page titled "${title}" in ${world.name}.${hint}`)
}

// ---------- search index cache (rebuilt when the world's pages change) ----------

const indexes = new Map<ID, { sig: string; index: MiniSearch<SearchDoc> }>()

async function searchIndex(worldId: ID) {
  const pages = await getPages(worldId)
  const sig = `${pages.length}:${pages.reduce((m, p) => Math.max(m, p.updatedAt), 0)}`
  const cached = indexes.get(worldId)
  if (cached?.sig === sig) return cached.index
  const bodies = new Map((await db.pageBodies.bulkGet(pages.map((p) => p.id))).filter((b) => !!b).map((b) => [b!.pageId, b!.body]))
  const index = buildSearchIndex(pages, bodies)
  indexes.set(worldId, { sig, index })
  return index
}

// ---------- write helpers ----------

function describeProposal(p: Proposal, world: World) {
  return {
    id: p.id,
    kind: p.kind === 'create' ? 'new page' : 'edit',
    title: p.kind === 'create' ? p.title : p.pageTitle,
    status: p.direct ? 'saved directly' : p.status,
    proposed: new Date(p.createdAt).toISOString(),
    ...(p.decidedAt ? { decided: new Date(p.decidedAt).toISOString() } : {}),
    ...(p.note ? { note: p.note } : {}),
    world: world.name,
  }
}

async function finish(proposal: Proposal, world: World, canWriteDirectly: boolean) {
  const { directWrites } = await getMcpSettings()
  const warnings = proposal.warnings.length ? { warnings: proposal.warnings.map(warningText) } : {}
  if (directWrites && canWriteDirectly) {
    try {
      await acceptProposal(proposal, { direct: true })
      return { saved: true, message: 'Saved directly to Worldledger (the user allows direct writes).', proposal_id: proposal.id, ...warnings }
    } catch {
      // Fall through: leave it for review.
    }
  }
  return {
    saved: false,
    message: `Sent to the Proposals inbox of ${world.name}. Tell the user to review it there.`,
    proposal_id: proposal.id,
    ...warnings,
  }
}

// ---------- tools ----------

export const TOOL_HANDLERS: Record<string, Handler> = {
  async list_worlds() {
    const worlds = await db.worlds.orderBy('updatedAt').reverse().toArray()
    return Promise.all(
      worlds.map(async (w) => ({
        name: w.name,
        id: w.id,
        genre: w.genre || undefined,
        tone: w.tone || undefined,
        content_language: w.contentLanguage,
        pages: await db.pages.where('worldId').equals(w.id).count(),
      })),
    )
  },

  async get_world(args) {
    const { world, categories } = await worldScope(args)
    const pages = await getPages(world.id)
    const eras = (await db.eras.where('worldId').equals(world.id).toArray()).sort((a, b) => a.startYear - b.startYear)
    const pending = await db.proposals.where('[worldId+status]').equals([world.id, 'pending']).count()
    const { directWrites } = await getMcpSettings()
    const cal = world.calendar
    return {
      name: world.name,
      id: world.id,
      summary: world.summary || undefined,
      genre: world.genre || undefined,
      tone: world.tone || undefined,
      content_language: world.contentLanguage,
      write_lore_in: world.contentLanguage,
      calendar: {
        year_label: [cal.yearLabel, cal.yearAbbr && `(${cal.yearAbbr})`].filter(Boolean).join(' ') || 'plain years',
        ...(cal.negativeLabel || cal.negativeAbbr ? { negative_years: [cal.negativeLabel, cal.negativeAbbr && `(${cal.negativeAbbr})`].filter(Boolean).join(' ') } : {}),
        ...(cal.months?.length ? { months: cal.months.map((m, i) => `${i + 1}. ${m.name} (${m.days} days)`) } : {}),
      },
      eras: eras.map((e) => ({ name: e.name, from: e.startYear, ...(e.endYear !== undefined ? { to: e.endYear } : {}) })),
      chapters: categories.map((c) => ({
        name: categoryLabel(c),
        plural: categoryLabel(c, true),
        pages: pages.filter((p) => p.categoryId === c.id).length,
        fields: describeFieldDefs(c, categories),
        ...(c.builtIn === 'event' ? { note: 'Event pages take "date" and "end_date" and appear on the timeline.' } : {}),
      })),
      total_pages: pages.length,
      pending_proposals: pending,
      writes: directWrites ? 'saved directly (the user allows direct writes)' : 'proposals for review',
    }
  },

  async search_pages(args) {
    const { world, categories } = await worldScope(args)
    const query = str(args.query)
    if (!query) throw new ToolError('Pass a "query".')
    const limit = Math.min(50, Math.max(1, Number(args.limit) || 15))
    const byId = new Map(categories.map((c) => [c.id, c]))
    const hits = searchPages(await searchIndex(world.id), query, limit)
    if (!hits.length) return `No pages in ${world.name} match "${query}".`
    return hits.map((h) => ({ title: h.title, chapter: byId.has(h.categoryId) ? categoryLabel(byId.get(h.categoryId)!) : '', snippet: h.snippet }))
  },

  async list_pages(args) {
    const { world, categories, chapter } = await worldScope(args)
    const name = str(args.chapter)
    const cat = name ? resolveCategory(categories, name) : undefined
    const pages = await getPages(world.id, { categoryId: cat?.id })
    pages.sort((a, b) => a.title.localeCompare(b.title, world.contentLanguage))
    if (!pages.length) return cat ? `No ${categoryLabel(cat, true)} pages in ${world.name} yet.` : `${world.name} has no pages yet.`
    return pages.map((p) => ({
      title: p.title,
      chapter: chapter(p),
      status: p.status,
      ...(p.aliases.length ? { aliases: p.aliases } : {}),
      excerpt: p.excerpt,
    }))
  },

  async get_page(args) {
    const { world, categories, chapter } = await worldScope(args)
    const page = await findPage(world, str(args.title))
    const cat = categories.find((c) => c.id === page.categoryId)
    const [body, links, backlinks] = await Promise.all([
      getPageBody(page.id),
      db.links.where('fromPageId').equals(page.id).toArray(),
      getBacklinks(page.id),
    ])
    const linksTo = new Map<string, { title: string; exists: boolean }>()
    for (const l of links) if (!linksTo.has(l.toKey)) linksTo.set(l.toKey, { title: l.toTitle, exists: !!l.toPageId })
    return {
      title: page.title,
      chapter: chapter(page),
      status: page.status,
      ...(page.aliases.length ? { aliases: page.aliases } : {}),
      fields: describeFields(cat, page.fields, world),
      ...(page.date ? { date: { ...page.date, text: describeDate(page.date, world) } } : {}),
      ...(page.endDate ? { end_date: { ...page.endDate, text: describeDate(page.endDate, world) } } : {}),
      body,
      links_to: [...linksTo.values()],
      linked_from: backlinks.map((p) => p.title),
      updated: new Date(page.updatedAt).toISOString(),
    }
  },

  async get_related_lore(args) {
    const { world } = await worldScope(args)
    const title = str(args.title)
    if (!title) throw new ToolError('Pass a "title".')
    const page = await findPageByKey(world.id, foldKey(title))
    const rings = Number(args.depth) === 2 ? 2 : 1
    const { text, titles } = await buildContext(world, page ? { pageId: page.id } : { title }, { rings, budget: 40000 })
    const head = [
      `World: ${world.name} (lore language: ${world.contentLanguage})`,
      page ? `Focus page: ${page.title}` : `"${title}" has no page yet; these pages mention it.`,
      `Pages included: ${titles.length ? titles.join(', ') : 'none'}`,
    ].join('\n')
    if (!text) return `${head}\n\nNothing in ${world.name} mentions "${title}" yet.`
    return `${head}\n\n${text}`
  },

  async get_timeline(args) {
    const { world, categories } = await worldScope(args)
    const byId = new Map(categories.map((c) => [c.id, c]))
    const pages = await getPages(world.id)
    const eras = await db.eras.where('worldId').equals(world.id).toArray()
    const groups = groupByEra(buildTimeline(pages, categories, true), eras)
    if (!groups.length) return `${world.name} has no dated pages yet. Give event pages a date, or fill date fields such as Born or Founded.`
    const lines: string[] = [`Timeline of ${world.name}`]
    for (const g of groups) {
      lines.push('', g.era ? `## ${g.era.name} (${g.era.startYear}${g.era.endYear !== undefined ? `–${g.era.endYear}` : '–'})` : '## Outside any era')
      if (!g.entries.length) lines.push('(nothing dated in this era yet)')
      for (const e of g.entries) {
        const range = `${describeDate(e.date, world)}${e.endDate ? ` – ${describeDate(e.endDate, world)}` : ''}`
        const cat = byId.get(e.categoryId)
        const what = e.source === 'field' && e.field ? `${e.title}: ${fieldLabelEn(e.field)}` : e.title
        lines.push(`- ${range}: ${what}${cat ? ` [${categoryLabel(cat)}]` : ''}`)
      }
    }
    return lines.join('\n')
  },

  async list_missing_pages(args) {
    const { world } = await worldScope(args)
    const red = await getRedLinks(world.id)
    if (!red.length) return `${world.name} has no missing pages: every [[link]] points to a written page.`
    const titles = new Map((await db.pages.bulkGet([...new Set(red.flatMap((r) => r.from.slice(0, 5)))])).filter((p) => !!p).map((p) => [p!.id, p!.title]))
    return red.slice(0, 100).map((r) => ({ title: r.title, mentioned_by: r.count, mentioned_in: r.from.slice(0, 5).map((id) => titles.get(id)).filter(Boolean) }))
  },

  async propose_page(args) {
    const { world, categories } = await worldScope(args)
    const title = str(args.title)
    if (!title) throw new ToolError('Pass a "title".')
    const category = resolveCategory(categories, args.chapter)
    const body = typeof args.body === 'string' ? args.body.replace(/^#\s+.*\n+/, '').trim() : ''
    const { fields, warnings } = mapFields(category, args.fields)
    const date = args.date !== undefined && args.date !== null ? parseWorldDate(args.date) : undefined
    const endDate = args.end_date !== undefined && args.end_date !== null ? parseWorldDate(args.end_date) : undefined
    if (args.date != null && !date) warnings.push({ code: 'bad_date', field: 'date', value: JSON.stringify(args.date) })
    if (args.end_date != null && !endDate) warnings.push({ code: 'bad_date', field: 'end_date', value: JSON.stringify(args.end_date) })
    const existing = await findPageByKey(world.id, foldKey(title))
    for (const a of strList(args.aliases)) {
      const taken = await findPageByKey(world.id, foldKey(a))
      if (taken) warnings.push({ code: 'alias_taken', alias: a, page: taken.title })
    }
    if (existing) {
      warnings.push({ code: 'title_taken', page: existing.title })
    }
    const proposal = await addProposal({
      kind: 'create',
      worldId: world.id,
      title,
      categoryId: category.id,
      body,
      aliases: strList(args.aliases),
      fields,
      date,
      endDate: date ? endDate : undefined,
      note: str(args.note) || undefined,
      warnings,
    })
    return finish(proposal, world, !existing && !warnings.some((w) => w.code === 'alias_taken'))
  },

  async propose_edit(args) {
    const { world, categories } = await worldScope(args)
    const page = await findPage(world, str(args.title))
    const category = categories.find((c) => c.id === page.categoryId)
    const append = typeof args.append === 'string' && args.append.trim() ? args.append.trim() : undefined
    const replaceBody = typeof args.replace_body === 'string' ? args.replace_body.trim() : undefined
    const mapped = category ? mapFields(category, args.fields) : { fields: {}, warnings: [] }
    // Clearing a field that is already empty changes nothing.
    for (const [id, v] of Object.entries(mapped.fields)) if (v === null && page.fields[id] === undefined) delete mapped.fields[id]
    const aliases = strList(args.aliases)
    if (!append && replaceBody === undefined && !Object.keys(mapped.fields).length && !aliases.length) {
      throw new ToolError(`Nothing to change. Pass "append", "replace_body", "fields" or "aliases".${mapped.warnings.length ? ` ${mapped.warnings.map(warningText).join(' ')}` : ''}`)
    }
    const proposal = await addProposal({
      kind: 'update',
      worldId: world.id,
      pageId: page.id,
      pageTitle: page.title,
      append,
      replaceBody,
      fields: mapped.fields,
      aliases,
      note: str(args.note) || undefined,
      warnings: mapped.warnings,
    })
    return finish(proposal, world, true)
  },

  async list_proposals(args) {
    const { world } = await worldScope(args)
    const all = await getProposals(world.id)
    if (!all.length) return `No proposals in ${world.name} yet.`
    return all.slice(0, 100).map((p) => describeProposal(p, world))
  },
}

/** Run a tool by name. Errors meant for Claude are thrown as ToolError. */
export async function runTool(name: string, args: Args = {}): Promise<unknown> {
  const handler = TOOL_HANDLERS[name]
  if (!handler) throw new ToolError(`Unknown tool: ${name}`)
  return handler(args ?? {})
}

