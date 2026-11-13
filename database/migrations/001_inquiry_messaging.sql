USE anilink_db;

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS subject VARCHAR(150) NOT NULL DEFAULT '' AFTER product_id;

ALTER TABLE inquiries
  MODIFY COLUMN requested_quantity DECIMAL(12,2) DEFAULT NULL;

UPDATE inquiries i
JOIN products p ON p.id = i.product_id
SET i.subject = CONCAT('Inquiry about ', p.name)
WHERE i.subject = '';

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

INSERT IGNORE INTO conversations (inquiry_id, created_at, updated_at)
SELECT id, created_at, updated_at
FROM inquiries;

INSERT INTO messages (conversation_id, sender_id, receiver_id, message_content, is_read, created_at)
SELECT c.id, i.buyer_id, i.farmer_id, i.message, 0, i.created_at
FROM inquiries i
JOIN conversations c ON c.inquiry_id = i.id
WHERE NOT EXISTS (
  SELECT 1 FROM messages m WHERE m.conversation_id = c.id
);

INSERT INTO notifications (user_id, conversation_id, inquiry_id, type, content, created_at)
SELECT i.farmer_id, c.id, i.id, 'inquiry', LEFT(CONCAT('New inquiry: ', i.subject), 255), i.created_at
FROM inquiries i
JOIN conversations c ON c.inquiry_id = i.id
WHERE NOT EXISTS (
  SELECT 1 FROM notifications n
  WHERE n.user_id = i.farmer_id AND n.inquiry_id = i.id AND n.type = 'inquiry'
);
