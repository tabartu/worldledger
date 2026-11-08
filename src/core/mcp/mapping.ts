/**
 * Turns what Claude sends (names and plain values) into Worldledger's stored
 * shapes, and back. Matching is folded (case, accents, Turkish i), so
 * "born", "Born" and "Doğum" all find the built-in `born` field.
 */
import { isPageRef, isWorldDate } from '../lore/fields'
import { foldKey } from '../lore/normalize'
import type { Category, FieldDef, World, WorldDate } from '../lore/types'

type Labels = {
  category?: Record<string, { singular?: string; plural?: string }>
  field?: Record<string, string>
  lifeStatus?: Record<string, string>
}

// Built-in labels in every interface language, so Claude may use any of them.
const LOCALE_FILES = import.meta.glob<{ default: Labels }>('../../locales/*/encyclopedia.json', { eager: true })
const LABELS: Labels[] = Object.values(LOCALE_FILES).map((m) => m.default)
const EN: Labels = Object.entries(LOCALE_FILES).find(([path]) => path.includes('/en/'))?.[1].default ?? {}

export class ToolError extends Error {}

/** All names a chapter answers to (folded). */
export function categoryNames(c: Category): string[] {
  const names = [c.id, c.name ?? '']
  if (c.builtIn) {
    names.push(c.builtIn)
    for (const l of LABELS) names.push(l.category?.[c.builtIn]?.singular ?? '', l.category?.[c.builtIn]?.plural ?? '')
  }
  return [...new Set(names.map(foldKey).filter(Boolean))]
}

/** The chapter's display name for Claude: custom name, or the English built-in name. */
export function categoryLabel(c: Category, plural = false): string {
  if (!c.builtIn) return c.name ?? ''
  return EN.category?.[c.builtIn]?.[plural ? 'plural' : 'singular'] ?? c.builtIn
}

export function findCategory(categories: Category[], name: string): Category | undefined {
  const key = foldKey(name)
  return categories.find((c) => categoryNames(c).includes(key))
}

export function resolveCategory(categories: Category[], name: unknown): Category {
  const c = typeof name === 'string' ? findCategory(categories, name) : undefined
  if (!c) {
    throw new ToolError(
      `Unknown chapter "${String(name ?? '')}". Chapters in this world: ${categories.map((x) => categoryLabel(x)).join(', ')}.`,
    )
  }
  return c
}

/** All names a field answers to (folded). */
export function fieldNames(f: FieldDef): string[] {
  const names = [f.id, f.key, f.label ?? '']
  if (f.builtIn) for (const l of LABELS) names.push(l.field?.[f.key] ?? '')
  return [...new Set(names.map(foldKey).filter(Boolean))]
}

/** The field's name for Claude: custom label, or the English built-in label. */
export function fieldLabelEn(f: FieldDef): string {
  return f.builtIn ? (EN.field?.[f.key] ?? f.key) : (f.label ?? f.key)
}

/** A year number, a numeric string, or {year, month?, day?, approximate?}. */
export function parseWorldDate(v: unknown): WorldDate | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? { year: Math.trunc(v) } : undefined
  if (typeof v === 'string') {
    const m = v.trim().match(/^(c\.?\s*|~)?(-?\d+)$/i)
    return m ? { year: Number(m[2]), ...(m[1] ? { approximate: true } : {}) } : undefined
  }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    const year = Number(o.year)
    if (!Number.isFinite(year)) return undefined
    const d: WorldDate = { year: Math.trunc(year) }
    const month = Number(o.month)
    const day = Number(o.day)
    if (Number.isInteger(month) && month > 0) d.month = month
    if (d.month && Number.isInteger(day) && day > 0) d.day = day
    if (o.approximate === true) d.approximate = true
    return d
  }
  return undefined
}

function list(v: unknown): unknown[] {
  if (Array.isArray(v)) return v
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean)
  return v === undefined || v === null ? [] : [v]
}

function refOf(v: unknown): { ref: string } | undefined {
  if (typeof v === 'string' && v.trim()) return { ref: v.replace(/^\[\[|\]\]$/g, '').split('|')[0].trim() }
  if (isPageRef(v) && v.ref.trim()) return { ref: v.ref.trim() }
  if (v && typeof v === 'object' && typeof (v as { title?: unknown }).title === 'string') return refOf((v as { title: string }).title)
  return undefined
}

const TRUE = new Set(['true', 'yes', 'y', '1', 'evet', 'var'])
const FALSE = new Set(['false', 'no', 'n', '0', 'hayir', 'yok'])

/** Convert one plain value to the stored shape of `def`, or undefined if it does not fit. */
export function coerceValue(def: FieldDef, v: unknown): unknown {
  switch (def.type) {
    case 'text':
    case 'longtext':
      return typeof v === 'string' || typeof v === 'number' ? String(v).trim() || undefined : undefined
    case 'number': {
      const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN
      return Number.isFinite(n) ? n : undefined
    }
    case 'boolean':
      if (typeof v === 'boolean') return v
      if (typeof v === 'string' && TRUE.has(foldKey(v))) return true
      if (typeof v === 'string' && FALSE.has(foldKey(v))) return false
      return undefined
    case 'worldDate':
      return parseWorldDate(v)
    case 'pageRef':
      return refOf(Array.isArray(v) ? v[0] : v)
    case 'pageRefs': {
      const refs = list(v).map(refOf).filter((r): r is { ref: string } => !!r)
      return refs.length ? refs : undefined
    }
    case 'tags': {
      const tags = list(v).map((x) => String(x).trim()).filter(Boolean)
      return tags.length ? tags : undefined
    }
    case 'select': {
      if (typeof v !== 'string') return undefined
      const key = foldKey(v)
      const options = def.options ?? []
      const direct = options.find((o) => foldKey(o) === key)
      if (direct) return direct
      // Built-in options (life status) may be given by any translated label.
      if (def.builtIn && def.key === 'lifeStatus') {
        return options.find((o) => LABELS.some((l) => foldKey(l.lifeStatus?.[o] ?? '') === key))
      }
      return options.length ? undefined : v.trim() || undefined
    }
  }
}

/**
 * Map `{ "Born": 289, "Home": "Varnhold" }` onto field ids of `category`.
 * `null` clears a field. Unknown names and unfit values become warnings.
 */
export function mapFields(
  category: Category,
  input: unknown,
): { fields: Record<string, unknown>; warnings: string[] } {
  const fields: Record<string, unknown> = {}
  const warnings: string[] = []
  if (input === undefined || input === null) return { fields, warnings }
  if (typeof input !== 'object' || Array.isArray(input)) {
    return { fields, warnings: ['"fields" must be an object of field name → value; it was ignored.'] }
  }
  for (const [name, value] of Object.entries(input as Record<string, unknown>)) {
    const key = foldKey(name)
    const def = category.fields.find((f) => fieldNames(f).includes(key))
    if (!def) {
      const known = category.fields.map(fieldLabelEn).join(', ') || 'none'
      warnings.push(`Unknown field "${name}" for ${categoryLabel(category)} (fields: ${known}); it was left out.`)
      continue
    }
    if (value === null) {
      fields[def.id] = null
      continue
    }
    const coerced = coerceValue(def, value)
    if (coerced === undefined) {
      const hint = def.type === 'select' && def.options?.length ? ` Options: ${def.options.join(', ')}.` : ''
      warnings.push(`Value ${JSON.stringify(value)} does not fit field "${fieldLabelEn(def)}" (${def.type}); it was left out.${hint}`)
      continue
    }
    fields[def.id] = coerced
  }
  return { fields, warnings }
}

/** Format a world date in the world's calendar, in English, for Claude. */
export function describeDate(d: WorldDate, world: World): string {
  const cal = world.calendar
  const negative = d.year < 0
  const era = negative ? (cal.negativeAbbr ?? cal.negativeLabel ?? '') : cal.yearAbbr || cal.yearLabel
  const month = d.month ? (cal.months?.[d.month - 1]?.name ?? `month ${d.month}`) : ''
  const year = negative && era ? String(Math.abs(d.year)) : String(d.year)
  return [d.approximate ? 'c.' : '', d.day ?? '', month, year, era].filter((x) => x !== '').join(' ')
}

/** Stored field values → `{ "Born": "289 AF", "Home": "Varnhold" }` for Claude. */
export function describeFields(category: Category | undefined, values: Record<string, unknown>, world: World) {
  const out: Record<string, unknown> = {}
  for (const f of category?.fields ?? []) {
    const v = values[f.id]
    if (v === undefined || v === null || v === '') continue
    const name = fieldLabelEn(f)
    if (isWorldDate(v)) out[name] = { ...v, text: describeDate(v, world) }
    else if (isPageRef(v)) out[name] = v.ref
    else if (Array.isArray(v)) out[name] = v.map((x) => (isPageRef(x) ? x.ref : x))
    else out[name] = v
  }
  return out
}

/** A chapter's fields as Claude should send them. */
export function describeFieldDefs(category: Category, categories: Category[]) {
  return category.fields.map((f) => {
    const target = f.refCategory ? categories.find((c) => c.builtIn === f.refCategory || c.id === f.refCategory) : undefined
    const type =
      f.type === 'worldDate'
        ? 'date (year number or {year, month, day})'
        : f.type === 'pageRef'
          ? 'page title'
          : f.type === 'pageRefs'
            ? 'list of page titles'
            : f.type === 'tags'
              ? 'list of words'
              : f.type
    return {
      name: fieldLabelEn(f),
      type,
      ...(f.options?.length ? { options: f.options } : {}),
      ...(target ? { refers_to: categoryLabel(target) } : {}),
    }
  })
}
