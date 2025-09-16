/*
  Warnings:

  - Added the required column `dock_id` to the `DeviceData` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."DeviceData_timestamp_idx";

-- AlterTable
ALTER TABLE "public"."DeviceData" ADD COLUMN     "dock_id" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "public"."UserDevice" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "dock_id" TEXT,
    "fcm_token" TEXT,
    "device_name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Alert" (
    "id" SERIAL NOT NULL,
    "device_id" TEXT NOT NULL,
    "alert_type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "is_sent" BOOLEAN NOT NULL DEFAULT false,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserDevice_device_id_idx" ON "public"."UserDevice"("device_id");

-- CreateIndex
CREATE INDEX "UserDevice_dock_id_idx" ON "public"."UserDevice"("dock_id");

-- CreateIndex
CREATE UNIQUE INDEX "UserDevice_user_id_device_id_key" ON "public"."UserDevice"("user_id", "device_id");

-- CreateIndex
CREATE INDEX "Alert_device_id_timestamp_idx" ON "public"."Alert"("device_id", "timestamp");
