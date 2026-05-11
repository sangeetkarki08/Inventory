// =============================================================================
//  lib/offline — public surface
//  Import from '@/lib/offline' to get the offline layer's hooks + repo.
// =============================================================================

export { repo } from './repository';
export { outbox, type OutboxEntry } from './queue';
export { syncManager, type SyncState, type SyncPhase } from './sync';
export {
  useSyncState,
  useOfflineTable,
  usePendingCount,
} from './hooks';
export { OfflineProvider } from './offline-provider';
export {
  offlineCreate,
  offlineUpdate,
  offlineDelete,
} from './offline-actions';
export { idb } from './db';
export { SYNCED_STORES, WRITABLE_STORES, type StoreName } from './schema';
