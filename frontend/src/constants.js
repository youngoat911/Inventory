// Keep in sync with BUDGET_TYPES in src/config/constants.js
export const BUDGET_TYPES = [
  { value: 'institute', label: 'Institute budget' },
  { value: 'r_and_d', label: 'R&D' },
  { value: 'sponsored', label: 'Sponsored' },
  { value: 'donation', label: 'Donation' },
]

export function budgetTypeLabel(value) {
  return BUDGET_TYPES.find((t) => t.value === value)?.label || value || '—'
}
