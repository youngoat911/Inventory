import { describe, expect, it } from 'vitest';
import {
  flattenCategoryTree,
  getParentSelection,
  isAssetCategoryLeaf,
} from '../../frontend/src/categoryTree.js';

const categoryTree = [
  {
    id: 'level-1',
    level: 1,
    is_legacy: false,
    asset_count: 0,
    children: [
      {
        id: 'level-2',
        level: 2,
        is_legacy: false,
        asset_count: 0,
        children: [
          {
            id: 'level-3',
            level: 3,
            is_legacy: false,
            asset_count: 0,
            children: [],
          },
        ],
      },
    ],
  },
  { id: 'empty-legacy', is_legacy: true, asset_count: 0, children: [] },
  { id: 'used-legacy', is_legacy: true, asset_count: 2, children: [] },
];

describe('category tree helpers', () => {
  it('keeps the parent selected when clearing a child level', () => {
    const path = [
      categoryTree[0],
      categoryTree[0].children[0],
      categoryTree[0].children[0].children[0],
    ];
    expect(getParentSelection(path, 2)).toEqual({
      id: 'level-2',
      category: categoryTree[0].children[0],
    });
  });

  it('accepts only active Level 2-4 leaf categories for assets', () => {
    expect(isAssetCategoryLeaf(categoryTree, 'level-1')).toBe(false);
    expect(isAssetCategoryLeaf(categoryTree, 'level-2')).toBe(false);
    expect(isAssetCategoryLeaf(categoryTree, 'level-3')).toBe(true);
    expect(isAssetCategoryLeaf(categoryTree, 'empty-legacy')).toBe(false);
    expect(isAssetCategoryLeaf(categoryTree, 'missing')).toBe(false);
  });

  it('shows legacy categories with assets and hides empty legacy categories', () => {
    const rows = flattenCategoryTree(categoryTree, new Set(['level-1', 'level-2']));
    expect(rows.map((category) => category.id)).toEqual([
      'level-1',
      'level-2',
      'level-3',
      'used-legacy',
    ]);
  });
});
