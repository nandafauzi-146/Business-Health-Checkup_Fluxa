-- 0001_extensions.sql
-- Extension pgcrypto untuk gen_random_uuid() dan fungsi kriptografi
create extension if not exists "pgcrypto";
