export function findCategoryNode(nodes, targetId) {
  for (const node of nodes) {
    if (node.id === targetId) return node
    if (node.children?.length) {
      const found = findCategoryNode(node.children, targetId)
      if (found) return found
    }
  }
  return null
}

export function findCategoryPath(nodes, targetId) {
  for (const node of nodes) {
    if (node.id === targetId) return [node]
    if (node.children?.length) {
      const childPath = findCategoryPath(node.children, targetId)
      if (childPath.length > 0) return [node, ...childPath]
    }
  }
  return []
}

export function getParentSelection(selectedPath, levelIndex) {
  const category = selectedPath[levelIndex - 1] || null
  return { id: category?.id || '', category }
}

export function isAssetCategoryLeaf(tree, categoryId) {
  const category = findCategoryNode(tree, categoryId)
  return Boolean(
    category &&
    !category.is_legacy &&
    category.level >= 2 &&
    !category.children?.length
  )
}

export function flattenCategoryTree(nodes, expandedIds) {
  const rows = []

  function walk(list) {
    for (const node of list) {
      if (node.is_legacy && Number(node.asset_count ?? 0) === 0) continue
      rows.push(node)
      if (node.children?.length && expandedIds.has(node.id)) {
        walk(node.children)
      }
    }
  }

  walk(nodes)
  return rows
}
