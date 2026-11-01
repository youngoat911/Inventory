import { getAdminOrgIds, isAdmin } from '../../middleware/authorize.js';
import { AppError } from '../../shared/app-error.js';
import { withTransaction } from '../../db/transaction.js';
import * as repository from './maintenance.repository.js';

export async function list(req, res, next) {
  try {
    const { page, limit } = req.validated.query;
    const orgUnitIds = isAdmin(req.user) ? getAdminOrgIds(req.user) : null;
    const result = await repository.listMaintenance({ limit, offset: (page - 1) * limit, orgUnitIds });
    res.json({ data: result.rows, meta: { page, limit, total: result.total, pages: Math.ceil(result.total / limit) } });
  } catch (error) { next(error); }
}

export async function create(req, res, next) {
  try { res.status(201).json({ data: await withTransaction((client) => repository.createMaintenance({ ...req.validated.body, reported_by: req.user.id }, client)) }); }
  catch (error) { next(error); }
}

export async function resolve(req, res, next) {
  try {
    const record = await withTransaction((client) => repository.resolveMaintenance(req.validated.params.id, req.user.id, client));
    if (!record) throw new AppError('NOT_FOUND', 'Maintenance record not found or already resolved', 404);
    res.json({ data: record });
  } catch (error) { next(error); }
}