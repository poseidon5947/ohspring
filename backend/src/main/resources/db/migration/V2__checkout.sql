CREATE TABLE checkout_attempts (reference VARCHAR(180) PRIMARY KEY, invoice_id VARCHAR(36) NOT NULL REFERENCES records(id), provider VARCHAR(20) NOT NULL, created_at VARCHAR(40) NOT NULL);
