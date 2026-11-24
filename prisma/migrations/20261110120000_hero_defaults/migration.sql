-- Fill the Search hero block's empty Heading with the standard headline and
-- replace the old hidden search label "I need software for".
UPDATE "PageSection"
SET "data" = jsonb_set(COALESCE("data"::jsonb, '{}'::jsonb), '{heading}', '"Discover, compare and buy the right software for your business"')
WHERE "type" = 'HERO' AND COALESCE(TRIM("data"::jsonb->>'heading'), '') = '';

UPDATE "PageSection"
SET "data" = jsonb_set("data"::jsonb, '{lead}', '"Search software, categories or brands"')
WHERE "type" = 'HERO' AND ("data"::jsonb->>'lead' = 'I need software for' OR COALESCE(TRIM("data"::jsonb->>'lead'), '') = '');

UPDATE "ReusableBlock"
SET "data" = jsonb_set("data"::jsonb, '{heading}', '"Discover, compare and buy the right software for your business"')
WHERE "type" = 'HERO' AND COALESCE(TRIM("data"::jsonb->>'heading'), '') = '';

UPDATE "ReusableBlock"
SET "data" = jsonb_set("data"::jsonb, '{lead}', '"Search software, categories or brands"')
WHERE "type" = 'HERO' AND ("data"::jsonb->>'lead' = 'I need software for' OR COALESCE(TRIM("data"::jsonb->>'lead'), '') = '');
