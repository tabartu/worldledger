import Dexie, { type EntityTable } from 'dexie'
import type { Category, Era, Link, MapDoc, MapImage, Marker, Page, PageBody, World } from '../lore/types'
import type { Proposal } from '../mcp/types'

/**
 * The main Worldledger database. Everything here belongs to the user's worlds
 * and is included in backups, except `proposals` (drafts waiting for review). Secrets (AI keys) live in a separate database
 * that is never exported.
 *
 * Adding a module's own tables: bump the version below and add namespaced
 * stores (e.g. `npc_profiles`). Never rename or drop a core store without a
 * migration in `.upgrade()`.
 */
export class WorldledgerDB extends Dexie {
  worlds!: EntityTable<World, 'id'>
  categories!: EntityTable<Category, 'id'>
  pages!: EntityTable<Page, 'id'>
  pageBodies!: EntityTable<PageBody, 'pageId'>
  links!: EntityTable<Link, 'id'>
  eras!: EntityTable<Era, 'id'>
  maps!: EntityTable<MapDoc, 'id'>
  mapImages!: EntityTable<MapImage, 'id'>
  markers!: EntityTable<Marker, 'id'>
  /** Drafts proposed by Claude through the MCP bridge. Not part of backups. */
  proposals!: EntityTable<Proposal, 'id'>

  constructor(name = 'worldledger') {
    super(name)
    this.version(1).stores({
      worlds: 'id, updatedAt',
      categories: 'id, worldId, [worldId+order]',
      pages: 'id, worldId, [worldId+categoryId], [worldId+updatedAt], [worldId+dateSort], *keys',
      pageBodies: 'pageId',
      links: '++id, worldId, fromPageId, toPageId, [worldId+toKey]',
      eras: 'id, worldId',
    })
    // v2: maps (stage 4)
    this.version(2).stores({
      maps: 'id, worldId',
      mapImages: 'id',
      markers: 'id, worldId, mapId',
    })
    // v3: proposals from the MCP bridge (Claude connection)
    this.version(3).stores({
      proposals: 'id, worldId, [worldId+status], createdAt',
    })
  }
}

export const db = new WorldledgerDB()
