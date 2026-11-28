import * as service from './reports.service.js';
import { getAdminOrgIds, isAdmin, scopeOrgFilters } from '../../middleware/authorize.js';

function reportFilters(user, query) {
  if (isAdmin(user)) return scopeOrgFilters(user, query);
  return query;
}

// Dashboard endpoints
export async function getDashboardSummary(req, res, next) {
  try {
    const roles = req.user.roles.map((role) => role.role);
    const borrowerId = roles.includes('borrower') &&
      !roles.some((role) => ['super_admin', 'org_admin', 'berm_incharge'].includes(role))
      ? req.user.id
      : null;
    const orgIds = isAdmin(req.user) ? getAdminOrgIds(req.user) : null;
    const summary = await service.getDashboardSummary(borrowerId, orgIds);
    res.status(200).json({ data: summary });
  } catch (error) {
    next(error);
  }
}

export async function getOrgDashboard(req, res, next) {
  try {
    const summary = await service.getOrgDashboard(req.validated.params.orgId);
    res.status(200).json({ data: summary });
  } catch (error) {
    next(error);
  }
}

// Report endpoints
export async function getAssetInventoryReport(req, res, next) {
  try {
    const filters = reportFilters(req.user, req.validated.query);
    const result = await service.getAssetInventoryReport(filters);
    
    if (filters.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="asset-inventory-${Date.now()}.csv"`);
      res.status(200).send(result);
    } else {
      res.status(200).json({ data: result });
    }
  } catch (error) {
    next(error);
  }
}

export async function getBorrowingHistoryReport(req, res, next) {
  try {
    const filters = reportFilters(req.user, req.validated.query);
    const result = await service.getBorrowingHistoryReport(filters);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function getOverdueLoansReport(req, res, next) {
  try {
    const filters = reportFilters(req.user, req.validated.query);
    const result = await service.getOverdueLoansReport(filters);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function getMaintenanceCostsReport(req, res, next) {
  try {
    const filters = reportFilters(req.user, req.validated.query);
    const result = await service.getMaintenanceCostsReport(filters);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function getDisposalSummaryReport(req, res, next) {
  try {
    const filters = reportFilters(req.user, req.validated.query);
    const result = await service.getDisposalSummaryReport(filters);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function getVerificationProgressReport(req, res, next) {
  try {
    const filters = reportFilters(req.user, req.validated.query);
    const result = await service.getVerificationProgressReport(filters);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function getAssetUtilizationReport(req, res, next) {
  try {
    const filters = isAdmin(req.user) ? scopeOrgFilters(req.user, req.validated.query) : req.validated.query;
    const result = await service.getAssetUtilizationReport(filters);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function getDepreciationReport(req, res, next) {
  try {
    const filters = reportFilters(req.user, req.validated.query);
    const result = await service.getDepreciationReport(filters);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
}
