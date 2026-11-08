import type { ID, WorldDate } from '../lore/types'

export type ProposalStatus = 'pending' | 'accepted' | 'rejected'

interface ProposalBase {
  id: ID
  worldId: ID
  status: ProposalStatus
  /** Claude's note to the user about this proposal. */
  note?: string
  /** Things the bridge could not apply as given (unknown fields, bad dates…). */
  warnings: string[]
  createdAt: number
  decidedAt?: number
  /** The page created or changed when the proposal was accepted. */
  resultPageId?: ID
  /** True when the user allowed direct writes and the change was saved without review. */
  direct?: boolean
}

/** A new page. Fields are already mapped to the chapter's field ids. */
export interface CreateProposal extends ProposalBase {
  kind: 'create'
  title: string
  categoryId: ID
  body: string
  aliases: string[]
  fields: Record<string, unknown>
  date?: WorldDate
  endDate?: WorldDate
}

/** A change to an existing page. */
export interface UpdateProposal extends ProposalBase {
  kind: 'update'
  pageId: ID
  /** Title when proposed, so the inbox can name it even if the page is renamed or deleted. */
  pageTitle: string
  append?: string
  replaceBody?: string
  /** Field values to set, by field id. */
  fields: Record<string, unknown>
  /** Aliases to add. */
  aliases: string[]
}

export type Proposal = CreateProposal | UpdateProposal

export interface McpSettings {
  enabled: boolean
  url: string
  /** Save Claude's pages and edits without review. Off by default. */
  directWrites: boolean
}

export const DEFAULT_BRIDGE_URL = 'http://127.0.0.1:8788'
export const DEFAULT_MCP_SETTINGS: McpSettings = { enabled: false, url: DEFAULT_BRIDGE_URL, directWrites: false }
