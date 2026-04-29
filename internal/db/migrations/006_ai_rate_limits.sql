-- ai_rate_limits: daily request counters per company (shared across cluster)
CREATE TABLE IF NOT EXISTS ai_rate_limits (
  company_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  PRIMARY KEY (company_id, date),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_rate_limits_date ON ai_rate_limits(date);
