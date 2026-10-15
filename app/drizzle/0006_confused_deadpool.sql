PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_syncStatus` (
	`id` integer PRIMARY KEY NOT NULL,
	`syncItem` text NOT NULL,
	`syncedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`syncStatus` text DEFAULT 'PENDING' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_syncStatus`("id", "syncItem", "syncedAt", "syncStatus") SELECT "id", "syncItem", "syncedAt", "syncStatus" FROM `syncStatus`;--> statement-breakpoint
DROP TABLE `syncStatus`;--> statement-breakpoint
ALTER TABLE `__new_syncStatus` RENAME TO `syncStatus`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `syncStatus_syncItem_unique` ON `syncStatus` (`syncItem`);