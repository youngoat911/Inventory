// src/modules/transfers/transfers.service.js
import * as transfersRepository from './transfers.repository.js';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { AppError } from '../../shared/app-error.js';
import { logAudit } from '../../shared/audit.service.js';

/**
 * List transfers with filters and pagination
 */
export async function listTransfers({ limit, offset, filters, sort }) {
  // Define allowed sort columns
  const sortColumns = {
    created_at: 't.created_at',
    requested_at: 't.requested_at',
    approved_at: 't.approved_at',
    status: 't.status',
  };

  let sortClause = 't.created_at DESC'; // Default sort

  if (sort) {
    const parts = sort.split(',').map(s => s.trim());
    const sortExpressions = [];

    for (const part of parts) {
      const descending = part.startsWith('-');
      const key = descending ? part.slice(1) : part;
      const column = sortColumns[key];

      if (!column) {
        throw new AppError('VALIDATION_ERROR', `Invalid sort field: ${key}`, 422);
      }

      sortExpressions.push(`${column} ${descending ? 'DESC' : 'ASC'}`);
    }

    sortClause = sortExpressions.join(', ');
  }

  return await transfersRepository.findTransfers({ filters, limit, offset, sort: sortClause });
}

/**
 * Get transfer by ID
 */
export async function getTransferById(id) {
  const transfer = await transfersRepository.findTransferById(id);

  if (!transfer) {
    throw new AppError('NOT_FOUND', 'Transfer not found', 404);
  }

  return transfer;
}

/**
 * Create a transfer request
 */
export async function createTransfer(transferData, requestedBy) {
  return withTransaction(async (client) => {
    const changesCustody = Boolean(
      transferData.to_issued_to || transferData.to_incharge_name || transferData.to_incharge_phone ||
      transferData.to_user_id
    );

    // Validate from and to are different
    if (!changesCustody &&
        transferData.from_org_id && transferData.to_org_id &&
        transferData.from_org_id === transferData.to_org_id &&
        transferData.from_location_id === transferData.to_location_id) {
      throw new AppError('INVALID_TRANSFER', 'Source and destination cannot be the same', 409);
    }

    if (!changesCustody && !transferData.to_org_id && !transferData.to_location_id) {
      throw new AppError(
        'INVALID_TRANSFER',
        'Choose a destination: org unit, location, issued-to or person in-charge',
        422
      );
    }

    // Lock and check asset
    const assetResult = await client.query(
      // Subqueries instead of JOIN + GROUP BY: Postgres rejects FOR UPDATE with
      // GROUP BY, and joining both tables would multiply the summed quantities.
      `SELECT a.*,
        (SELECT COALESCE(SUM(i.quantity), 0)::int FROM issues i
         WHERE i.asset_id = a.id AND i.status IN ('requested', 'active', 'dropped')) as issued_quantity,
        (SELECT COALESCE(SUM(t.quantity), 0)::int FROM transfers t
         WHERE t.asset_id = a.id AND t.status IN ('requested', 'approved')) as transfer_quantity
       FROM assets a
       WHERE a.id = $1
       FOR UPDATE OF a`,
      [transferData.asset_id]
    );

    if (!assetResult.rows[0]) {
      throw new AppError('NOT_FOUND', 'Asset not found', 404);
    }

    const asset = assetResult.rows[0];
    const availableQuantity = asset.quantity - asset.issued_quantity - asset.transfer_quantity;

    if (transferData.quantity > availableQuantity) {
      throw new AppError('INSUFFICIENT_QUANTITY', 
        `Only ${availableQuantity} unit(s) available for transfer`, 409);
    }

    // Create transfer, snapshotting where the asset is coming from
    const transfer = await transfersRepository.createTransfer({
      ...transferData,
      from_org_id: transferData.from_org_id || asset.owner_org_id,
      from_location_id: transferData.from_location_id || asset.location_id,
      from_user_id: transferData.from_user_id || asset.responsible_user_id,
      from_issued_to: asset.issued_to,
      from_incharge_name: asset.incharge_name,
      from_incharge_phone: asset.incharge_phone,
      requested_by: requestedBy,
    }, client);

    // Log audit
    await logAudit({
      table_name: 'transfers',
      record_id: transfer.id,
      action: 'create',
      changed_by: requestedBy,
      new_data: {
        asset_id: transfer.asset_id,
        quantity: transfer.quantity,
        from_org_id: transfer.from_org_id,
        to_org_id: transfer.to_org_id,
        to_issued_to: transfer.to_issued_to,
        to_incharge_name: transfer.to_incharge_name,
      },
    }, client);

    return transfersRepository.findTransferById(transfer.id, client);
  });
}

/**
 * Update transfer (only allowed before approval)
 */
export async function updateTransfer(id, updateData) {
  return withTransaction(async (client) => {
    const transfer = await transfersRepository.findTransferById(id, client);

    if (!transfer) {
      throw new AppError('NOT_FOUND', 'Transfer not found', 404);
    }

    if (transfer.status !== 'requested') {
      throw new AppError('INVALID_STATE', 
        'Can only update transfers in requested state', 409);
    }

    const updated = await transfersRepository.updateTransfer(id, updateData, client);
    return transfersRepository.findTransferById(updated.id, client);
  });
}

/**
 * Approve transfer
 */
export async function approveTransfer(id, approvedBy) {
  return withTransaction(async (client) => {
    // Lock and get transfer
    const transferResult = await client.query(
      'SELECT * FROM transfers WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (!transferResult.rows[0]) {
      throw new AppError('NOT_FOUND', 'Transfer not found', 404);
    }

    const transfer = transferResult.rows[0];

    if (transfer.status !== 'requested') {
      throw new AppError('INVALID_STATE_TRANSITION', 
        `Cannot approve transfer in ${transfer.status} state`, 409);
    }

    // Re-check asset availability
    const assetResult = await client.query(
      `SELECT a.*,
        (SELECT COALESCE(SUM(i.quantity), 0)::int FROM issues i
         WHERE i.asset_id = a.id AND i.status IN ('requested', 'active', 'dropped')) as issued_quantity,
        (SELECT COALESCE(SUM(t.quantity), 0)::int FROM transfers t
         WHERE t.asset_id = a.id AND t.status IN ('requested', 'approved') AND t.id != $2) as transfer_quantity
       FROM assets a
       WHERE a.id = $1
       FOR UPDATE OF a`,
      [transfer.asset_id, id]
    );

    const asset = assetResult.rows[0];
    const availableQuantity = asset.quantity - asset.issued_quantity - asset.transfer_quantity;

    if (transfer.quantity > availableQuantity) {
      throw new AppError('INSUFFICIENT_QUANTITY', 
        `Only ${availableQuantity} unit(s) available for transfer`, 409);
    }

    // Update transfer to approved
    await transfersRepository.updateTransfer(id, {
      status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date(),
    }, client);

    // Log audit
    await logAudit({
      table_name: 'transfers',
      record_id: id,
      action: 'approve',
      changed_by: approvedBy,
      new_data: {
        previous_status: 'requested',
        new_status: 'approved',
      },
    }, client);

    return transfersRepository.findTransferById(id, client);
  });
}

/**
 * Reject transfer
 */
export async function rejectTransfer(id, rejectedBy, rejectionReason) {
  return withTransaction(async (client) => {
    const transferResult = await client.query(
      'SELECT * FROM transfers WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (!transferResult.rows[0]) {
      throw new AppError('NOT_FOUND', 'Transfer not found', 404);
    }

    const transfer = transferResult.rows[0];

    if (transfer.status !== 'requested') {
      throw new AppError('INVALID_STATE_TRANSITION', 
        `Cannot reject transfer in ${transfer.status} state`, 409);
    }

    await transfersRepository.updateTransfer(id, {
      status: 'rejected',
      rejected_by: rejectedBy,
      rejected_at: new Date(),
      rejection_reason: rejectionReason,
    }, client);

    await logAudit({
      table_name: 'transfers',
      record_id: id,
      action: 'reject',
      changed_by: rejectedBy,
      new_data: {
        previous_status: 'requested',
        new_status: 'rejected',
        rejection_reason: rejectionReason,
      },
    }, client);

    return transfersRepository.findTransferById(id, client);
  });
}

/**
 * Complete transfer (actually move the asset)
 */
export async function completeTransfer(id, completedBy) {
  return withTransaction(async (client) => {
    const transferResult = await client.query(
      'SELECT * FROM transfers WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (!transferResult.rows[0]) {
      throw new AppError('NOT_FOUND', 'Transfer not found', 404);
    }

    const transfer = transferResult.rows[0];

    if (transfer.status !== 'approved') {
      throw new AppError('INVALID_STATE_TRANSITION', 
        `Cannot complete transfer in ${transfer.status} state. Must be approved first.`, 409);
    }

    // Lock asset and update its location/ownership
    const assetResult = await client.query(
      'SELECT * FROM assets WHERE id = $1 FOR UPDATE',
      [transfer.asset_id]
    );

    if (!assetResult.rows[0]) {
      throw new AppError('NOT_FOUND', 'Asset not found', 404);
    }

    // Update asset ownership/location
    const assetUpdates = {};
    if (transfer.to_org_id) assetUpdates.owner_org_id = transfer.to_org_id;
    if (transfer.to_location_id) assetUpdates.location_id = transfer.to_location_id;
    if (transfer.to_user_id) assetUpdates.responsible_user_id = transfer.to_user_id;
    if (transfer.to_issued_to) assetUpdates.issued_to = transfer.to_issued_to;
    if (transfer.to_incharge_name) {
      // A new person in-charge replaces the old contact number too
      assetUpdates.incharge_name = transfer.to_incharge_name;
      assetUpdates.incharge_phone = transfer.to_incharge_phone || null;
    } else if (transfer.to_incharge_phone) {
      assetUpdates.incharge_phone = transfer.to_incharge_phone;
    }

    if (Object.keys(assetUpdates).length > 0) {
      const updateFields = Object.keys(assetUpdates).map((key, i) => `${key} = $${i + 2}`).join(', ');
      await client.query(
        `UPDATE assets SET ${updateFields}, updated_at = NOW() WHERE id = $1`,
        [transfer.asset_id, ...Object.values(assetUpdates)]
      );
    }

    // Mark transfer as completed
    await transfersRepository.updateTransfer(id, {
      status: 'completed',
      completed_by: completedBy,
      completed_at: new Date(),
    }, client);

    await logAudit({
      table_name: 'transfers',
      record_id: id,
      action: 'complete',
      changed_by: completedBy,
      new_data: {
        previous_status: 'approved',
        new_status: 'completed',
        asset_updates: assetUpdates,
      },
    }, client);

    return transfersRepository.findTransferById(id, client);
  });
}

/**
 * Cancel transfer
 */
export async function cancelTransfer(id, cancelledBy, cancellationReason) {
  return withTransaction(async (client) => {
    const transferResult = await client.query(
      'SELECT * FROM transfers WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (!transferResult.rows[0]) {
      throw new AppError('NOT_FOUND', 'Transfer not found', 404);
    }

    const transfer = transferResult.rows[0];

    if (!['requested', 'approved'].includes(transfer.status)) {
      throw new AppError('INVALID_STATE_TRANSITION', 
        `Cannot cancel transfer in ${transfer.status} state`, 409);
    }

    await transfersRepository.updateTransfer(id, {
      status: 'cancelled',
      cancellation_reason: cancellationReason,
    }, client);

    await logAudit({
      table_name: 'transfers',
      record_id: id,
      action: 'cancel',
      changed_by: cancelledBy,
      new_data: {
        previous_status: transfer.status,
        new_status: 'cancelled',
        cancellation_reason: cancellationReason,
      },
    }, client);

    return transfersRepository.findTransferById(id, client);
  });
}
