-- Webhook log attempt tracking
ALTER TABLE `WebhookLog`
  ADD COLUMN `attemptNo` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `isSuccess` BOOLEAN NOT NULL DEFAULT false;

-- Idempotency keys table
CREATE TABLE `IdempotencyKey` (
  `id` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `key` VARCHAR(191) NOT NULL,
  `requestHash` VARCHAR(191) NOT NULL,
  `responseStatus` INTEGER NULL,
  `responseBody` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `IdempotencyKey_projectId_key_key`(`projectId`, `key`),
  INDEX `IdempotencyKey_projectId_createdAt_idx`(`projectId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `IdempotencyKey` ADD CONSTRAINT `IdempotencyKey_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Rate limit windows table
CREATE TABLE `RateLimitWindow` (
  `id` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `routeKey` VARCHAR(191) NOT NULL,
  `windowStart` DATETIME(3) NOT NULL,
  `count` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `RateLimitWindow_projectId_routeKey_windowStart_key`(`projectId`, `routeKey`, `windowStart`),
  INDEX `RateLimitWindow_projectId_createdAt_idx`(`projectId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `RateLimitWindow` ADD CONSTRAINT `RateLimitWindow_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
