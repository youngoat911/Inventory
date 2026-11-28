import * as service from './assets.service.js';
import { getAdminOrgIds, isAdmin, scopeOrgFilters } from '../../middleware/authorize.js';
import { importAssets as runImport } from './assets.import.js';

export async function create(req, res, next) {
  try {
    const asset = await service.create(req.validated.body);
    res.status(201).json({ data: asset });
  } catch (error) {
    next(error);
  }
}

export async function batchCreate(req, res, next) {
  try {
    const assets = await service.batchCreate(req.validated.body.assets);
    res.status(201).json({ data: assets });
  } catch (error) {
    next(error);
  }
}

export async function importAssets(req, res, next) {
  try {
    const { rows, dry_run: dryRun } = req.validated.body;
    const result = await runImport(rows, { dryRun, orgIds: getAdminOrgIds(req.user) });
    const status = result.errors.length > 0 ? 422 : result.committed ? 201 : 200;
    res.status(status).json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function getById(req, res, next) {
  try {
    const asset = await service.getById(req.validated.params.id);
    res.status(200).json({ data: asset });
  } catch (error) {
    next(error);
  }
}

export async function list(req, res, next) {
  try {
    const filters = isAdmin(req.user)
      ? scopeOrgFilters(req.user, req.validated.query, 'owner_org_ids')
      : req.validated.query;
    const result = await service.list(filters);
    res.status(200).json({ 
      data: result.items,
      meta: { pagination: result.pagination }
    });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const asset = await service.update(req.validated.params.id, req.validated.body);
    res.status(200).json({ data: asset });
  } catch (error) {
    next(error);
  }
}

export async function deleteById(req, res, next) {
  try {
    await service.deleteById(req.validated.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function generateQRToken(req, res, next) {
  try {
    const result = await service.generateQRToken(req.validated.params.id);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function resolveQRToken(req, res, next) {
  try {
    const asset = await service.resolveQRToken(req.validated.params.qrToken);
    res.status(200).json({ data: asset });
  } catch (error) {
    next(error);
  }
}

export async function exportAssets(req, res, next) {
  try {
    const filters = isAdmin(req.user)
      ? scopeOrgFilters(req.user, req.validated.query, 'owner_org_ids')
      : req.validated.query;
    const result = await service.exportAssets(filters);
    
    if (req.validated.query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="assets-export-${Date.now()}.csv"`);
      res.status(200).send(result);
    } else {
      res.status(200).json({ data: result });
    }
  } catch (error) {
    next(error);
  }
}
