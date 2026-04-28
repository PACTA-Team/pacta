-- Themis AI: default AI configuration keys
-- These keys are inserted on fresh installs; existing installs may already have them
INSERT OR IGNORE INTO system_settings (key, value, category) VALUES
  ('ai_provider', '', 'ai'),
  ('ai_api_key', '', 'ai'),
  ('ai_model', '', 'ai'),
  ('ai_endpoint', '', 'ai');
