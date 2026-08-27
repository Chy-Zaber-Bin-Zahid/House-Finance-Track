-- A tenancy whose end precedes its start collapses to an `empty` daterange.
-- Empty overlaps nothing, so the exclusion constraint accepts it, and then no
-- screen can read the row back. Refuse it at the storage layer too, so the
-- application guard is a better error rather than the only thing standing here.
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_period_not_empty" CHECK (NOT isempty("period"));
