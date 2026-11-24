-- "List your software" requests are stored as leads with this source.
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'LIST_SOFTWARE';
