-- CreateTable
CREATE TABLE "Certificate" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SerialCounter" (
    "id" SERIAL NOT NULL,
    "prefix" TEXT NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "SerialCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SerialCounter_prefix_key" ON "SerialCounter"("prefix");
