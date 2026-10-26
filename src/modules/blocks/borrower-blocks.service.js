// src/modules/borrower-blocks/borrower-blocks.service.js
import * as borrowerBlocksRepository from './borrower-blocks.repository.js';

export async function createBorrowerBlock(blockData) {
  return borrowerBlocksRepository.createBorrowerBlock(blockData);
}

export async function listBorrowerBlocks({ filters }) {
  return borrowerBlocksRepository.listBorrowerBlocks({ filters });
}

export async function getActiveBlocksForUser(userId) {
  return borrowerBlocksRepository.getActiveBlocksForUser(userId);
}

export async function getBlockById(id) {
  return borrowerBlocksRepository.getBlockById(id);
}

export async function updateBorrowerBlock(id, fields) {
  return borrowerBlocksRepository.updateBorrowerBlock(id, fields);
}

export async function deleteBorrowerBlock(id) {
  return borrowerBlocksRepository.deleteBorrowerBlock(id);
}