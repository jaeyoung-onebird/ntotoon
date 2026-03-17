-- CreateTable
CREATE TABLE "qa_results" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "episode_id" TEXT,
    "overall" INTEGER NOT NULL,
    "character_consistency" INTEGER NOT NULL,
    "art_style" INTEGER NOT NULL,
    "no_text_in_images" INTEGER NOT NULL,
    "speech_bubbles" INTEGER NOT NULL,
    "story_flow" INTEGER NOT NULL,
    "background_quality" INTEGER NOT NULL,
    "issues" JSONB NOT NULL,
    "suggestions" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qa_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_improvements" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_improvements_pkey" PRIMARY KEY ("id")
);
