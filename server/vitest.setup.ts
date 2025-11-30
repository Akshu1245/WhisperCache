/**
 * Vitest Global Setup
 * 
 * Initializes the database before all tests run
 * This runs in each test file's worker process
 */

import { beforeAll } from 'vitest';
import { initDatabase } from './src/lib/database';

// Initialize database before each test file
beforeAll(() => {
  console.log('[Test Setup] Initializing database...');
  initDatabase();
  console.log('[Test Setup] Database initialized');
});
