import { addCell, addToTransactionQueue } from '../lib/db';
import { Cell } from '../types/game';

// This script can be used to migrate existing data to the database
// You can modify this to import data from any existing source

const migrateData = () => {
  // Example: Migrate some test cells
  const testCells: Cell[] = [
    { x: 0, y: 0, energy: 1 },
    { x: 1, y: 1, energy: 2 },
  ];

  testCells.forEach(cell => {
    addCell(cell);
    addToTransactionQueue(cell);
  });

  console.log('Migration completed successfully');
};

migrateData();
