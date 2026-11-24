-- Content sections (headings, text, images, videos, FAQs…) below a comparison's table.
ALTER TABLE "ComparisonPage" ADD COLUMN "sections" JSONB NOT NULL DEFAULT '[]';
