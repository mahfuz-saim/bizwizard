-- Create a temporary array column with enum type
ALTER TABLE "users" ADD COLUMN "roles_temp" "UserRole"[] DEFAULT '{}';

-- Backfill: wrap old scalar into an array
UPDATE "users" SET "roles_temp" = ARRAY[role]::"UserRole"[];

-- Drop old scalar column
ALTER TABLE "users" DROP COLUMN "role";

-- Rename new column
ALTER TABLE "users" RENAME COLUMN "roles_temp" TO "role";
