import * as repository from './org_units.repository.js';
import { AppError } from '../../shared/app-error.js';

export async function create(data) {
  // Check if code already exists
  const existing = await repository.getByCode(data.code);
  if (existing) {
    throw new AppError('ORG_UNIT_CODE_EXISTS', 'Organization unit with this code already exists', 409);
  }

  // Validate parent exists if provided
  if (data.parent_id) {
    const parent = await repository.getById(data.parent_id);
    if (!parent) {
      throw new AppError('PARENT_NOT_FOUND', 'Parent organization unit not found', 404);
    }
  }

  return repository.create(data);
}

export async function getById(id) {
  const orgUnit = await repository.getById(id);
  if (!orgUnit) {
    throw new AppError('ORG_UNIT_NOT_FOUND', 'Organization unit not found', 404);
  }
  return orgUnit;
}

export async function list(filters) {
  const offset = (filters.page - 1) * filters.limit;
  
  // Convert string boolean to actual boolean if provided
  const processedFilters = {
    ...filters,
    is_active: filters.is_active === 'true' ? true : filters.is_active === 'false' ? false : undefined,
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

export async function update(id, data) {
  // Check if org unit exists
  const existing = await repository.getById(id);
  if (!existing) {
    throw new AppError('ORG_UNIT_NOT_FOUND', 'Organization unit not found', 404);
  }

  // Check code uniqueness if updating code
  if (data.code && data.code !== existing.code) {
    const codeExists = await repository.getByCode(data.code);
    if (codeExists) {
      throw new AppError('ORG_UNIT_CODE_EXISTS', 'Organization unit with this code already exists', 409);
    }
  }

  // Validate parent exists if updating
  if (data.parent_id) {
    // Prevent setting self as parent
    if (data.parent_id === id) {
      throw new AppError('INVALID_PARENT', 'Organization unit cannot be its own parent', 400);
    }

    const parent = await repository.getById(data.parent_id);
    if (!parent) {
      throw new AppError('PARENT_NOT_FOUND', 'Parent organization unit not found', 404);
    }
  }

  return repository.update(id, data);
}

export async function deleteById(id) {
  // Check if org unit exists
  const existing = await repository.getById(id);
  if (!existing) {
    throw new AppError('ORG_UNIT_NOT_FOUND', 'Organization unit not found', 404);
  }

  // Check if it has children
  const children = await repository.getChildren(id);
  if (children.length > 0) {
    throw new AppError('ORG_UNIT_HAS_CHILDREN', 'Cannot delete organization unit with children', 400);
  }

  return repository.deleteById(id);
}

export async function getChildren(parentId) {
  // Validate parent exists
  const parent = await repository.getById(parentId);
  if (!parent) {
    throw new AppError('ORG_UNIT_NOT_FOUND', 'Organization unit not found', 404);
  }

  return repository.getChildren(parentId);
}
