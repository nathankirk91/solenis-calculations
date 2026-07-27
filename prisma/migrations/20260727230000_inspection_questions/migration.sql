-- CreateEnum
CREATE TYPE "inspection_question_type" AS ENUM ('YES_NO', 'TEXT', 'RADIO');

-- AlterTable
ALTER TABLE "inspections" ADD COLUMN IF NOT EXISTS "equipment_label" TEXT;
ALTER TABLE "inspections" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "inspections" ALTER COLUMN "description" SET DEFAULT '';
ALTER TABLE "inspections" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "inspection_questions" (
    "id" TEXT NOT NULL,
    "inspection_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "help_text" TEXT,
    "section_title" TEXT,
    "type" "inspection_question_type" NOT NULL,
    "options" JSONB,
    "attention_values" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inspection_questions_inspection_id_is_active_sort_order_idx" ON "inspection_questions"("inspection_id", "is_active", "sort_order");

-- AddForeignKey
ALTER TABLE "inspection_questions" ADD CONSTRAINT "inspection_questions_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
