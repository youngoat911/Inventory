import * as repository from './categories.repository.js';
import { AppError } from '../../shared/app-error.js';
import { logAudit } from '../../shared/audit.service.js';

export async function create(data, actor = null) {
  if (data.level === 1 || data.parent_id === null || data.parent_id === undefined) {
    throw new AppError(
      'LEVEL_1_READ_ONLY',
      'Level 1 government categories are fixed; new categories must specify a parent_id at Level 1, 2, or 3',
      403
    );
  }

  const parent = await repository.getById(data.parent_id);
  if (!parent) {
    throw new AppError('PARENT_NOT_FOUND', 'Parent category not found', 404);
  }

  if (parent.is_legacy) {
    throw new AppError('LEGACY_PARENT_FORBIDDEN', 'Cannot add sub-categories under a legacy category', 400);
  }

  const targetLevel = parent.level + 1;
  if (targetLevel > 4) {
    throw new AppError(
      'MAX_CATEGORY_DEPTH',
      'Cannot create a sub-category under a Level 4 category (maximum depth is 4)',
      400
    );
  }

  if (data.level !== undefined && data.level !== targetLevel) {
    throw new AppError(
      'INVALID_CATEGORY_LEVEL',
      `Child level (${data.level}) must be exactly parent level + 1 (${targetLevel})`,
      400
    );
  }

  if (
    data.dep_rate_percent !== undefined ||
    data.amortization_life_years !== undefined ||
    (data.dep_method !== undefined && data.dep_method !== 'SLM')
  ) {
    throw new AppError(
      'RATE_OVERRIDE_FORBIDDEN',
      'Only Level 1 categories carry depreciation rates; Levels 2-4 inherit from their Level 1 ancestor',
      400
    );
  }

  const existingName = await repository.getSiblingByName(data.parent_id, data.name);
  if (existingName) {
    throw new AppError(
      'CATEGORY_NAME_EXISTS',
      'A sibling category with this name already exists under the same parent',
      409
    );
  }

  const code = data.code || (await repository.getNextSiblingCode(data.parent_id));
  const existingCode = await repository.getSiblingByCode(data.parent_id, code);
  if (existingCode) {
    throw new AppError(
      'CATEGORY_CODE_EXISTS',
      'A sibling category with this code already exists under the same parent',
      409
    );
  }

  const created = await repository.create({
    ...data,
    level: targetLevel,
    code,
    is_system: false,
    is_legacy: false,
  });

  await logAudit({
    table_name: 'categories',
    record_id: created.id,
    action: 'create',
    changed_by: actor?.userId || null,
    new_data: created,
    ...(actor?.meta || {}),
  });

  return repository.getById(created.id);
}

export async function getById(id) {
  const category = await repository.getById(id);
  if (!category) {
    throw new AppError('CATEGORY_NOT_FOUND', 'Category not found', 404);
  }
  return category;
}

export async function getPath(id) {
  const category = await repository.getById(id);
  if (!category) {
    throw new AppError('CATEGORY_NOT_FOUND', 'Category not found', 404);
  }
  return repository.getPath(id);
}

export async function list(filters) {
  const offset = (filters.page - 1) * filters.limit;

  const processedFilters = {
    ...filters,
    offset,
  };

  const result = await repository.list(processedFilters);

  return {
    items: result.items,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: result.total,
      pages: Math.ceil(result.total / filters.limit),
    },
  };
}

export async function getTree() {
  const rows = await repository.getAllWithAssetCounts();
  const nodeMap = new Map();

  for (const row of rows) {
    nodeMap.set(row.id, {
      ...row,
      asset_count: row.direct_asset_count || 0,
      children: [],
    });
  }

  const roots = [];
  for (const node of nodeMap.values()) {
    if (node.parent_id && nodeMap.has(node.parent_id)) {
      nodeMap.get(node.parent_id).children.push(node);
    } else {
      roots.push(node);
    }
  }

  function rollupCounts(node) {
    let total = node.direct_asset_count || 0;
    for (const child of node.children) {
      total += rollupCounts(child);
    }
    node.asset_count = total;
    return total;
  }

  for (const root of roots) {
    rollupCounts(root);
  }

  return roots;
}

export async function update(id, data, actor = null) {
  const existing = await repository.getById(id);
  if (!existing) {
    throw new AppError('CATEGORY_NOT_FOUND', 'Category not found', 404);
  }

  if (existing.is_system || existing.level === 1) {
    throw new AppError(
      'LEVEL_1_READ_ONLY',
      'Level 1 government categories are fixed and cannot be modified',
      403
    );
  }

  if (data.parent_id === null || data.level === 1) {
    throw new AppError(
      'LEVEL_1_READ_ONLY',
      'Cannot move a category to Level 1',
      403
    );
  }

  if (
    data.dep_rate_percent !== undefined ||
    data.amortization_life_years !== undefined ||
    (data.dep_method !== undefined && data.dep_method !== 'SLM')
  ) {
    throw new AppError(
      'RATE_OVERRIDE_FORBIDDEN',
      'Only Level 1 categories carry depreciation rates; Levels 2-4 inherit from their Level 1 ancestor',
      400
    );
  }

  let targetParentId = existing.parent_id;
  let targetLevel = existing.level;

  if (data.parent_id !== undefined && data.parent_id !== existing.parent_id) {
    if (data.parent_id === id) {
      throw new AppError('INVALID_PARENT', 'Category cannot be its own parent', 400);
    }

    const parent = await repository.getById(data.parent_id);
    if (!parent) {
      throw new AppError('PARENT_NOT_FOUND', 'Parent category not found', 404);
    }
    if (parent.is_legacy) {
      throw new AppError('LEGACY_PARENT_FORBIDDEN', 'Cannot attach under a legacy category', 400);
    }
    if (parent.level + 1 > 4) {
      throw new AppError('MAX_CATEGORY_DEPTH', 'Cannot move category under a Level 4 parent', 400);
    }
    if (parent.level + 1 !== existing.level) {
      throw new AppError(
        'INVALID_CATEGORY_LEVEL',
        `New parent must be at level ${existing.level - 1} (got level ${parent.level})`,
        400
      );
    }
    targetParentId = data.parent_id;
    targetLevel = parent.level + 1;
  } else if (data.level !== undefined && data.level !== existing.level) {
    throw new AppError(
      'INVALID_CATEGORY_LEVEL',
      `Category level (${data.level}) must match parent level + 1 (${existing.level})`,
      400
    );
  }

  const targetName = data.name ?? existing.name;
  if (
    (data.name && data.name.toLowerCase() !== existing.name.toLowerCase()) ||
    targetParentId !== existing.parent_id
  ) {
    const nameExists = await repository.getSiblingByName(targetParentId, targetName, id);
    if (nameExists) {
      throw new AppError(
        'CATEGORY_NAME_EXISTS',
        'A sibling category with this name already exists under the same parent',
        409
      );
    }
  }

  const targetCode = data.code ?? existing.code;
  if ((data.code && data.code !== existing.code) || targetParentId !== existing.parent_id) {
    if (targetCode) {
      const codeExists = await repository.getSiblingByCode(targetParentId, targetCode, id);
      if (codeExists) {
        throw new AppError(
          'CATEGORY_CODE_EXISTS',
          'A sibling category with this code already exists under the same parent',
          409
        );
      }
    }
  }

  const updated = await repository.update(id, {
    ...data,
    level: targetLevel,
  });

  await logAudit({
    table_name: 'categories',
    record_id: id,
    action: 'update',
    changed_by: actor?.userId || null,
    old_data: existing,
    new_data: updated,
    ...(actor?.meta || {}),
  });

  return repository.getById(id);
}

export async function deleteById(id, actor = null) {
  const existing = await repository.getById(id);
  if (!existing) {
    throw new AppError('CATEGORY_NOT_FOUND', 'Category not found', 404);
  }

  if (existing.is_system || existing.level === 1) {
    throw new AppError(
      'LEVEL_1_READ_ONLY',
      'Level 1 government categories are fixed and cannot be deleted',
      403
    );
  }

  const counts = await repository.getDependencyCounts(id);
  if (counts.children_count > 0) {
    throw new AppError(
      'CATEGORY_HAS_CHILDREN',
      `Cannot delete category with ${counts.children_count} sub-categories and ${counts.assets_count} assets`,
      409,
      [counts]
    );
  }

  if (counts.assets_count > 0) {
    throw new AppError(
      'CATEGORY_HAS_ASSETS',
      `Cannot delete category with ${counts.assets_count} assigned assets`,
      409,
      [counts]
    );
  }

  const deleted = await repository.deleteById(id);

  await logAudit({
    table_name: 'categories',
    record_id: id,
    action: 'delete',
    changed_by: actor?.userId || null,
    old_data: existing,
    ...(actor?.meta || {}),
  });

  return deleted;
}

export async function getChildren(parentId) {
  const parent = await repository.getById(parentId);
  if (!parent) {
    throw new AppError('CATEGORY_NOT_FOUND', 'Category not found', 404);
  }

  return repository.getChildren(parentId);
}
