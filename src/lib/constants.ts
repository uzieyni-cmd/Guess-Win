// Shared constants — safe to import in both Server and Client components

/** A group of tournament stages that shares its own joker quota */
export interface JokerStageGroup {
  id: string
  label: string
  prefixes: string[]
  max: number
}

/** Group stage round prefixes / keywords (English API names) */
const GROUP_STAGE_PREFIXES = ['Group Stage', 'Group A', 'Group B', 'Group C', 'Group D',
  'Group E', 'Group F', 'Group G', 'Group H', 'Group I', 'Group J', 'Group K', 'Group L']

/**
 * Joker quotas per stage — each group has its own independent allowance.
 * An unused joker in one stage does not carry over to the next.
 */
export const JOKER_STAGE_GROUPS: JokerStageGroup[] = [
  { id: 'group', label: 'שלב הבתים', prefixes: GROUP_STAGE_PREFIXES, max: 3 },
  { id: 'r32', label: 'שלב ה-32', prefixes: ['Round of 32'], max: 1 },
  { id: 'r16', label: 'שמינית הגמר', prefixes: ['Round of 16'], max: 1 },
]

/** Resolves which joker stage group (if any) a match round belongs to */
export function getJokerStageGroup(round?: string | null): JokerStageGroup | null {
  if (!round) return null
  return JOKER_STAGE_GROUPS.find(g => g.prefixes.some(p => round.startsWith(p))) ?? null
}
