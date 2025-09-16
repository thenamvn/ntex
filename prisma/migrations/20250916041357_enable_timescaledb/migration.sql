-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- CreateTable
CREATE TABLE "public"."DeviceData" (
    "id" SERIAL NOT NULL,
    "device_id" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "acceleration" DOUBLE PRECISION[],
    "battery" INTEGER NOT NULL,
    "audio_segment" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceData_pkey" PRIMARY KEY ("id","timestamp")
);
SELECT create_hypertable('"DeviceData"', 'timestamp', if_not_exists => TRUE);



