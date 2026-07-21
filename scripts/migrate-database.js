#!/usr/bin/env node
import { createPostgresOwnerOpsStore } from '../packages/storage/src/postgres.js';

const { store, close } = await createPostgresOwnerOpsStore();

try {
  const result = await store.migrate();
  console.log(`OwnerOps database migrated to version ${result.currentVersion}.`);
} finally {
  await close();
}
