-- CreateTable
CREATE TABLE "forgetRequest" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "userID" TEXT NOT NULL,
    "OTP" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forgetRequest_pkey" PRIMARY KEY ("id")
);
