CREATE TABLE `syncStatus` (
	`id` text PRIMARY KEY DEFAULT '(lower(hex(randomblob(16))))' NOT NULL,
	`syncItem` text NOT NULL,
	`syncedAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `syncStatus_syncItem_unique` ON `syncStatus` (`syncItem`);