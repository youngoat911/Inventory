import { useMemo } from 'react'
import { findCategoryPath, getParentSelection } from '../categoryTree'

export default function CascadingCategoryPicker({
  tree = [],
  value = '',
  onChange,
  mode = 'leaf',
  required = false,
}) {
  const activeTree = useMemo(
    () => tree.filter((node) => !node.is_legacy),
    [tree]
  )

  const selectedPath = useMemo(() => {
    if (!value) return []
    return findCategoryPath(activeTree, value)
  }, [activeTree, value])

  const level1 = selectedPath[0] || null
  const level2 = selectedPath[1] || null
  const level3 = selectedPath[2] || null
  const level4 = selectedPath[3] || null

  const l1Options = activeTree
  const l2Options = level1?.children || []
  const l3Options = level2?.children || []
  const l4Options = level3?.children || []

  function handleSelect(levelIndex, nextId) {
    if (!nextId) {
      if (levelIndex === 0) {
        onChange('', null)
        return
      }
      const selection = getParentSelection(selectedPath, levelIndex)
      onChange(selection.id, selection.category)
      return
    }

    const options = [l1Options, l2Options, l3Options, l4Options][levelIndex] || []
    const node = options.find((item) => item.id === nextId) || null
    if (!node) return

    if (mode === 'any') {
      onChange(node.id, node)
      return
    }

    onChange(node.id, node)
  }

  const deepest = selectedPath[selectedPath.length - 1] || null
  const isLeafSelected =
    !!deepest &&
    deepest.level >= 2 &&
    (!deepest.children || deepest.children.length === 0)

  if (mode === 'any') {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <select
          className="select"
          aria-label="Filter by Level 1 category"
          value={level1?.id || ''}
          onChange={(e) => handleSelect(0, e.target.value)}
        >
          <option value="">All categories</option>
          {l1Options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code ? `${c.code} — ` : ''}{c.name}
            </option>
          ))}
        </select>

        {level1 && l2Options.length > 0 ? (
          <select
            className="select"
            aria-label="Filter by Level 2 category"
            value={level2?.id || ''}
            onChange={(e) => handleSelect(1, e.target.value)}
          >
            <option value="">All in {level1.name}</option>
            {l2Options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code ? `${c.code} — ` : ''}{c.name}
              </option>
            ))}
          </select>
        ) : null}

        {level2 && l3Options.length > 0 ? (
          <select
            className="select"
            aria-label="Filter by Level 3 category"
            value={level3?.id || ''}
            onChange={(e) => handleSelect(2, e.target.value)}
          >
            <option value="">All in {level2.name}</option>
            {l3Options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code ? `${c.code} — ` : ''}{c.name}
              </option>
            ))}
          </select>
        ) : null}

        {level3 && l4Options.length > 0 ? (
          <select
            className="select"
            aria-label="Filter by Level 4 category"
            value={level4?.id || ''}
            onChange={(e) => handleSelect(3, e.target.value)}
          >
            <option value="">All in {level3.name}</option>
            {l4Options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code ? `${c.code} — ` : ''}{c.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>
    )
  }

  return (
    <div className="field">
      <label htmlFor="category_l1">Category (Level 1 → Level 4)</label>
      <div className="form-row">
        <select
          id="category_l1"
          value={level1?.id || ''}
          onChange={(e) => handleSelect(0, e.target.value)}
          required={required}
        >
          <option value="">Select Level 1</option>
          {l1Options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code ? `${c.code} — ` : ''}{c.name}
            </option>
          ))}
        </select>

        <select
          id="category_l2"
          aria-label="Level 2 sub-category"
          value={level2?.id || ''}
          onChange={(e) => handleSelect(1, e.target.value)}
          disabled={!level1 || l2Options.length === 0}
          required={required && !!level1 && l2Options.length > 0}
        >
          <option value="">
            {!level1
              ? 'Select Level 1 first'
              : l2Options.length === 0
                ? 'No sub-categories'
                : 'Select Level 2'}
          </option>
          {l2Options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code ? `${c.code} — ` : ''}{c.name}
            </option>
          ))}
        </select>
      </div>

      {level2 && l3Options.length > 0 ? (
        <div className="form-row" style={{ marginTop: '0.5rem' }}>
          <select
            id="category_l3"
            aria-label="Level 3 sub-category"
            value={level3?.id || ''}
            onChange={(e) => handleSelect(2, e.target.value)}
            required={required}
          >
            <option value="">Select Level 3</option>
            {l3Options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code ? `${c.code} — ` : ''}{c.name}
              </option>
            ))}
          </select>

          {level3 && l4Options.length > 0 ? (
            <select
              id="category_l4"
              aria-label="Level 4 sub-category"
              value={level4?.id || ''}
              onChange={(e) => handleSelect(3, e.target.value)}
              required={required}
            >
              <option value="">Select Level 4</option>
              {l4Options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `${c.code} — ` : ''}{c.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      ) : null}

      {deepest ? (
        <span className="muted" style={{ fontSize: '0.85rem', marginTop: '0.35rem', display: 'block' }}>
          Path: <strong>{deepest.full_path || selectedPath.map((n) => n.name).join(' > ')}</strong>
          {deepest.code_path ? ` (${deepest.code_path})` : ''}
          {!isLeafSelected ? ' — select a leaf sub-category' : ''}
        </span>
      ) : (
        <span className="muted" style={{ fontSize: '0.85rem', marginTop: '0.35rem', display: 'block' }}>
          Choose a Level 1 category and drill down to a leaf sub-category (Levels 2–4).
        </span>
      )}
    </div>
  )
}
