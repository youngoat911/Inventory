import * as repository from './assets.repository.js';
import * as qrService from '../../shared/qr-token.service.js';
import { AppError } from '../../shared/app-error.js';
import { withTransaction } from '../../db/transaction.js';
import { assertValid as assertValidStatus } from '../status-master/status-master.service.js';
import { stringify } from 'csv-stringify/sync';
import { getDepreciation, getEffectiveDepRate, getFinancialYearEndYear } from '../../shared/depreciation.js';

function formatDate(value) {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

function enrichAssetDepreciation(asset) {
  if (!asset) return asset;
  const effectiveRate = getEffectiveDepRate(asset);
  const dep = getDepreciation(asset, getFinancialYearEndYear());
  return {
    ...asset,
    effective_dep_rate_percent: effectiveRate,
    accumulated_depreciation: dep.accumulated_depreciation,
    current_book_value: dep.closing_book_value,
  };
}

async function validateAssetCategory(categoryId, client) {
  const category = await repository.getCategoryForAsset(categoryId, client);
  if (!category) {
    throw new AppError('CATEGORY_NOT_FOUND', 'Category not found', 404);
  }
  if (category.is_legacy) {
    throw new AppError(
      'LEGACY_CATEGORY_FORBIDDEN',
      'Legacy categories cannot be assigned to assets; choose a hierarchical sub-category',
      400
    );
  }
  if (!category.level || category.level < 2) {
    throw new AppError(
      'CATEGORY_LEVEL_INVALID',
      'Assets must be assigned to a Level 2, 3, or 4 sub-category, not a Level 1 category',
      400
    );
  }
  if (!category.is_leaf) {
    throw new AppError(
      'NON_LEAF_CATEGORY',
      'Assets must be assigned to a leaf category with no sub-categories',
      400
    );
  }
}

export async function create(data) {
  // Validate category is an active leaf (Level 2-4)
  await validateAssetCategory(data.category_id);
  await assertValidStatus(data);

  // Validate unique constraints
  if (data.asset_tag) {
    const existing = await repository.getByAssetTag(data.asset_tag);
    if (existing) {
      throw new AppError('ASSET_TAG_EXISTS', 'Asset with this asset tag already exists', 409);
    }
  }

  if (data.serial_no) {
    const existing = await repository.getBySerialNo(data.serial_no);
    if (existing) {
      throw new AppError('SERIAL_NO_EXISTS', 'Asset with this serial number already exists', 409);
    }
  }

  // Validate tracking mode and quantity
  if (data.tracking === 'individual' && data.quantity !== 1) {
    throw new AppError('INVALID_QUANTITY', 'Individual tracked assets must have quantity of 1', 400);
  }

  if (!data.asset_tag) {
    data = { ...data, asset_tag: await repository.nextAssetTag(data.category_id) };
  }

  const created = await repository.create(data);
  return enrichAssetDepreciation(await repository.getById(created.id));
}

export async function batchCreate(assetsData) {
  return withTransaction(async (client) => {
    const created = [];
    const errors = [];

    for (let i = 0; i < assetsData.length; i++) {
      const assetData = assetsData[i];
      
      try {
        // Validate category is an active leaf (Level 2-4)
        await validateAssetCategory(assetData.category_id, client);
        await assertValidStatus(assetData, {}, client);

        // Validate unique constraints
        if (assetData.asset_tag) {
          const { rows } = await client.query(
            'SELECT id FROM assets WHERE asset_tag = $1',
            [assetData.asset_tag]
          );
          if (rows.length > 0) {
            throw new Error(`Asset tag '${assetData.asset_tag}' already exists`);
          }
        }

        if (assetData.serial_no) {
          const { rows } = await client.query(
            'SELECT id FROM assets WHERE serial_no = $1',
            [assetData.serial_no]
          );
          if (rows.length > 0) {
            throw new Error(`Serial number '${assetData.serial_no}' already exists`);
          }
        }

        // Validate tracking mode
        if (assetData.tracking === 'individual' && assetData.quantity !== 1) {
          throw new Error('Individual tracked assets must have quantity of 1');
        }

        const toInsert = assetData.asset_tag
          ? assetData
          : { ...assetData, asset_tag: await repository.nextAssetTag(assetData.category_id, client) };
        created.push(await repository.create(toInsert, client));
      } catch (error) {
        errors.push({
          index: i,
          asset: assetData,
          error: error.message
        });
      }
    }

    if (errors.length > 0) {
      throw new AppError('BATCH_CREATE_FAILED', 'Some assets failed to create', 400, errors);
    }

    return created;
  });
}

export async function getById(id) {
  const asset = await repository.getById(id);
  if (!asset) {
    throw new AppError('ASSET_NOT_FOUND', 'Asset not found', 404);
  }
  return enrichAssetDepreciation(asset);
}

export async function list(filters) {
  const offset = (filters.page - 1) * filters.limit;
  
  const processedFilters = {
    ...filters,
    offset,
  };

  const result = await repository.list(processedFilters);
  
  return {
    items: result.items.map(enrichAssetDepreciation),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: result.total,
      pages: Math.ceil(result.total / filters.limit),
    },
  };
}

export async function update(id, data) {
  // Check if asset exists
  const existing = await repository.getById(id);
  if (!existing) {
    throw new AppError('ASSET_NOT_FOUND', 'Asset not found', 404);
  }

  if (data.category_id && data.category_id !== existing.category_id) {
    await validateAssetCategory(data.category_id);
  }
  await assertValidStatus(data, existing);

  // Validate unique constraints if updating
  if (data.asset_tag && data.asset_tag !== existing.asset_tag) {
    const tagExists = await repository.getByAssetTag(data.asset_tag);
    if (tagExists) {
      throw new AppError('ASSET_TAG_EXISTS', 'Asset with this asset tag already exists', 409);
    }
  }

  if (data.serial_no && data.serial_no !== existing.serial_no) {
    const serialExists = await repository.getBySerialNo(data.serial_no);
    if (serialExists) {
      throw new AppError('SERIAL_NO_EXISTS', 'Asset with this serial number already exists', 409);
    }
  }

  // Validate tracking mode and quantity
  const tracking = data.tracking || existing.tracking;
  const quantity = data.quantity !== undefined ? data.quantity : existing.quantity;
  
  if (tracking === 'individual' && quantity !== 1) {
    throw new AppError('INVALID_QUANTITY', 'Individual tracked assets must have quantity of 1', 400);
  }

  await repository.update(id, data);
  return enrichAssetDepreciation(await repository.getById(id));
}

export async function deleteById(id) {
  // Check if asset exists
  const existing = await repository.getById(id);
  if (!existing) {
    throw new AppError('ASSET_NOT_FOUND', 'Asset not found', 404);
  }

  // Check if asset has active issues
  const hasIssues = await repository.hasActiveIssues(id);
  if (hasIssues) {
    throw new AppError('ASSET_HAS_ACTIVE_ISSUES', 'Cannot delete asset with active issues', 400);
  }

  // Check if asset has active transfers
  const hasTransfers = await repository.hasActiveTransfers(id);
  if (hasTransfers) {
    throw new AppError('ASSET_HAS_ACTIVE_TRANSFERS', 'Cannot delete asset with active transfers', 400);
  }

  return repository.deleteById(id);
}

export async function generateQRToken(assetId) {
  // Verify asset exists
  const asset = await repository.getById(assetId);
  if (!asset) {
    throw new AppError('ASSET_NOT_FOUND', 'Asset not found', 404);
  }

  // Generate QR token
  const token = await qrService.generateToken('asset', assetId);
  
  return {
    asset_id: assetId,
    qr_token: token,
    asset_name: asset.name,
  };
}

export async function resolveQRToken(qrToken) {
  // Resolve token
  const resolved = await qrService.resolveToken(qrToken);
  
  if (!resolved || resolved.entity_type !== 'asset') {
    throw new AppError('INVALID_QR_TOKEN', 'Invalid or expired QR token', 404);
  }

  // Get asset details
  const asset = await repository.getById(resolved.entity_id);
  if (!asset) {
    throw new AppError('ASSET_NOT_FOUND', 'Asset not found', 404);
  }

  return asset;
}

export async function exportAssets(filters) {
  const assets = await repository.exportAssets(filters);
  
  if (filters.format === 'csv') {
    // Convert to CSV
    const records = assets.map(asset => ({
      'Asset Tag': asset.asset_tag || '',
      'Name': asset.name,
      'Description': asset.description || '',
      'Category': asset.category_name || '',
      'Category Path': asset.category_path || asset.category_name || '',
      'Category Code': asset.category_code_path || '',
      'Tracking': asset.tracking,
      'Quantity': asset.quantity,
      'Low Stock Threshold': asset.low_stock_threshold,
      'Unit Cost': asset.unit_cost || '',
      'Serial Number': asset.serial_no || '',
      'Brand/Model': asset.brand_model || '',
      'Condition': asset.condition,
      'Status': asset.status,
      'Owner Organization': asset.owner_org_name || '',
      'Location': asset.location_name || '',
      'Responsible User': asset.responsible_user_name || '',
      'Can Be Loaned': asset.is_issuable ? 'Yes' : 'No',
      'Warranty Until': asset.warranty_until ? formatDate(asset.warranty_until) : '',
      'Is Institute Asset': asset.is_institute_asset ? 'Yes' : 'No',
      'Issued To': asset.issued_to || '',
      'Person In-charge': asset.incharge_name || '',
      'In-charge Phone': asset.incharge_phone || '',
      'Invoice No': asset.invoice_no || '',
      'Invoice Date': asset.invoice_date ? formatDate(asset.invoice_date) : '',
      'Budget Type': asset.budget_type || '',
      'Budget Head': asset.budget_head || '',
      'Cost': asset.cost ?? '',
      'Capitalization Date': asset.capitalization_date ? formatDate(asset.capitalization_date) : '',
      'Created At': asset.created_at,
      'Updated At': asset.updated_at,
    }));

    const csv = stringify(records, {
      header: true,
      quoted: true,
    });

    return csv;
  }

  // Return JSON
  return assets;
}
