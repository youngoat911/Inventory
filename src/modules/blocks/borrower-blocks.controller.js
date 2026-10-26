// src/modules/borrower-blocks/borrower-blocks.controller.js
import * as borrowerBlocksService from './borrower-blocks.service.js';
import { isAdmin, scopeOrgFilters } from '../../middleware/authorize.js';

export async function createBorrowerBlock(req, res, next) {
  try {
    const block = await borrowerBlocksService.createBorrowerBlock(req.validated.body);
    res.status(201).json({ data: block });
  } catch (error) {
    next(error);
  }
}

export async function listBorrowerBlocks(req, res, next) {
  try {
    const query = req.validated.query || {};
    const filters = isAdmin(req.user) ? scopeOrgFilters(req.user, query) : query;
    const result = await borrowerBlocksService.listBorrowerBlocks({ filters });
    res.status(200).json({
      data: result.rows,
      meta: {
        total: result.total,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getActiveBlocksForUser(req, res, next) {
  try {
    const blocks = await borrowerBlocksService.getActiveBlocksForUser(req.validated.params.userId);
    res.status(200).json({ data: blocks });
  } catch (error) {
    next(error);
  }
}

export async function getBlockById(req, res, next) {
  try {
    const block = await borrowerBlocksService.getBlockById(req.validated.params.id);
    if (!block) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Block not found', details: [] },
      });
    }
    res.status(200).json({ data: block });
  } catch (error) {
    next(error);
  }
}

export async function updateBorrowerBlock(req, res, next) {
  try {
    const block = await borrowerBlocksService.updateBorrowerBlock(
      req.validated.params.id,
      req.validated.body
    );
    if (!block) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Block not found', details: [] },
      });
    }
    res.status(200).json({ data: block });
  } catch (error) {
    next(error);
  }
}

export async function deleteBorrowerBlock(req, res, next) {
  try {
    const block = await borrowerBlocksService.deleteBorrowerBlock(req.validated.params.id);
    if (!block) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Block not found', details: [] },
      });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}