import { useEffect } from 'react'

export function usePageTitle(title) {
  useEffect(() => {
    const prev = document.title
    document.title = title ? `${title} · Gymkhana Inventory` : 'Gymkhana Inventory'
    return () => { document.title = prev }
  }, [title])
}
