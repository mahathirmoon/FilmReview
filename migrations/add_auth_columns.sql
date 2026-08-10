-- Ensure the Users table has authentication columns used by the auth flow
ALTER TABLE Users
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS session_token VARCHAR(255) NULL;
