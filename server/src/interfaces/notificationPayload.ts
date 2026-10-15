export type SyncEntityType = 'PRODUCT' | 'VARIANT' | 'LOT';
export type SyncOperation = 'UPDATE' | 'DELETE';

export interface SyncTriggerPayload {
    /**
     * Entity type: inventory, product, or lot
     */
    entity: SyncEntityType;

    /**
     * The unique ID of the affected entity (in your backend DB).
     * For Inventory id = barcode
     */
    id: string;

    /**
     * The type of operation that occurred
     */
    operation: SyncOperation;

    /**
     * Timestamp (ISO 8601) of when the change occurred in the backend
     * Used to compare against app's lastSyncedAt
     */
    updatedAt: string;

    /**
     * The shop ID that owns this record.
     * Used to filter triggers relevant to this device/shop only
     */
    shopId?: string;

    /**
     * Version number or sync sequence (optional but recommended)
     * Helps resolve race conditions and out-of-order messages
     */
    version?: number;

    /**
     * Optional metadata about who or what triggered the change
     * (useful for avoiding redundant updates on same device)
     */
    triggeredBy?: {
        userId: string;
        deviceId?: string;
    };

    /**
     * Whether this update was a cascade (e.g. inventory delete cascades product/lot)
     */
    cascade?: boolean;

    /**
     * Optional debug or additional context (non-critical)
     */
    meta?: Record<string, any>;
}
