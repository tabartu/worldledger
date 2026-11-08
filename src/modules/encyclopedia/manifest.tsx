import { BookOpen } from 'lucide-react'
import type { WorldledgerModule } from '../types'

/** The editor pulls in CodeMirror, so it loads on demand. */
const timeline = { lazy: async () => ({ Component: (await import('./screens/Timeline')).Timeline }) }
const graph = { lazy: async () => ({ Component: (await import('./screens/Graph')).Graph }) }
const maps = { lazy: async () => ({ Component: (await import('./screens/Maps')).Maps }) }
const mapView = { lazy: async () => ({ Component: (await import('./screens/MapView')).MapView }) }
const editor = { lazy: async () => ({ Component: (await import('./screens/PageEditor')).PageEditor }) }
import { CategoryIndex } from './screens/CategoryIndex'
import { ChapterFields } from './screens/ChapterFields'
import { ChaptersManage } from './screens/ChaptersManage'
import { PageReader } from './screens/PageReader'
import { Proposals } from './screens/Proposals'
import { WorldHome } from './screens/WorldHome'

export const encyclopediaModule: WorldledgerModule = {
  id: 'encyclopedia',
  nameKey: 'encyclopedia:module.name',
  icon: BookOpen,
  basePath: '',
  worldRoutes: [
    { index: true, element: <WorldHome /> },
    { path: 'c/:categoryId', element: <CategoryIndex /> },
    { path: 'p/:pageId', element: <PageReader /> },
    { path: 'p/:pageId/edit', ...editor },
    { path: 'new', ...editor },
    { path: 'timeline', ...timeline },
    { path: 'graph', ...graph },
    { path: 'maps', ...maps },
    { path: 'maps/:mapId', ...mapView },
    { path: 'chapters', element: <ChaptersManage /> },
    { path: 'chapters/:categoryId', element: <ChapterFields /> },
    { path: 'proposals', element: <Proposals /> },
  ],
}
