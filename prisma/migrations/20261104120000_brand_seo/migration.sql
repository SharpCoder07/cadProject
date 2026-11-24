-- SEO settings for brand pages
ALTER TABLE "Brand" ADD COLUMN "seoId" TEXT;
CREATE UNIQUE INDEX "Brand_seoId_key" ON "Brand"("seoId");
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_seoId_fkey" FOREIGN KEY ("seoId") REFERENCES "SeoMeta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
