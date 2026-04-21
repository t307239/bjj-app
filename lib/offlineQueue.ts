/**
 * lib/offlineQueue.ts — Offline action queue with online sync
 *
 * Q-137: UX pillar — queues user actions when offline and replays
 * them when connectivity is restored. Prevents data loss for
 * common operations (log training, update profile, etc.).
 *
 * Architecture:
 * - In-memory queue (no localStorage dependency)
 * - Event-based notifications for UI feedback
 * - Exponential backoff on sync failures
 * - Deduplication by action type + key
 *
 * @example
 *   import { OfflineQueue } from "@/lib/offlineQueue";
 *   const queue = new OfflineQueue();
 *   queue.enqueue({ type: "log_training", key: "draft-1", payload: {...} });
 *   queue.onSync((results) => toast(`Synced ${results.length} actions`));
 */

import { clientLogger } from "./clientLogger";

// ── Types ────────────────────────────────────────────────────────────────

export type QueuedActionType =
  | "log_training"
  | "update_profile"
  | "update_weight"
  | "add_technique"
  | "delete_record"
  | "update_settings";

export interface QueuedAction {
  /** Action type identifier */
  type: QueuedActionType;
  /** Deduplication key (e.g., record ID). Same type+key = replace */
  key: string;
  /** Serializable payload */
  payload: Record<string, unknown>;
  /** ISO timestamp when queued */
  queuedAt: string;
  /** Number of sync attempts */
  attempts: number;
  /** Last error message if sync failed */
  lastError?: string;
}

export interface SyncResult {
  action: QueuedAction;
  success: boolean;
  error?: string;
}

export type SyncHandler = (action: QueuedAction) => Promise<{ ok: boolean; error?: string }>;
export type SyncCallback = (results: SyncResult[]) => void;

// ── Constants ────────────────────────────────────────────────────────────

/** Maximum actions in the queue before oldest are dropped */
export const MAX_QUEUE_SIZE = 100;

/** Maximum sync attempts before an action is dropped */
export const MAX_ATTEMPTS = 5;

/** Base delay for exponential backoff (ms) */
export const BASE_RETRY_DELAY_MS = 1000;

// ── OfflineQueue Class ───────────────────────────────────────────────────

export class OfflineQueue {
  private queue: QueuedAction[] = [];
  private handlers: Map<QueuedActionType, SyncHandler> = new Map();
  private syncCallbacks: SyncCallback[] = [];
  private isSyncing = false;

  /**
   * Add an action to the queue.
   * If an action with the same type+key exists, it is replaced (dedup).
   */
  enqueue(action: Omit<QueuedAction, "queuedAt" | "attempts">): void {
    // Dedup: remove existing action with same type+key
    this.queue = this.queue.filter(
      (a) => !(a.type === action.type && a.key === action.key),
    );

    this.queue.push({
      ...action,
      queuedAt: new Date().toISOString(),
      attempts: 0,
    });

    // Enforce max queue size (drop oldest)
    if (this.queue.length > MAX_QUEUE_SIZE) {
      this.queue = this.queue.slice(-MAX_QUEUE_SIZE);
    }
  }

  /**
   * Register a handler for a specific action type.
   * The handler is called during sync to replay the action.
   */
  registerHandler(type: QueuedActionType, handler: SyncHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Register a callback that fires after each sync attempt.
   */
  onSync(callback: SyncCallback): () => void {
    this.syncCallbacks.push(callback);
    return () => {
      this.syncCallbacks = this.syncCallbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * Attempt to sync all queued actions.
   * Processes in FIFO order. Failed actions remain in queue
   * (up to MAX_ATTEMPTS).
   */
  async flush(): Promise<SyncResult[]> {
    if (this.isSyncing || this.queue.length === 0) {
      return [];
    }

    this.isSyncing = true;
    const results: SyncResult[] = [];
    const remaining: QueuedAction[] = [];

    for (const action of this.queue) {
      const handler = this.handlers.get(action.type);
      if (!handler) {
        // No handler registered — keep in queue
        remaining.push(action);
        continue;
      }

      try {
        const result = await handler(action);
        if (result.ok) {
          results.push({ action, success: true });
        } else {
          action.attempts += 1;
          action.lastError = result.error;
          if (action.attempts < MAX_ATTEMPTS) {
            remaining.push(action);
          }
          results.push({ action, success: false, error: result.error });
        }
      } catch (err) {
        action.attempts += 1;
        action.lastError = err instanceof Error ? err.message : "Unknown error";
        if (action.attempts < MAX_ATTEMPTS) {
          remaining.push(action);
        }
        results.push({ action, success: false, error: action.lastError });
      }
    }

    this.queue = remaining;
    this.isSyncing = false;

    // Notify listeners
    for (const cb of this.syncCallbacks) {
      try {
        cb(results);
      } catch (err: unknown) {
        clientLogger.warn("offline_queue.sync_callback_error", { error: err instanceof Error ? err.message : String(err) });
      }
    }

    return results;
  }

  /**
   * Get the current queue snapshot (read-only).
   */
  getQueue(): readonly QueuedAction[] {
    return [...this.queue];
  }

  /**
   * Get the number of pending actions.
   */
  get size(): number {
    return this.queue.length;
  }

  /**
   * Check if there are any pending actions.
   */
  get hasPending(): boolean {
    return this.queue.length > 0;
  }

  /**
   * Clear all queued actions.
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * Remove a specific action by type+key.
   */
  remove(type: QueuedActionType, key: string): boolean {
    const before = this.queue.length;
    this.queue = this.queue.filter(
      (a) => !(a.type === type && a.key === key),
    );
    return this.queue.length < before;
  }

  /**
   * Get retry delay for an action using exponential backoff.
   */
  static getRetryDelay(attempts: number): number {
    return BASE_RETRY_DELAY_MS * Math.pow(2, Math.min(attempts, 4));
  }
}
