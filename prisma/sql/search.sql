-- Search document builder. Appended to the initial migration by
-- scripts/create-initial-migration.mjs (npm run db:init). Indexes are declared in schema.prisma.
-- Requires the pg_trgm and unaccent extensions (also declared there).

-- Weighted document for one software row:
--   A name · B tagline, vendor, brand · C short description, tags, categories · D long description
CREATE OR REPLACE FUNCTION refresh_software_search(sid text) RETURNS void
LANGUAGE sql AS $$
  UPDATE "Software" s SET "searchVector" =
      setweight(to_tsvector('simple', unaccent(coalesce(s."name", ''))), 'A')
    || setweight(to_tsvector('simple', unaccent(coalesce(s."tagline", '') || ' ' || coalesce(v."name", '') || ' ' || coalesce(b."name", ''))), 'B')
    || setweight(to_tsvector('simple', unaccent(coalesce(s."shortDescription", '') || ' ' || coalesce(t.names, '') || ' ' || coalesce(c.names, ''))), 'C')
    || setweight(to_tsvector('simple', unaccent(regexp_replace(coalesce(s."description", ''), '<[^>]+>', ' ', 'g'))), 'D')
  FROM "Software" s2
  LEFT JOIN "Vendor" v ON v."id" = s2."vendorId"
  LEFT JOIN "Brand" b ON b."id" = s2."brandId"
  LEFT JOIN LATERAL (
    SELECT string_agg(tg."name", ' ') AS names FROM "SoftwareTag" st JOIN "Tag" tg ON tg."id" = st."tagId" WHERE st."softwareId" = s2."id"
  ) t ON true
  LEFT JOIN LATERAL (
    SELECT string_agg(ct."name", ' ') AS names FROM "SoftwareCategory" sc JOIN "Category" ct ON ct."id" = sc."categoryId" WHERE sc."softwareId" = s2."id"
  ) c ON true
  WHERE s."id" = sid AND s2."id" = sid;
$$;
