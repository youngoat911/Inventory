import * as repository from './status-master.repository.js';
import { AppError } from '../../shared/app-error.js';

function slugify(label) {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
  return /^[a-z]/.test(slug) ? slug : `s_${slug}`.slice(0, 50);
}

export function list(kind, query = {}) {
  return repository.list(kind, { includeInactive: Boolean(query.include_inactive) });
}

export async function create(kind, data) {
  const code = data.code || slugify(data.label);
  if (await repository.get(kind, code)) {
    throw new AppError('STATUS_CODE_EXISTS', `A ${kind} with code "${code}" already exists`, 409);
  }
  const sortOrder = data.sort_order ?? (await repository.nextSortOrder(kind));
  return repository.create(kind, { ...data, code, sort_order: sortOrder });
}

export async function update(kind, code, data) {
  const existing = await repository.get(kind, code);
  if (!existing) throw new AppError('NOT_FOUND', `${kind} "${code}" not found`, 404);
  if (existing.is_system && data.is_active === false) {
    throw new AppError('SYSTEM_STATUS', 'Built-in values cannot be deactivated', 400);
  }
  return repository.update(kind, code, data);
}

export async function remove(kind, code) {
  const existing = await repository.get(kind, code);
  if (!existing) throw new AppError('NOT_FOUND', `${kind} "${code}" not found`, 404);
  if (existing.is_system) {
    throw new AppError('SYSTEM_STATUS', 'Built-in values cannot be deleted', 400);
  }
  const inUse = await repository.countAssetsUsing(kind, code);
  if (inUse > 0) {
    throw new AppError(
      'STATUS_IN_USE',
      `${inUse} asset(s) still use this ${kind}; reassign them or deactivate it instead`,
      409
    );
  }
  await repository.remove(kind, code);
}

/**
 * Throws a 400 if the given status/condition codes are not active entries in the master.
 * `current` lets an asset keep a value that was deactivated after it was assigned.
 */
export async function assertValid({ status, condition }, current = {}, client) {
  for (const [kind, code] of [['status', status], ['condition', condition]]) {
    if (code === undefined || code === null) continue;
    if (current[kind] === code) continue;
    const row = await repository.get(kind, code, client);
    if (!row || !row.is_active) {
      throw new AppError('VALIDATION_ERROR', `Invalid ${kind} value: "${code}"`, 422, [
        { field: kind, issue: `Unknown or inactive ${kind}` },
      ]);
    }
  }
}
