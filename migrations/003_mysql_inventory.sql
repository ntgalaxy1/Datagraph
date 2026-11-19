CREATE TABLE IF NOT EXISTS dg_meta (
  meta_key VARCHAR(100) PRIMARY KEY,
  value_json LONGTEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS dg_products (
  product_id VARCHAR(191) PRIMARY KEY,
  natural_key CHAR(64) NOT NULL UNIQUE,
  kind ENUM('part','laptop') NOT NULL,
  category_key VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  specs TEXT NOT NULL,
  price DECIMAL(18,0) NULL,
  initial_price DECIMAL(18,0) NULL,
  previous_price DECIMAL(18,0) NULL,
  stock INT UNSIGNED NULL,
  revision BIGINT UNSIGNED NOT NULL DEFAULT 1,
  payload_json LONGTEXT NOT NULL,
  sheet_hash CHAR(64) NULL,
  dirty TINYINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  INDEX idx_category(kind,category_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS dg_price_audit (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(191) NOT NULL,
  old_price DECIMAL(18,0) NULL,
  new_price DECIMAL(18,0) NULL,
  source VARCHAR(30) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_product(product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
