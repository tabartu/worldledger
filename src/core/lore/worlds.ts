import { db } from '../db/db'
import { makeBuiltInCategories } from './categories'
import { LoreError } from './errors'
import { newId } from './normalize'
import type { Calendar, Category, ChapterInk, CoverInk, Era, ID, World } from './types'

export interface WorldInput {
  name: string
  genre: string
  tone: string
  contentLanguage: string
  summary: string
  cover: CoverInk
  calendar?: Calendar
}

export const DEFAULT_CALENDAR: Calendar = { yearLabel: '', yearAbbr: '' }

export async function createWorld(input: WorldInput): Promise<World> {
  const name = input.name.trim()
  if (!name) throw new LoreError('title_required')
  const now = Date.now()
  const world: World = {
    id: newId(),
    name,
    genre: input.genre.trim(),
    tone: input.tone.trim(),
    contentLanguage: input.contentLanguage,
    summary: input.summary.trim(),
    cover: input.cover,
    calendar: input.calendar ?? { ...DEFAULT_CALENDAR },
    createdAt: now,
    updatedAt: now,
  }
  await db.transaction('rw', [db.worlds, db.categories], async () => {
    await db.worlds.add(world)
    await db.categories.bulkAdd(makeBuiltInCategories(world.id))
  })
  return world
}

export async function updateWorld(id: ID, patch: Partial<WorldInput>): Promise<void> {
  const clean: Partial<World> = { ...patch, updatedAt: Date.now() }
  if (patch.name !== undefined) {
    clean.name = patch.name.trim()
    if (!clean.name) throw new LoreError('title_required')
  }
  await db.worlds.update(id, clean)
}

export async function deleteWorld(id: ID): Promise<void> {
  await db.transaction('rw', [db.worlds, db.categories, db.pages, db.pageBodies, db.links, db.eras, db.maps, db.mapImages, db.markers, db.proposals], async () => {
    const pageIds = await db.pages.where('worldId').equals(id).primaryKeys()
    await db.pageBodies.bulkDelete(pageIds)
    await db.pages.where('worldId').equals(id).delete()
    await db.links.where('worldId').equals(id).delete()
    await db.categories.where('worldId').equals(id).delete()
    await db.eras.where('worldId').equals(id).delete()
    const maps = await db.maps.where('worldId').equals(id).toArray()
    await db.mapImages.bulkDelete(maps.map((m) => m.imageId))
    await db.maps.where('worldId').equals(id).delete()
    await db.markers.where('worldId').equals(id).delete()
    await db.proposals.where('worldId').equals(id).delete()
    await db.worlds.delete(id)
  })
}

export async function createCategory(worldId: ID, name: string, ink: ChapterInk): Promise<Category> {
  const clean = name.trim()
  if (!clean) throw new LoreError('title_required')
  const existing = await db.categories.where('worldId').equals(worldId).toArray()
  const category: Category = {
    id: newId(),
    worldId,
    name: clean,
    ink,
    icon: 'bookmark',
    order: existing.reduce((max, c) => Math.max(max, c.order), -1) + 1,
    fields: [],
  }
  await db.categories.add(category)
  return category
}

export async function updateCategory(id: ID, patch: Partial<Pick<Category, 'name' | 'ink' | 'order' | 'fields'>>) {
  if (patch.name !== undefined && !patch.name.trim()) throw new LoreError('title_required')
  await db.categories.update(id, patch)
}

export async function deleteCategory(id: ID): Promise<void> {
  const category = await db.categories.get(id)
  if (!category) return
  const count = await db.pages.where('[worldId+categoryId]').equals([category.worldId, id]).count()
  if (count > 0) throw new LoreError('category_not_empty')
  await db.categories.delete(id)
}

export async function replaceEras(worldId: ID, eras: Omit<Era, 'id' | 'worldId'>[]): Promise<void> {
  await db.transaction('rw', db.eras, async () => {
    await db.eras.where('worldId').equals(worldId).delete()
    await db.eras.bulkAdd(eras.map((e) => ({ ...e, id: newId(), worldId })))
  })
}
