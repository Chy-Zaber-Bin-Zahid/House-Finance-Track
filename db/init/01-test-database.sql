-- Runs once, the first time the volume is initialised.
-- The suite truncates every table between files, so it needs a database of its
-- own rather than the one holding development data.
CREATE DATABASE house_test;
