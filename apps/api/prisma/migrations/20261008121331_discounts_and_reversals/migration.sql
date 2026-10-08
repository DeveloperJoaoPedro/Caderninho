/*
  Warnings:

  - Added the required column `catalogCents` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subtotalCents` to the `Sale` table without a default value. This is not possible if the table is not empty.
  - Added the required column `revenueCents` to the `SaleItem` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "catalogCents" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "discountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "SaleStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "subtotalCents" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "revenueCents" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "UserBrand" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "brand" "Brand" NOT NULL,
    "discountBps" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBrand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptReversal" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "receiptId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "reversedOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptReversal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserBrand_userId_brand_key" ON "UserBrand"("userId", "brand");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptReversal_receiptId_key" ON "ReceiptReversal"("receiptId");

-- CreateIndex
CREATE INDEX "ReceiptReversal_userId_reversedOn_idx" ON "ReceiptReversal"("userId", "reversedOn");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptReversal_userId_receiptId_key" ON "ReceiptReversal"("userId", "receiptId");

-- AddForeignKey
ALTER TABLE "UserBrand" ADD CONSTRAINT "UserBrand_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptReversal" ADD CONSTRAINT "ReceiptReversal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptReversal" ADD CONSTRAINT "ReceiptReversal_userId_receiptId_fkey" FOREIGN KEY ("userId", "receiptId") REFERENCES "Receipt"("userId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
