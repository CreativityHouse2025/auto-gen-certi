-- CreateTable
CREATE TABLE "Certificate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "url" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SerialCounter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "prefix" TEXT NOT NULL,
    "count" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "SerialCounter_prefix_key" ON "SerialCounter"("prefix");
