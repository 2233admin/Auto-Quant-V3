import { useState } from 'react'

/**
 * View state shared by the Factor and Strategy libraries (batch 2, libraries at scale): row density and verdict grouping
 * persist per user in localStorage; the sort is session state. Nothing here computes a statistic. Sorting only orders
 * published values and grouping only partitions the published verdict or state.
 */
export type Density = 'comfortable' | 'compact'
export type Sort = { key: string; dir: 1 | -1 }

export const DENSITY_KEY = 'aq-studio-library-density'
export const GROUP_KEY = 'aq-studio-library-grouped'

const read = (key: string): string | null => { try { return localStorage.getItem(key) } catch { return null } }
const write = (key: string, value: string) => { try { localStorage.setItem(key, value) } catch { /* In-memory choice remains active. */ } }

export const storedDensity = (): Density => (read(DENSITY_KEY) === 'compact' ? 'compact' : 'comfortable')
export const storedGrouped = (): boolean => read(GROUP_KEY) === '1'

export function useLibraryView() {
  const [density, setDensityState] = useState<Density>(storedDensity)
  const [grouped, setGroupedState] = useState<boolean>(storedGrouped)
  return {
    density, grouped,
    setDensity: (d: Density) => { setDensityState(d); write(DENSITY_KEY, d) },
    setGrouped: (g: boolean) => { setGroupedState(g); write(GROUP_KEY, g ? '1' : '0') },
  }
}

/** Order by a published value; a missing value sorts last in either direction. */
export function sortRows<T>(rows: readonly T[], sort: Sort, get: (row: T) => string | number | null | undefined): T[] {
  return [...rows].sort((a, b) => {
    const x = get(a) ?? null
    const y = get(b) ?? null
    if (x === null && y === null) return 0
    if (x === null) return 1
    if (y === null) return -1
    const d = typeof x === 'string' || typeof y === 'string' ? String(x).localeCompare(String(y)) : x - y
    return d * sort.dir
  })
}

/** Click on a header: the same key flips direction, a new key starts descending (names ascending). */
export function nextSort(current: Sort, key: string): Sort {
  if (current.key === key) return { key, dir: current.dir === 1 ? -1 : 1 }
  return { key, dir: key === 'name' ? 1 : -1 }
}

export type Group<T> = { id: string; rows: T[] }
/** Partition rows into the given group order; empty groups are kept so the section list is stable. */
export function groupRows<T>(rows: readonly T[], order: readonly string[], of: (row: T) => string): Group<T>[] {
  return order.map((id) => ({ id, rows: rows.filter((r) => of(r) === id) }))
}

/** Arithmetic mean of the finite published values, or null when there are none. */
export function meanOf(values: readonly (number | null | undefined)[]): number | null {
  const finite = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  return finite.length ? finite.reduce((a, b) => a + b, 0) / finite.length : null
}
