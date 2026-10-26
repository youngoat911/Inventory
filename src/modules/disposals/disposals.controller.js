import { getAdminOrgIds, isAdmin } from '../../middleware/authorize.js';
import * as service from './disposals.service.js';

export async function list(req, res, next) {
  try {
    const { page, limit, status } = req.validated.query;
    const orgUnitIds = isAdmin(req.user) ? getAdminOrgIds(req.user) : null;
    const result = await service.listDisposals({ status, limit, offset: (page - 1) * limit, orgUnitIds });
    res.json({ data: result.rows, meta: { page, limit, total: result.total, pages: Math.ceil(result.total / limit) } });
  } catch (error) { next(error); }
}

export async function getById(req, res, next) {
  try { res.json({ data: await service.getDisposal(req.validated.params.id) }); }
  catch (error) { next(error); }
}

export async function create(req, res, next) {
  try { res.status(201).json({ data: await service.createDisposal(req.validated.body, req.user.id) }); }
  catch (error) { next(error); }
}

export async function approve(req, res, next) {
  try { res.json({ data: await service.changeStatus(req.validated.params.id, 'approve', req.user.id) }); }
  catch (error) { next(error); }
}

export async function reject(req, res, next) {
  try { res.json({ data: await service.changeStatus(req.validated.params.id, 'reject', req.user.id, req.validated.body.rejection_reason) }); }
  catch (error) { next(error); }
}