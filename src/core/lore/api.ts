/**
 * The lore read API. The Encyclopedia and every future module
 * (NPC Personality Lab, Playtest Feedback Hub, Store Page Studio)
 * read lore only through these functions and hooks.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { BuiltInCategory, Category, Era, ID, Link, Page, World } from './types'

// ---------- plain async queries (usable outside React) ----------

export function getWorld(id: ID) {
  return db.worlds.get(id)
}

export async function getCategories(worldId: ID): Promise<Category[]> {
  return db.categories.where('[worldId+order]').between([worldId, -Infinity], [worldId, Infinity]).toArray()
}

/** All page metadata of a world, optionally limited to one built-in category (e.g. 'character'). */
export async function getPages(worldId: ID, opts: { builtIn?: BuiltInCategory; categoryId?: ID } = {}) {
  let categoryId = opts.categoryId
  if (opts.builtIn) {
    const cats = await getCategories(worldId)
    categoryId = cats.find((c) => c.builtIn === opts.builtIn)?.id
    if (!categoryId) return []
  }
  if (categoryId) return db.pages.where('[worldId+categoryId]').equals([worldId, categoryId]).toArray()
  return db.pages.where('worldId').equals(worldId).toArray()
}

export async function getPageWithBody(id: ID): Promise<{ page: Page; body: string } | undefined> {
  const page = await db.pages.get(id)
  if (!page) return undefined
  const body = (await db.pageBodies.get(id))?.body ?? ''
  return { page, body }
}

/** Pages that link to `id` (backlinks), deduplicated. */
export async function getBacklinks(id: ID): Promise<Page[]> {
  const links = await db.links.where('toPageId').equals(id).toArray()
  const ids = [...new Set(links.map((l) => l.fromPageId))].filter((pid) => pid !== id)
  const pages = await db.pages.bulkGet(ids)
  return pages.filter((p): p is Page => !!p)
}

/** Pages `id` links to (resolved only). */
export async function getLinkedPages(id: ID): Promise<Page[]> {
  const links = await db.links.where('fromPageId').equals(id).toArray()
  const ids = [...new Set(links.map((l) => l.toPageId).filter((x): x is ID => !!x))]
  const pages = await db.pages.bulkGet(ids)
  return pages.filter((p): p is Page => !!p)
}

// ---------- React hooks (live: re-render when data changes) ----------

export function useWorlds(): World[] | undefined {
  return useLiveQuery(() => db.worlds.orderBy('updatedAt').reverse().toArray(), [])
}

export function useWorld(id: ID | undefined): World | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.worlds.get(id)) ?? null) : null), [id])
}

export function useCategories(worldId: ID | undefined): Category[] | undefined {
  return useLiveQuery(async () => (worldId ? getCategories(worldId) : []), [worldId])
}

export function usePages(worldId: ID | undefined, opts: { categoryId?: ID } = {}): Page[] | undefined {
  return useLiveQuery(
    async () => (worldId ? getPages(worldId, { categoryId: opts.categoryId }) : []),
    [worldId, opts.categoryId],
  )
}

export function useRecentPages(worldId: ID | undefined, limit = 8): Page[] | undefined {
  return useLiveQuery(
    async () =>
      worldId
        ? db.pages
            .where('[worldId+updatedAt]')
            .between([worldId, -Infinity], [worldId, Infinity])
            .reverse()
            .limit(limit)
            .toArray()
        : [],
    [worldId, limit],
  )
}

export function usePage(id: ID | undefined): { page: Page; body: string } | null | undefined {
  return useLiveQuery(async () => (id ? ((await getPageWithBody(id)) ?? null) : null), [id])
}

/** Outgoing link rows of a page (resolved and red). */
export function useOutgoingLinks(id: ID | undefined): Link[] | undefined {
  return useLiveQuery(async () => (id ? db.links.where('fromPageId').equals(id).toArray() : []), [id])
}

export function useBacklinks(id: ID | undefined): Page[] | undefined {
  return useLiveQuery(async () => (id ? getBacklinks(id) : []), [id])
}

/** Distinct red-link targets in a world, with how many pages want them. */
export async function getRedLinks(worldId: ID) {
  const links = await db.links
    .where('worldId')
    .equals(worldId)
    .filter((l) => !l.toPageId)
    .toArray()
  const byKey = new Map<string, { title: string; key: string; from: Set<ID> }>()
  for (const l of links) {
    const entry = byKey.get(l.toKey) ?? { title: l.toTitle, key: l.toKey, from: new Set<ID>() }
    entry.from.add(l.fromPageId)
    byKey.set(l.toKey, entry)
  }
  return [...byKey.values()]
    .map((e) => ({ title: e.title, key: e.key, count: e.from.size, from: [...e.from] }))
    .sort((a, b) => b.count - a.count)
}

export function useRedLinks(worldId: ID | undefined) {
  return useLiveQuery(async () => (worldId ? getRedLinks(worldId) : []), [worldId])
}

/** Map of folded key → page (id + title) for the given keys; used to colour links in previews. */
export function useResolveKeys(worldId: ID | undefined, keys: string[]) {
  const sig = [...new Set(keys)].sort().join('\u0000')
  return useLiveQuery(async () => {
    const map = new Map<string, { id: ID; title: string }>()
    if (!worldId || !sig) return map
    const pages = await db.pages
      .where('keys')
      .anyOf(sig.split('\u0000'))
      .filter((p) => p.worldId === worldId)
      .toArray()
    for (const p of pages) for (const k of p.keys) map.set(k, { id: p.id, title: p.title })
    return map
  }, [worldId, sig])
}

/** Lightweight title list for autocomplete. */
export function usePageTitles(worldId: ID | undefined) {
  return useLiveQuery(async () => {
    if (!worldId) return []
    const pages = await db.pages.where('worldId').equals(worldId).toArray()
    return pages.map((p) => ({ id: p.id, title: p.title, categoryId: p.categoryId }))
  }, [worldId])
}

export function usePageCounts(worldId: ID | undefined) {
  return useLiveQuery(async () => {
    const counts = new Map<ID, number>()
    if (!worldId) return counts
    await db.pages
      .where('worldId')
      .equals(worldId)
      .each((p) => counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1))
    return counts
  }, [worldId])
}

export function useEras(worldId: ID | undefined): Era[] | undefined {
  return useLiveQuery(
    async () => (worldId ? (await db.eras.where('worldId').equals(worldId).toArray()).sort((a, b) => a.startYear - b.startYear) : []),
    [worldId],
  )
}

/** Resolved links of a world (for the relationship graph). */
export function useWorldLinks(worldId: ID | undefined): Link[] | undefined {
  return useLiveQuery(
    async () => (worldId ? db.links.where('worldId').equals(worldId).filter((l) => !!l.toPageId).toArray() : []),
    [worldId],
  )
}
