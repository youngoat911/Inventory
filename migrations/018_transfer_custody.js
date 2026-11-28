/** @param {import('node-pg-migrate').MigrationBuilder} pgm */

// Issue-management transfers: hand an item over from one issued-to party /
// person in-charge to another. from_* columns snapshot the asset at request time.
const COLUMNS = [
  'from_issued_to', 'to_issued_to',
  'from_incharge_name', 'to_incharge_name',
  'from_incharge_phone', 'to_incharge_phone',
];

export const up = (pgm) => {
  pgm.addColumns('transfers', Object.fromEntries(COLUMNS.map((c) => [c, { type: 'text' }])));
};

export const down = (pgm) => {
  pgm.dropColumns('transfers', COLUMNS);
};
