CREATE TABLE `ship_data_caches` (
	`cacheKey` varchar(64) NOT NULL,
	`payload` mediumtext NOT NULL,
	`source` varchar(24) NOT NULL,
	`notice` text,
	`syncedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ship_data_caches_cacheKey` PRIMARY KEY(`cacheKey`)
);
--> statement-breakpoint
CREATE TABLE `ship_push_subscriptions` (
	`deviceId` varchar(80) NOT NULL,
	`expoPushToken` varchar(255) NOT NULL,
	`favoriteShipIds` mediumtext NOT NULL,
	`statusSnapshot` mediumtext NOT NULL,
	`notificationsEnabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ship_push_subscriptions_deviceId` PRIMARY KEY(`deviceId`)
);
--> statement-breakpoint
CREATE TABLE `ship_sync_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`taskUid` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ship_sync_schedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `ship_sync_schedules_name_unique` UNIQUE(`name`),
	CONSTRAINT `ship_sync_schedules_taskUid_unique` UNIQUE(`taskUid`)
);
--> statement-breakpoint
CREATE INDEX `ship_push_subscriptions_enabled_idx` ON `ship_push_subscriptions` (`notificationsEnabled`);