/*
  Warnings:

  - You are about to drop the `Employee` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Employee" DROP CONSTRAINT "Employee_shopID_fkey";

-- DropForeignKey
ALTER TABLE "Employee" DROP CONSTRAINT "Employee_userID_fkey";

-- DropTable
DROP TABLE "Employee";

-- CreateTable
CREATE TABLE "employee" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "userID" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_employee" (
    "employeeID" TEXT NOT NULL,
    "shopID" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_number_key" ON "employee"("number");

-- CreateIndex
CREATE UNIQUE INDEX "employee_userID_key" ON "employee"("userID");

-- CreateIndex
CREATE UNIQUE INDEX "shop_employee_employeeID_shopID_key" ON "shop_employee"("employeeID", "shopID");

-- AddForeignKey
ALTER TABLE "employee" ADD CONSTRAINT "employee_userID_fkey" FOREIGN KEY ("userID") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_employee" ADD CONSTRAINT "shop_employee_employeeID_fkey" FOREIGN KEY ("employeeID") REFERENCES "employee"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_employee" ADD CONSTRAINT "shop_employee_shopID_fkey" FOREIGN KEY ("shopID") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
