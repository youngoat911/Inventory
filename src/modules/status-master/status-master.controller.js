import * as service from './status-master.service.js';

export async function list(req, res, next) {
  try {
    const data = await service.list(req.validated.params.kind, req.validated.query);
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const data = await service.create(req.validated.params.kind, req.validated.body);
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const { kind, code } = req.validated.params;
    const data = await service.update(kind, code, req.validated.body);
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function remove(req, res, next) {
  try {
    const { kind, code } = req.validated.params;
    await service.remove(kind, code);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
