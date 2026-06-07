-- AlterTable
ALTER TABLE "users" ADD COLUMN     "search_vector" tsvector;

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");
