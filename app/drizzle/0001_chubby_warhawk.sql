CREATE TABLE `lots` (
	`id` text PRIMARY KEY DEFAULT '(lower(hex(randomblob(16))))' NOT NULL,
	`stock` integer NOT NULL,
	`mrp` real NOT NULL,
	`isMRPDefault` integer DEFAULT false NOT NULL,
	`retail` real NOT NULL,
	`includeVAT` integer DEFAULT false NOT NULL,
	`buyPrice` real NOT NULL,
	`sellPrice` real NOT NULL,
	`vat` real,
	`mfgDate` text,
	`expDate` text,
	`locationAtStore` text,
	`note` text,
	`shopVariantId` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
