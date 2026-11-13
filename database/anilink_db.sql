CREATE DATABASE IF NOT EXISTS anilink_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE anilink_db;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(60) NOT NULL DEFAULT '',
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  address VARCHAR(120) NOT NULL,
  role ENUM('farmer', 'buyer', 'admin') NOT NULL,
  account_type VARCHAR(60) NOT NULL DEFAULT 'Regular Account',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_username (username),
  KEY idx_users_role_active (role, is_active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  farmer_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(12,2) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  harvest_date DATE NOT NULL,
  location VARCHAR(120) NOT NULL,
  image_path VARCHAR(255) DEFAULT NULL,
  status ENUM('active', 'inactive', 'removed') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_products_browse (status, category, location, price),
  KEY idx_products_farmer (farmer_id, status),
  CONSTRAINT fk_products_farmer FOREIGN KEY (farmer_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_products_quantity CHECK (quantity > 0),
  CONSTRAINT chk_products_price CHECK (price > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inquiries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  buyer_id BIGINT UNSIGNED NOT NULL,
  farmer_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  subject VARCHAR(150) NOT NULL DEFAULT '',
  message VARCHAR(1000) NOT NULL,
  requested_quantity DECIMAL(12,2) DEFAULT NULL,
  status ENUM('Pending', 'Responded', 'Accepted', 'Declined', 'Closed') NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inquiries_buyer (buyer_id, created_at),
  KEY idx_inquiries_farmer (farmer_id, status, created_at),
  KEY idx_inquiries_product (product_id),
  CONSTRAINT fk_inquiries_buyer FOREIGN KEY (buyer_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_inquiries_farmer FOREIGN KEY (farmer_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_inquiries_product FOREIGN KEY (product_id) REFERENCES products (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_inquiries_quantity CHECK (requested_quantity IS NULL OR requested_quantity > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS conversations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  inquiry_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_conversations_inquiry (inquiry_id),
  KEY idx_conversations_updated (updated_at),
  CONSTRAINT fk_conversations_inquiry FOREIGN KEY (inquiry_id) REFERENCES inquiries (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id BIGINT UNSIGNED NOT NULL,
  sender_id BIGINT UNSIGNED NOT NULL,
  receiver_id BIGINT UNSIGNED NOT NULL,
  message_content VARCHAR(2000) NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_messages_conversation (conversation_id, id),
  KEY idx_messages_receiver_unread (receiver_id, is_read, conversation_id),
  KEY idx_messages_sender_recent (sender_id, created_at),
  CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_messages_receiver FOREIGN KEY (receiver_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  conversation_id BIGINT UNSIGNED DEFAULT NULL,
  inquiry_id BIGINT UNSIGNED DEFAULT NULL,
  type ENUM('inquiry', 'message', 'status') NOT NULL,
  content VARCHAR(255) NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_user_unread (user_id, is_read, created_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_notifications_conversation FOREIGN KEY (conversation_id) REFERENCES conversations (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_notifications_inquiry FOREIGN KEY (inquiry_id) REFERENCES inquiries (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS market_prices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_name VARCHAR(120) NOT NULL,
  category VARCHAR(80) NOT NULL,
  market_location VARCHAR(120) NOT NULL,
  price_per_unit DECIMAL(12,2) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  source VARCHAR(190) NOT NULL,
  date_recorded DATE NOT NULL,
  is_sample TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_market_prices_search (category, market_location, date_recorded),
  KEY idx_market_prices_product_date (product_name, date_recorded),
  CONSTRAINT chk_market_prices_price CHECK (price_per_unit > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id BIGINT UNSIGNED DEFAULT NULL,
  action VARCHAR(80) NOT NULL,
  details VARCHAR(1000) NOT NULL DEFAULT '',
  ip_address VARCHAR(45) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_activity_logs_created (created_at),
  KEY idx_activity_logs_actor (actor_id, created_at),
  CONSTRAINT fk_activity_logs_actor FOREIGN KEY (actor_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reporter_id BIGINT UNSIGNED NOT NULL,
  reported_user_id BIGINT UNSIGNED DEFAULT NULL,
  product_id BIGINT UNSIGNED DEFAULT NULL,
  title VARCHAR(150) NOT NULL,
  category VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  status ENUM('Pending', 'Under Review', 'Resolved', 'Dismissed') NOT NULL DEFAULT 'Pending',
  admin_notes TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_reports_status (status, created_at),
  KEY idx_reports_reporter (reporter_id, created_at),
  CONSTRAINT fk_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_reports_reported_user FOREIGN KEY (reported_user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_reports_product FOREIGN KEY (product_id) REFERENCES products (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS announcements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(150) NOT NULL,
  content TEXT NOT NULL,
  featured_image VARCHAR(255) DEFAULT NULL,
  category VARCHAR(80) NOT NULL,
  audience ENUM('All Users', 'Farmers Only', 'Buyers Only') NOT NULL DEFAULT 'All Users',
  publish_status ENUM('Draft', 'Published', 'Archived') NOT NULL DEFAULT 'Draft',
  published_at TIMESTAMP NULL DEFAULT NULL,
  expires_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_announcements_status (publish_status, published_at),
  KEY idx_announcements_admin (admin_id, created_at),
  CONSTRAINT fk_announcements_admin FOREIGN KEY (admin_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Clearly labeled illustration records copied from the original mock UI. These are not verified prices.
INSERT INTO market_prices
  (product_name, category, market_location, price_per_unit, unit, source, date_recorded, is_sample)
VALUES
  ('Rice (regular milled)', 'Grains', 'Boac', 49.00, 'kg', 'Illustrative sample — not verified', '2026-11-05', 1),
  ('Coconut (young)', 'Coconut', 'Gasan', 20.00, 'piece', 'Illustrative sample — not verified', '2026-11-05', 1),
  ('Carabao mango', 'Fruit', 'Gasan', 110.00, 'kg', 'Illustrative sample — not verified', '2026-11-04', 1),
  ('Calamansi', 'Fruit', 'Santa Cruz', 48.00, 'kg', 'Illustrative sample — not verified', '2026-11-04', 1),
  ('Tomato', 'Vegetables', 'Torrijos', 55.00, 'kg', 'Illustrative sample — not verified', '2026-11-03', 1),
  ('Sweet potato', 'Root crops', 'Mogpog', 40.00, 'kg', 'Illustrative sample — not verified', '2026-11-03', 1);

INSERT INTO users (username, full_name, email, password_hash, phone, address, role, account_type, is_active)
VALUES (
  'juan.farmer',
  'Juan Farmer',
  'juan.farmer@anilink.local',
  '$2y$10$xigdypO6u/rYKs/3Hza/Y.ocExwrFEfB0PYbXQL.EBtZFmB5BT1RS',
  '+63 917 123 4567',
  'Boac',
  'farmer',
  'Demonstration Account',
  1
)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);

INSERT INTO products
  (farmer_id, name, category, description, quantity, unit, price, harvest_date, location, image_path, status)
VALUES
  ( (SELECT id FROM users WHERE username = 'juan.farmer' LIMIT 1), 'Carabao Mango', 'Fruit', 'Locally harvested Carabao mangoes from Boac, known for their sweet, golden flesh and rich orchard flavor.', 120.00, 'kg', 85.00, '2026-11-05', 'Boac', 'assets/images/products/carabao-mango.jpg', 'active'),
  ( (SELECT id FROM users WHERE username = 'juan.farmer' LIMIT 1), 'Saba Banana', 'Fruit', 'Fresh saba bananas grown on our family farm in Boac. Ideal for steaming, frying, or home cooking.', 200.00, 'kg', 45.00, '2026-11-06', 'Boac', 'assets/images/products/saba-banana.jpg', 'active'),
  ( (SELECT id FROM users WHERE username = 'juan.farmer' LIMIT 1), 'Fresh Coconut', 'Coconut', 'Young fresh coconuts harvested for their sweet water and tender meat, perfect for refreshing drinks and family meals.', 150.00, 'piece', 30.00, '2026-11-03', 'Boac', 'assets/images/products/fresh-coconut.jpg', 'active'),
  ( (SELECT id FROM users WHERE username = 'juan.farmer' LIMIT 1), 'Cassava', 'Root crops', 'Cleanly harvested cassava roots from Mogpog, suitable for local food preparation and small-batch processing.', 100.00, 'kg', 35.00, '2026-11-02', 'Mogpog', 'assets/images/products/cassava.jpg', 'active'),
  ( (SELECT id FROM users WHERE username = 'juan.farmer' LIMIT 1), 'Fresh Eggplant', 'Vegetables', 'Premium eggplants harvested fresh from Gasan, ideal for sautés, stir-fries, and hearty local dishes.', 80.00, 'kg', 55.00, '2026-11-01', 'Gasan', 'assets/images/products/fresh-eggplant.jpg', 'active'),
  ( (SELECT id FROM users WHERE username = 'juan.farmer' LIMIT 1), 'Squash', 'Vegetables', 'Tender squash harvested in Boac with naturally sweet flesh and excellent storage quality for households and stalls.', 90.00, 'kg', 40.00, '2026-11-04', 'Boac', 'assets/images/products/squash.jpg', 'active'),
  ( (SELECT id FROM users WHERE username = 'juan.farmer' LIMIT 1), 'Fresh Tomatoes', 'Vegetables', 'Field-ripened tomatoes sourced from Santa Cruz, vibrant in color and ideal for daily meals and food preparation.', 75.00, 'kg', 65.00, '2026-11-07', 'Santa Cruz', 'assets/images/products/fresh-tomatoes.jpg', 'active'),
  ( (SELECT id FROM users WHERE username = 'juan.farmer' LIMIT 1), 'Local Rice', 'Grains', 'Locally grown rice from Boac, cleanly milled and ready for household consumption or small retail sales.', 100.00, 'kg', 55.00, '2026-11-05', 'Boac', 'assets/images/products/local-rice.jpg', 'active')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  category = VALUES(category),
  description = VALUES(description),
  quantity = VALUES(quantity),
  unit = VALUES(unit),
  price = VALUES(price),
  harvest_date = VALUES(harvest_date),
  location = VALUES(location),
  image_path = VALUES(image_path),
  status = VALUES(status);

