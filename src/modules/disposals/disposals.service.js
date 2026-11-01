import { withTransaction } from '../../db/transaction.js';
import { AppError } from '../../shared/app-error.js';
import * as repository from './disposals.repository.js';

export function listDisposals(options) {
  return repository.listDisposals(options);
}

export async function getDisposal(id) {
  const disposal = await repository.findDisposal(id);
  if (!disposal) throw new AppError('NOT_FOUND', 'Disposal not found', 404);
  return disposal;
}

export function createDisposal(data, proposedBy) {
  return withTransaction((client) => repository.createDisposal({ ...data, proposed_by: proposedBy }, client));
}

export async function changeStatus(id, action, userId, rejectionReason) {
  return withTransaction(async (client) => {
    const disposal = await repository.findDisposal(id, client);
    if (!disposal) throw new AppError('NOT_FOUND', 'Disposal not found', 404);
    if (disposal.status !== 'proposed') {
      throw new AppError('INVALID_STATE_TRANSITION', `Cannot ${action} a ${disposal.status} disposal`, 409);
    }
    const data = action === 'approve'
      ? { status: 'approved', approved_by: userId, approved_at: new Date() }
      : { status: 'rejected', rejected_by: userId, rejected_at: new Date(), rejection_reason: rejectionReason || null };
    return repository.updateDisposal(id, data, client);
  });
}