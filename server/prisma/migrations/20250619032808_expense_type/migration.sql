-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "expense_item" ADD COLUMN     "expenseType" "ExpenseType" NOT NULL DEFAULT 'GENERAL';
