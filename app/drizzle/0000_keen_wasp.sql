CREATE TABLE `inventory` (
	`id` text PRIMARY KEY DEFAULT '(lower(hex(randomblob(16))))' NOT NULL,
	`productName` text NOT NULL,
	`barcode` text NOT NULL,
	`measuringUnit` text NOT NULL,
	`image` text,
	`category` text DEFAULT 'OTHER' NOT NULL,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`isPrivate` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_barcode_unique` ON `inventory` (`barcode`);--> statement-breakpoint
CREATE TABLE `shop` (
	`id` text PRIMARY KEY DEFAULT '(lower(hex(randomblob(16))))' NOT NULL,
	`shopName` text,
	`contact` text,
	`tradeLicense` text,
	`category` text,
	`shopCode` text,
	`ownerID` text,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shop_variants` (
	`id` text PRIMARY KEY DEFAULT '(lower(hex(randomblob(16))))' NOT NULL,
	`productID` text,
	`name` text,
	`variantName` text,
	`variantCode` text,
	`packOf` integer,
	`shopID` text NOT NULL,
	`lowStock` integer,
	`lowStockSMS` integer,
	`lastSoldDate` text,
	`notifyAfterNotSold` integer,
	`notifyAt` text,
	`notSoldSMS` integer,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`totalProducts` integer DEFAULT 0 NOT NULL
);
