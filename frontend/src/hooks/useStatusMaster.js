import { useEffect, useState } from 'react'
import { statusMasterApi } from '../api/client'

const FALLBACK = {
  status: [
    { code: 'available', label: 'Available', color: 'ok' },
    { code: 'reserved', label: 'Reserved', color: 'warn' },
    { code: 'issued', label: 'Issued', color: 'info' },
    { code: 'in_maintenance', label: 'In maintenance', color: 'warn' },
    { code: 'disposed', label: 'Disposed', color: 'danger' },
    { code: 'lost', label: 'Lost', color: 'danger' },
  ],
  condition: [
    { code: 'excellent', label: 'Excellent', color: 'ok' },
    { code: 'good', label: 'Good', color: 'ok' },
    { code: 'fair', label: 'Fair', color: 'warn' },
    { code: 'poor', label: 'Poor', color: 'danger' },
    { code: 'damaged', label: 'Damaged', color: 'danger' },
    { code: 'under_repair', label: 'Under repair', color: 'warn' },
  ],
}

/** Loads the admin-managed list of asset statuses and conditions. */
export function useStatusMaster() {
  const [statuses, setStatuses] = useState(FALLBACK.status)
  const [conditions, setConditions] = useState(FALLBACK.condition)

  useEffect(() => {
    let cancelled = false
    Promise.all([statusMasterApi.list('status'), statusMasterApi.list('condition')])
      .then(([s, c]) => {
        if (cancelled) return
        if (s.data?.length) setStatuses(s.data)
        if (c.data?.length) setConditions(c.data)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const find = (list, code) => list.find((item) => item.code === code)
  return {
    statuses,
    conditions,
    statusMeta: (code) => find(statuses, code),
    conditionMeta: (code) => find(conditions, code),
  }
}
