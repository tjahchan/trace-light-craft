ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE public.profiles ADD CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_]{3,20}$' OR username IS NULL);