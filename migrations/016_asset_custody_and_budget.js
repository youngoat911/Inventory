/** @param {import('node-pg-migrate').MigrationBuilder} pgm */

export const BUDGET_TYPES = ['institute', 'r_and_d', 'sponsored', 'donation'];

export const up = (pgm) => {
  const budgetCheck = `budget_type IS NULL OR budget_type IN (${BUDGET_TYPES.map((t) => `'${t}'`).join(', ')})`;

  pgm.addColumns('assets', {
    issued_to: { type: 'text', comment: 'Person, lab or department the item is issued to' },
    incharge_name: { type: 'text', comment: 'Person in-charge of the item' },
    incharge_phone: { type: 'text', comment: 'Contact number of the person in-charge' },
    invoice_no: { type: 'text' },
    invoice_date: { type: 'date' },
    budget_type: { type: 'text' },
    budget_head: { type: 'text', comment: 'Budget head / project / sponsor / donor name' },
  });
  pgm.addConstraint('assets', 'assets_budget_type_chk', { check: budgetCheck });
  pgm.createIndex('assets', 'budget_type');

  pgm.addColumns('purchases', {
    budget_type: { type: 'text' },
    budget_head: { type: 'text' },
  });
  pgm.addConstraint('purchases', 'purchases_budget_type_chk', { check: budgetCheck });
};

export const down = (pgm) => {
  pgm.dropConstraint('purchases', 'purchases_budget_type_chk', { ifExists: true });
  pgm.dropColumns('purchases', ['budget_type', 'budget_head']);
  pgm.dropConstraint('assets', 'assets_budget_type_chk', { ifExists: true });
  pgm.dropIndex('assets', 'budget_type', { ifExists: true });
  pgm.dropColumns('assets', [
    'issued_to', 'incharge_name', 'incharge_phone', 'invoice_no', 'invoice_date', 'budget_type', 'budget_head',
  ]);
};
