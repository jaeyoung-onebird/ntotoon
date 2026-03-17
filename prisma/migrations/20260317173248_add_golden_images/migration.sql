-- CreateTable
CREATE TABLE "golden_images" (
    "id" TEXT NOT NULL,
    "panel_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "qa_score" INTEGER NOT NULL,
    "style_score" INTEGER NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'panel',
    "tags" JSONB,
    "used_for_lora" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "golden_images_pkey" PRIMARY KEY ("id")
);
