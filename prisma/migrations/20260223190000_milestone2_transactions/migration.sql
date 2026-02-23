-- Alter Transaction table for gateway integration
ALTER TABLE `Transaction`
    ADD COLUMN `externalId` VARCHAR(191) NOT NULL,
    ADD COLUMN `gatewayOrderId` VARCHAR(191) NOT NULL,
    ADD COLUMN `method` VARCHAR(191) NOT NULL,
    ADD COLUMN `fee` INTEGER NULL,
    ADD COLUMN `totalPayment` INTEGER NULL,
    ADD COLUMN `paymentNumber` TEXT NULL,
    ADD COLUMN `expiredAt` DATETIME(3) NULL,
    ADD COLUMN `paidAt` DATETIME(3) NULL,
    ADD COLUMN `gatewayStatus` VARCHAR(191) NULL,
    ADD COLUMN `gatewayCompletedAt` DATETIME(3) NULL,
    ADD COLUMN `gatewayRaw` JSON NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

CREATE UNIQUE INDEX `Transaction_gatewayOrderId_key` ON `Transaction`(`gatewayOrderId`);
CREATE INDEX `Transaction_externalId_idx` ON `Transaction`(`externalId`);

-- Create webhook delivery log table
CREATE TABLE `WebhookLog` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `transactionId` VARCHAR(191) NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `targetUrl` VARCHAR(191) NOT NULL,
    `requestBody` JSON NULL,
    `responseCode` INTEGER NULL,
    `responseBody` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WebhookLog_projectId_createdAt_idx`(`projectId`, `createdAt`),
    INDEX `WebhookLog_transactionId_idx`(`transactionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `WebhookLog` ADD CONSTRAINT `WebhookLog_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `WebhookLog` ADD CONSTRAINT `WebhookLog_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `Transaction`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
