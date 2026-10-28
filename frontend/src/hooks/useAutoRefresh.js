// frontend/src/hooks/useAutoRefresh.js
import { useEffect, useRef } from 'react'

/**
 * Hook that calls a callback whenever a real-time entity change event is received
 * via WebSockets for the matching entity or entities.
 *
 * @param {string|string[]} entities - Target entity name(s) (e.g. 'assets', 'issues')
 * @param {Function} onRefresh - Callback function to trigger data refetch
 */
export function useAutoRefresh(entities, onRefresh) {
  const callbackRef = useRef(onRefresh)
  callbackRef.current = onRefresh

  const entityList = Array.isArray(entities) ? entities : [entities]

  useEffect(() => {
    function handleChange(e) {
      const changedEntity = e.detail?.entity
      if (!changedEntity || entityList.includes(changedEntity) || entityList.includes('*')) {
        callbackRef.current?.()
      }
    }

    window.addEventListener('inventory:change', handleChange)
    return () => {
      window.removeEventListener('inventory:change', handleChange)
    }
  }, [entityList.join(',')])
}

export default useAutoRefresh

