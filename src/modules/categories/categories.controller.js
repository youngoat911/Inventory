import * as service from './categories.service.js';
import { extractRequestMetadata } from '../../shared/audit.service.js';

export async function create(req, res, next) {
  try {
    const actor = { userId: req.user?.id, meta: extractRequestMetadata(req) };
    const category = await service.create(req.validated.body, actor);
    res.status(201).json({ data: category });
  } catch (error) {
    next(error);
  }
}

export async function getById(req, res, next) {
  try {
    const category = await service.getById(req.validated.params.id);
    res.status(200).json({ data: category });
  } catch (error) {
    next(error);
  }
}

export async function getTree(req, res, next) {
  try {
    const tree = await service.getTree();
    res.status(200).json({ data: tree });
  } catch (error) {
    next(error);
  }
}

export async function getPath(req, res, next) {
  try {
    const path = await service.getPath(req.validated.params.id);
    res.status(200).json({ data: path });
  } catch (error) {
    next(error);
  }
}

export async function list(req, res, next) {
  try {
    const result = await service.list(req.validated.query);
    res.status(200).json({
      data: result.items,
      meta: { pagination: result.pagination },
    });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const actor = { userId: req.user?.id, meta: extractRequestMetadata(req) };
    const category = await service.update(req.validated.params.id, req.validated.body, actor);
    res.status(200).json({ data: category });
  } catch (error) {
    next(error);
  }
}

export async function deleteById(req, res, next) {
  try {
    const actor = { userId: req.user?.id, meta: extractRequestMetadata(req) };
    await service.deleteById(req.validated.params.id, actor);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function getChildren(req, res, next) {
  try {
    const children = await service.getChildren(req.validated.params.id);
    res.status(200).json({ data: children });
  } catch (error) {
    next(error);
  }
}
