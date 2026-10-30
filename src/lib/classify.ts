/** Age thresholds used for the age pill; tuned to "a week" and "three weeks". */
export function ageSeverity(days: number): 'fresh' | 'aging' | 'stale' {
  if (days > 21) return 'stale'
  if (days > 7) return 'aging'
  return 'fresh'
}
