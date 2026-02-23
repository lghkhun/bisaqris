-- AlterTable
ALTER TABLE `Project` ADD COLUMN `logoUrl` VARCHAR(191) NULL,
    ADD COLUMN `payoutAccountName` VARCHAR(191) NULL,
    ADD COLUMN `payoutAccountNumber` VARCHAR(191) NULL,
    ADD COLUMN `payoutBankName` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Transaction` ALTER COLUMN `amount` DROP DEFAULT,
    ALTER COLUMN `updatedAt` DROP DEFAULT;
