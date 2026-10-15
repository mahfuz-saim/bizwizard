CREATE TABLE `sync_checkpoint` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shopId` text NOT NULL,
	`entity` text NOT NULL,
	`currentPage` integer DEFAULT 0 NOT NULL,
	`pageSize` integer NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_checkpoint_shopId_entity_unique` ON `sync_checkpoint` (`shopId`,`entity`);
