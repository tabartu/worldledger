import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { secrets } from '../ai/secrets'
import { db } from '../db/db'
import { getCategories, getPageWithBody } from '../lore/api'
import { LoreError } from '../lore/errors'
import { createPage } from '../lore/pages'
import { createWorld } from '../lore/worlds'
import { acceptProposal, getProposals } from './proposals'
import { setMcpSettings } from './settings'
import { runTool } from './tools'
import type { CreateProposal } from './types'

async function setup() {
  const world = await createWorld({ name: 'Ashfall', genre: 'dark fantasy', tone: '', contentLanguage: 'en', summary: '', cover: 'lapis' })
  const cats = await getCategories(world.id)
  const character = cats.find((c) => c.builtIn === 'character')!
  const location = cats.find((c) => c.builtIn === 'location')!
  await createPage({ worldId: world.id, categoryId: location.id, title: 'Varnhold', body: 'Seat of [[Aldric Varn]]. Near [[The Ember Gate]].' })
  return { world, character, location }
}

beforeEach(async () => {
  await Promise.all([...db.tables, ...secrets.tables].map((t) => t.clear()))
})

describe('MCP tools', () => {
  it('lists worlds and resolves the only world without a name', async () => {
    await setup()
    const worlds = (await runTool('list_worlds')) as Array<{ name: string; pages: number }>
    expect(worlds).toEqual([expect.objectContaining({ name: 'Ashfall', pages: 1 })])
    const world = (await runTool('get_world')) as { chapters: Array<{ name: string; fields: Array<{ name: string }> }> }
    expect(world.chapters[0].name).toBe('Character')
    expect(world.chapters[0].fields.map((f) => f.name)).toContain('Born')
  })

  it('reads pages, search hits, missing pages and related lore', async () => {
    await setup()
    const page = (await runTool('get_page', { title: 'varnhold' })) as { title: string; links_to: Array<{ title: string; exists: boolean }> }
    expect(page.title).toBe('Varnhold')
    expect(page.links_to).toContainEqual({ title: 'Aldric Varn', exists: false })
    const hits = (await runTool('search_pages', { query: 'ember' })) as Array<{ title: string }>
    expect(hits[0].title).toBe('Varnhold')
    const missing = (await runTool('list_missing_pages', { world: 'ashfall' })) as Array<{ title: string; mentioned_in: string[] }>
    expect(missing.map((m) => m.title).sort()).toEqual(['Aldric Varn', 'The Ember Gate'])
    expect(await runTool('get_related_lore', { title: 'Aldric Varn' })).toContain('## Varnhold')
    await expect(runTool('get_page', { title: 'Nobody' })).rejects.toThrow(/No page titled/)
  })

  it('proposes a page into the inbox, then accepting creates a draft with mapped fields', async () => {
    const { world } = await setup()
    const result = (await runTool('propose_page', {
      title: 'Aldric Varn',
      chapter: 'Karakter',
      body: '# Aldric Varn\n\nLord of [[Varnhold]].',
      fields: { Born: 289, Home: 'Varnhold', Hat: 'tall' },
    })) as { saved: boolean; warnings?: string[] }
    expect(result.saved).toBe(false)
    expect(result.warnings?.[0]).toMatch(/Hat/)
    const [proposal] = await getProposals(world.id)
    expect(proposal.status).toBe('pending')
    expect((proposal as CreateProposal).body).toBe('Lord of [[Varnhold]].')
    const pageId = await acceptProposal(proposal)
    const data = await getPageWithBody(pageId)
    expect(data?.page.status).toBe('draft')
    expect(data?.page.fields).toEqual({ born: { year: 289 }, home: { ref: 'Varnhold' } })
    expect((await getProposals(world.id))[0].status).toBe('accepted')
  })

  it('accepts a conflicting new page only as an addition', async () => {
    const { world } = await setup()
    await runTool('propose_page', { title: 'VARNHOLD', chapter: 'location', body: 'A second view.', aliases: ['The Hold'] })
    const [proposal] = await getProposals(world.id)
    await expect(acceptProposal(proposal)).rejects.toBeInstanceOf(LoreError)
    const existing = await db.pages.where('keys').equals('varnhold').first()
    await acceptProposal(proposal, { mergeInto: existing!.id })
    const data = await getPageWithBody(existing!.id)
    expect(data?.body).toMatch(/Near \[\[The Ember Gate\]\]\.\n\nA second view\./)
    expect(data?.page.aliases).toEqual(['The Hold'])
  })

  it('saves edits directly when the user allows it', async () => {
    await setup()
    await setMcpSettings({ directWrites: true })
    const result = (await runTool('propose_edit', { title: 'Varnhold', append: 'Its walls are black.', fields: { Population: '4000' } })) as { saved: boolean }
    expect(result.saved).toBe(true)
    const page = (await runTool('get_page', { title: 'Varnhold' })) as { body: string; fields: Record<string, unknown> }
    expect(page.body).toMatch(/Its walls are black\.$/m)
    expect(page.fields.Population).toBe('4000')
    const list = (await runTool('list_proposals')) as Array<{ status: string }>
    expect(list[0].status).toBe('saved directly')
    await expect(runTool('propose_edit', { title: 'Varnhold' })).rejects.toThrow(/Nothing to change/)
  })
})
