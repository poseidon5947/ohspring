CREATE TABLE users (id VARCHAR(36) PRIMARY KEY, email VARCHAR(254) NOT NULL UNIQUE, password VARCHAR(255) NOT NULL, name VARCHAR(120) NOT NULL, role VARCHAR(20) NOT NULL CHECK (role IN ('CUSTOMER','EMPLOYEE','ADMIN')), department VARCHAR(120) NOT NULL DEFAULT '', position VARCHAR(120) NOT NULL DEFAULT '', crm_access BOOLEAN NOT NULL DEFAULT FALSE);
CREATE TABLE records (id VARCHAR(36) PRIMARY KEY, module VARCHAR(30) NOT NULL, owner_id VARCHAR(36) REFERENCES users(id), assignee_id VARCHAR(36) REFERENCES users(id), payload TEXT NOT NULL, created_at VARCHAR(40) NOT NULL, updated_at VARCHAR(40) NOT NULL);
CREATE INDEX records_module_owner ON records(module,owner_id);
CREATE INDEX records_module_assignee ON records(module,assignee_id);
CREATE TABLE attachments (id VARCHAR(36) PRIMARY KEY, ticket_id VARCHAR(36) NOT NULL REFERENCES records(id), name VARCHAR(200) NOT NULL, media_type VARCHAR(120) NOT NULL, content TEXT NOT NULL);
CREATE TABLE payments (reference VARCHAR(180) PRIMARY KEY, invoice_id VARCHAR(36) NOT NULL REFERENCES records(id), created_at VARCHAR(40) NOT NULL);
