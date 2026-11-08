import { describe, expect, it } from 'vitest'
import { makeBuiltInCategories } from '../lore/categories'
import { coerceValue, findCategory, mapFields, parseWorldDate } from './mapping'

const cats = makeBuiltInCategories('w1')
const character = cats.find((c) => c.builtIn === 'character')!

describe('chapter and field mapping', () => {
  it('finds chapters by key, English or Turkish name, singular or plural', () => {
    expect(findCategory(cats, 'character')?.builtIn).toBe('character')
    expect(findCategory(cats, 'Factions')?.builtIn).toBe('faction')
    expect(findCategory(cats, 'MEKÂN')?.builtIn).toBe('location')
    expect(findCategory(cats, 'mekanlar')?.builtIn).toBe('location')
    expect(findCategory(cats, 'nope')).toBeUndefined()
  })

  it('maps fields by folded name and coerces values', () => {
    const { fields, warnings } = mapFields(character, {
      Born: 289,
      'doğum': undefined,
      died: { year: 340, month: 2, day: 9 },
      Home: 'Varnhold',
      affiliation: ['House Varn', '[[The Gray Order]]'],
      'Life status': 'Ölü',
      Mood: 'grim',
    })
    expect(fields.born).toEqual({ year: 289 })
    expect(fields.died).toEqual({ year: 340, month: 2, day: 9 })
    expect(fields.home).toEqual({ ref: 'Varnhold' })
    expect(fields.affiliation).toEqual([{ ref: 'House Varn' }, { ref: 'The Gray Order' }])
    expect(fields.lifeStatus).toBe('dead')
    expect(warnings).toContainEqual(expect.objectContaining({ code: 'unknown_field', field: 'Mood' }))
  })

  it('keeps null to clear a field and warns about values that do not fit', () => {
    const { fields, warnings } = mapFields(character, { home: null, born: 'long ago' })
    expect(fields).toEqual({ home: null })
    expect(warnings).toHaveLength(1)
  })

  it('parses world dates', () => {
    expect(parseWorldDate(12)).toEqual({ year: 12 })
    expect(parseWorldDate('-40')).toEqual({ year: -40 })
    expect(parseWorldDate('c. 300')).toEqual({ year: 300, approximate: true })
    expect(parseWorldDate({ year: '5', day: 3 })).toEqual({ year: 5 })
    expect(parseWorldDate('spring')).toBeUndefined()
  })

  it('coerces booleans and numbers', () => {
    expect(coerceValue({ id: 'x', key: 'x', type: 'boolean' }, 'evet')).toBe(true)
    expect(coerceValue({ id: 'x', key: 'x', type: 'number' }, '12.5')).toBe(12.5)
    expect(coerceValue({ id: 'x', key: 'x', type: 'tags' }, 'a, b')).toEqual(['a', 'b'])
  })
})
