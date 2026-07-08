// Shared constants — safe to import in both Server and Client components

/** Admin/owner account excluded from public predictions/bonus distributions and summaries */
export const HIDDEN_USER_ID = '9a3697c9-d23d-4ab6-99e1-7f6196d45f20'

/** כמה זמן לפני בעיטת הפתיחה ננעלת הגשת הניחושים למשחק (גלובלי לכל המשחקים) */
export const MATCH_LOCK_BEFORE_MIN = 15
export const MATCH_LOCK_BEFORE_MS = MATCH_LOCK_BEFORE_MIN * 60 * 1000

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
  // ג'וקר אחד משותף לרבע/חצי/גמר + גמר מקום 3
  // (שמות ה-API: Quarter-finals / Semi-finals / 3rd Place Final / Final)
  { id: 'finals', label: 'שלבי הגמר', prefixes: ['Quarter-finals', 'Semi-finals', '3rd Place Final', 'Final'], max: 1 },
]

/** Resolves which joker stage group (if any) a match round belongs to */
export function getJokerStageGroup(round?: string | null): JokerStageGroup | null {
  if (!round) return null
  return JOKER_STAGE_GROUPS.find(g => g.prefixes.some(p => round.startsWith(p))) ?? null
}

/** True if a round belongs to the group/league stage (collapsed into one filter) */
export function isGroupStageRound(round?: string | null): boolean {
  if (!round) return false
  return GROUP_STAGE_PREFIXES.some(p => round.startsWith(p))
    || round.startsWith('Regular Season')
    || round.startsWith('League Stage')
}
