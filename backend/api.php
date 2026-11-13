<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers/functions.php';
start_app_session();

try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $action = (string) ($_GET['action'] ?? '');
    $input = request_data();

    if ($method === 'GET' && $action === 'session') {
        json_response(['user' => current_user(), 'csrfToken' => csrf_token()]);
    }

    if ($method === 'GET' && $action === 'products') {
        $user = current_user();
        $where = ' AND p.status = ?';
        $params = ['active'];
        if ($user && $user['role'] === 'admin' && ($_GET['all'] ?? '') === '1') {
            $where = '';
            $params = [];
        } elseif ($user && $user['role'] === 'farmer' && ($_GET['mine'] ?? '') === '1') {
            $where = ' AND p.farmer_id = ? AND p.status IN ("active", "inactive")';
            $params = [(int) $user['id']];
        }
        if ($where !== '') {
            $query = trim((string) ($_GET['q'] ?? ''));
            if ($query !== '') {
                $where .= ' AND (p.name LIKE ? OR p.category LIKE ? OR u.full_name LIKE ? OR p.location LIKE ?)';
                $like = '%' . mb_substr($query, 0, 100) . '%';
                array_push($params, $like, $like, $like, $like);
            }
            $category = trim((string) ($_GET['category'] ?? ''));
            if ($category !== '') {
                $where .= ' AND p.category = ?';
                $params[] = mb_substr($category, 0, 80);
            }
            $location = trim((string) ($_GET['location'] ?? ''));
            if ($location !== '') {
                $where .= ' AND p.location = ?';
                $params[] = mb_substr($location, 0, 120);
            }
            if (isset($_GET['min']) && $_GET['min'] !== '') {
                $minimum = filter_var($_GET['min'], FILTER_VALIDATE_FLOAT);
                if ($minimum === false || $minimum < 0) {
                    json_response(['error' => 'Minimum price is invalid.'], 422);
                }
                $where .= ' AND p.price >= ?';
                $params[] = $minimum;
            }
            if (isset($_GET['max']) && $_GET['max'] !== '') {
                $maximum = filter_var($_GET['max'], FILTER_VALIDATE_FLOAT);
                if ($maximum === false || $maximum < 0) {
                    json_response(['error' => 'Maximum price is invalid.'], 422);
                }
                $where .= ' AND p.price <= ?';
                $params[] = $maximum;
            }
        }
        $sorts = [
            'price-asc' => 'p.price ASC',
            'price-desc' => 'p.price DESC',
            'name' => 'p.name ASC',
            'newest' => 'p.created_at DESC',
        ];
        $sort = (string) ($_GET['sort'] ?? 'newest');
        $rows = product_rows($where, $params, $sorts[$sort] ?? $sorts['newest']);
        json_response(['data' => $rows]);
    }

    if ($method === 'GET' && $action === 'product') {
        $id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$id) {
            json_response(['error' => 'A valid product ID is required.'], 422);
        }
        $rows = product_rows(' AND p.id = ? AND p.status = ?', [$id, 'active']);
        if (!$rows) {
            json_response(['error' => 'Product not found.'], 404);
        }
        json_response(['data' => $rows[0]]);
    }

    if ($method === 'GET' && $action === 'announcements') {
        $statement = db()->query(
            'SELECT a.id, a.title, a.content, a.featured_image AS featuredImage, a.category, a.audience,
                    a.publish_status AS status, a.published_at AS publishedAt, a.expires_at AS expiresAt,
                    a.created_at AS createdAt, u.full_name AS author
             FROM announcements a JOIN users u ON u.id = a.admin_id
             WHERE a.publish_status = "Published" AND (a.expires_at IS NULL OR a.expires_at > NOW())
             ORDER BY a.published_at DESC, a.created_at DESC LIMIT 100'
        );
        json_response(['data' => $statement->fetchAll()]);
    }

    if ($method === 'GET' && $action === 'prices') {
        $where = [];
        $params = [];
        $query = trim((string) ($_GET['q'] ?? ''));
        if ($query !== '') {
            $where[] = '(product_name LIKE ? OR category LIKE ? OR market_location LIKE ? OR source LIKE ?)';
            $like = '%' . mb_substr($query, 0, 100) . '%';
            array_push($params, $like, $like, $like, $like);
        }
        foreach (['category' => 'category', 'location' => 'market_location'] as $key => $column) {
            $value = trim((string) ($_GET[$key] ?? ''));
            if ($value !== '') {
                $where[] = $column . ' = ?';
                $params[] = mb_substr($value, 0, 120);
            }
        }
        $sql = 'SELECT id, product_name AS product, category, market_location AS location,
                       price_per_unit AS reference, unit, source, date_recorded AS date, is_sample
                FROM market_prices' . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
                . ' ORDER BY date_recorded DESC, product_name';
        $statement = db()->prepare($sql);
        $statement->execute($params);
        json_response(['data' => $statement->fetchAll()]);
    }

    if ($method === 'POST' && $action === 'register') {
        require_csrf();
        $name = trim((string) ($input['name'] ?? ''));
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        $phone = trim((string) ($input['phone'] ?? ''));
        $address = trim((string) ($input['location'] ?? ''));
        $role = (string) ($input['role'] ?? '');
        $password = (string) ($input['password'] ?? '');
        $allowedLocations = ['Boac', 'Buenavista', 'Gasan', 'Mogpog', 'Santa Cruz', 'Torrijos'];
        if ($name === '' || mb_strlen($name) > 120 || !filter_var($email, FILTER_VALIDATE_EMAIL)
            || mb_strlen($email) > 190 || !preg_match('/^[0-9+() -]{7,20}$/', $phone)
            || !in_array($address, $allowedLocations, true) || !in_array($role, ['farmer', 'buyer'], true)
            || strlen($password) < 8 || strlen($password) > 72) {
            json_response(['error' => 'Check your details. Use a valid email, phone, municipality, role, and password (8–72 characters).'], 422);
        }
        $username = strtolower(preg_replace('/[^a-z0-9._-]+/i', '.', $name));
        $username = preg_replace('/\.+/', '.', $username);
        $username = trim((string) $username, '.');
        if ($username === '') {
            $username = preg_replace('/[^a-z0-9._-]+/i', '.', strtolower(strstr($email, '@', true) ?: 'user'));
        }
        $username = preg_replace('/\.+/', '.', $username);
        $username = trim((string) $username, '.');
        if ($username === '') {
            $username = 'user';
        }
        $baseUsername = $username;
        $suffix = 1;
        while (true) {
            $available = db()->prepare('SELECT id FROM users WHERE username = ? LIMIT 1');
            $available->execute([$username]);
            if (!$available->fetch()) {
                break;
            }
            $username = $baseUsername . $suffix;
            $suffix++;
        }
        try {
            $userId = db_transaction(function (PDO $connection) use ($name, $username, $email, $password, $phone, $address, $role): int {
                $statement = $connection->prepare(
                    'INSERT INTO users (username, full_name, email, password_hash, phone, address, role, account_type)
                     VALUES (?, ?, ?, ?, ?, ?, ?, "Regular Account")'
                );
                $statement->execute([$username, $name, $email, password_hash($password, PASSWORD_DEFAULT), $phone, $address, $role]);
                $id = (int) $connection->lastInsertId();
                log_activity($id, 'account.registered', 'New ' . $role . ' account');
                return $id;
            });
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') {
                json_response(['error' => 'An account with that email address already exists.'], 409);
            }
            throw $error;
        }
        session_regenerate_id(true);
        $_SESSION['user_id'] = $userId;
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        json_response(['user' => current_user(), 'csrfToken' => csrf_token()], 201);
    }

    if ($method === 'POST' && $action === 'login') {
        require_csrf();
        $identity = strtolower(trim((string) ($input['identity'] ?? $input['email'] ?? '')));
        $password = (string) ($input['password'] ?? '');
        $statement = db()->prepare(
            'SELECT id, password_hash, is_active FROM users WHERE email = ? OR username = ? LIMIT 1'
        );
        $statement->execute([$identity, $identity]);
        $account = $statement->fetch();
        if (!$account || !(int) $account['is_active'] || !password_verify($password, $account['password_hash'])) {
            json_response(['error' => 'Email/username or password is incorrect, or this account is inactive.'], 401);
        }
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int) $account['id'];
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        if (password_needs_rehash($account['password_hash'], PASSWORD_DEFAULT)) {
            $update = db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
            $update->execute([password_hash($password, PASSWORD_DEFAULT), (int) $account['id']]);
        }
        log_activity((int) $account['id'], 'auth.login');
        json_response(['user' => current_user(), 'csrfToken' => csrf_token()]);
    }

    if ($method === 'POST' && $action === 'logout') {
        require_csrf();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        session_destroy();
        json_response(['success' => true]);
    }

    if ($method === 'POST' && $action === 'product-create') {
        require_csrf();
        $user = require_user('farmer');
        $product = validate_product($input);
        $image = product_image_upload($_FILES['photo'] ?? null);
        try {
            $id = db_transaction(function (PDO $connection) use ($user, $product, $image): int {
                $statement = $connection->prepare(
                    'INSERT INTO products
                     (farmer_id, name, category, description, quantity, unit, price, harvest_date, location, image_path)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                );
                $statement->execute([
                    (int) $user['id'], $product['name'], $product['category'], $product['description'],
                    $product['quantity'], $product['unit'], $product['price'], $product['harvest'],
                    $product['location'], $image,
                ]);
                $id = (int) $connection->lastInsertId();
                log_activity((int) $user['id'], 'product.created', $product['name']);
                return $id;
            });
        } catch (Throwable $error) {
            if ($image !== null) {
                $imagePath = dirname(__DIR__) . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $image);
                if (is_file($imagePath) && !unlink($imagePath)) {
                    error_log('[AniLink API] Unable to remove an orphaned product image.');
                }
            }
            throw $error;
        }
        json_response(['success' => true, 'id' => $id], 201);
    }

    if ($method === 'POST' && $action === 'product-update') {
        require_csrf();
        $user = require_user('farmer');
        $id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$id) {
            json_response(['error' => 'A valid product ID is required.'], 422);
        }
        $product = validate_product($input);
        $check = db()->prepare(
            'SELECT id FROM products WHERE id = ? AND farmer_id = ? AND status IN ("active", "inactive")'
        );
        $check->execute([$id, (int) $user['id']]);
        if (!$check->fetch()) {
            json_response(['error' => 'Product not found or you do not own it.'], 404);
        }
        $image = product_image_upload($_FILES['photo'] ?? null);
        $sql = 'UPDATE products SET name = ?, category = ?, description = ?, quantity = ?, unit = ?,
                price = ?, harvest_date = ?, location = ?, updated_at = CURRENT_TIMESTAMP';
        $params = [
            $product['name'], $product['category'], $product['description'], $product['quantity'],
            $product['unit'], $product['price'], $product['harvest'], $product['location'],
        ];
        if ($image !== null) {
            $sql .= ', image_path = ?';
            $params[] = $image;
        }
        $sql .= ' WHERE id = ? AND farmer_id = ? AND status IN ("active", "inactive")';
        $params[] = $id;
        $params[] = (int) $user['id'];
        $statement = db()->prepare($sql);
        $statement->execute($params);
        if ($statement->rowCount() === 0) {
            $check = db()->prepare(
                'SELECT id FROM products WHERE id = ? AND farmer_id = ? AND status IN ("active", "inactive")'
            );
            $check->execute([$id, (int) $user['id']]);
            if (!$check->fetch()) {
                json_response(['error' => 'Product not found or you do not own it.'], 404);
            }
        }
        log_activity((int) $user['id'], 'product.updated', $product['name']);
        json_response(['success' => true]);
    }

    if ($method === 'POST' && $action === 'product-delete') {
        require_csrf();
        $user = require_user('farmer');
        $id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$id) {
            json_response(['error' => 'A valid product ID is required.'], 422);
        }
        $statement = db()->prepare(
            'UPDATE products SET status = "inactive", updated_at = CURRENT_TIMESTAMP WHERE id = ? AND farmer_id = ? AND status = "active"'
        );
        $statement->execute([$id, (int) $user['id']]);
        if ($statement->rowCount() !== 1) {
            json_response(['error' => 'Product not found or it is already inactive.'], 404);
        }
        log_activity((int) $user['id'], 'product.deactivated', 'Product #' . $id);
        json_response(['success' => true]);
    }

    if ($method === 'POST' && $action === 'report-create') {
        require_csrf();
        $user = require_user();
        $productId = filter_var($input['productId'] ?? null, FILTER_VALIDATE_INT);
        $title = trim((string) ($input['title'] ?? ''));
        $category = trim((string) ($input['category'] ?? ''));
        $description = trim((string) ($input['description'] ?? ''));
        if (!$title || mb_strlen($title) > 150 || !$category || $description === '' || mb_strlen($description) > 2000) {
            json_response(['error' => 'Provide a valid report title, category, and description.'], 422);
        }
        $reportedUserId = null;
        if ($productId) {
            $statement = db()->prepare('SELECT farmer_id FROM products WHERE id = ? AND status IN ("active", "inactive") LIMIT 1');
            $statement->execute([$productId]);
            $product = $statement->fetch();
            if (!$product) {
                json_response(['error' => 'The reported product could not be found.'], 404);
            }
            $reportedUserId = (int) $product['farmer_id'];
        }
        db_transaction(function (PDO $connection) use ($user, $productId, $title, $category, $description, $reportedUserId): void {
            $statement = $connection->prepare(
                'INSERT INTO reports (reporter_id, reported_user_id, product_id, title, category, description, status)
                 VALUES (?, ?, ?, ?, ?, ?, "Pending")'
            );
            $statement->execute([(int) $user['id'], $reportedUserId, $productId ?: null, $title, $category, $description]);
            log_activity((int) $user['id'], 'report.submitted', $title);
        });
        json_response(['success' => true], 201);
    }

    if ($method === 'POST' && $action === 'inquiry-create') {
        require_csrf();
        $user = require_user('buyer');
        $productId = filter_var($input['productId'] ?? null, FILTER_VALIDATE_INT);
        $quantityInput = trim((string) ($input['quantity'] ?? ''));
        $quantity = $quantityInput === '' ? null : filter_var($quantityInput, FILTER_VALIDATE_FLOAT);
        $subject = trim((string) ($input['subject'] ?? ''));
        $message = trim((string) ($input['message'] ?? ''));
        if (!$productId || ($quantity !== null && ($quantity === false || !is_finite((float) $quantity)
            || $quantity <= 0 || $quantity > 9999999999.99)) || $subject === '' || mb_strlen($subject) > 150
            || $message === '' || mb_strlen($message) > 1000) {
            json_response(['error' => 'Enter a product, valid optional quantity, subject, and message of up to 1,000 characters.'], 422);
        }
        $rateLimit = db()->prepare(
            'SELECT COUNT(*) FROM inquiries
             WHERE buyer_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)'
        );
        $rateLimit->execute([(int) $user['id']]);
        if ((int) $rateLimit->fetchColumn() >= 5) {
            json_response(['error' => 'You are sending inquiries too quickly. Please wait a minute and try again.'], 429);
        }
        $statement = db()->prepare('SELECT farmer_id, name FROM products WHERE id = ? AND status = "active"');
        $statement->execute([$productId]);
        $product = $statement->fetch();
        if (!$product || (int) $product['farmer_id'] === (int) $user['id']) {
            json_response(['error' => 'That listing is unavailable for inquiry.'], 404);
        }
        $conversationId = db_transaction(function (PDO $connection) use ($user, $product, $productId, $subject, $message, $quantity): int {
            $statement = $connection->prepare(
                'INSERT INTO inquiries (buyer_id, farmer_id, product_id, subject, message, requested_quantity, status)
                 VALUES (?, ?, ?, ?, ?, ?, "Pending")'
            );
            $statement->execute([
                (int) $user['id'], (int) $product['farmer_id'], $productId, $subject, $message,
                $quantity === null ? null : (float) $quantity,
            ]);
            $inquiryId = (int) $connection->lastInsertId();
            $conversation = $connection->prepare('INSERT INTO conversations (inquiry_id) VALUES (?)');
            $conversation->execute([$inquiryId]);
            $conversationId = (int) $connection->lastInsertId();
            $initialMessage = $connection->prepare(
                'INSERT INTO messages (conversation_id, sender_id, receiver_id, message_content)
                 VALUES (?, ?, ?, ?)'
            );
            $initialMessage->execute([$conversationId, (int) $user['id'], (int) $product['farmer_id'], $message]);
            $notification = $connection->prepare(
                'INSERT INTO notifications (user_id, conversation_id, inquiry_id, type, content)
                 VALUES (?, ?, ?, "inquiry", ?)'
            );
            $notification->execute([
                (int) $product['farmer_id'], $conversationId, $inquiryId,
                mb_substr('New inquiry: ' . $subject, 0, 255),
            ]);
            log_activity((int) $user['id'], 'inquiry.created', $product['name']);
            return $conversationId;
        });
        json_response(['success' => true, 'conversationId' => $conversationId], 201);
    }

    if ($method === 'GET' && $action === 'inquiries') {
        $user = require_user();
        if ($user['role'] === 'farmer') {
            $statement = db()->prepare(
                'SELECT i.id, i.product_id AS productId, i.subject, i.message, i.requested_quantity AS quantity,
                        i.status, i.created_at AS createdAt, c.id AS conversationId,
                        b.full_name AS buyer, b.email AS buyerEmail,
                        p.name AS product, p.unit
                 FROM inquiries i JOIN users b ON b.id = i.buyer_id JOIN products p ON p.id = i.product_id
                 LEFT JOIN conversations c ON c.inquiry_id = i.id
                 WHERE i.farmer_id = ? ORDER BY i.created_at DESC'
            );
            $statement->execute([(int) $user['id']]);
        } elseif ($user['role'] === 'buyer') {
            $statement = db()->prepare(
                'SELECT i.id, i.product_id AS productId, i.subject, i.message, i.requested_quantity AS quantity,
                        i.status, i.created_at AS createdAt, c.id AS conversationId,
                        f.full_name AS farmer, f.email AS farmerEmail,
                        p.name AS product, p.unit
                 FROM inquiries i JOIN users f ON f.id = i.farmer_id JOIN products p ON p.id = i.product_id
                 LEFT JOIN conversations c ON c.inquiry_id = i.id
                 WHERE i.buyer_id = ? ORDER BY i.created_at DESC'
            );
            $statement->execute([(int) $user['id']]);
        } else {
            $statement = db()->query(
                'SELECT i.id, i.product_id AS productId, i.subject, i.message, i.requested_quantity AS quantity,
                        i.status, i.created_at AS createdAt, c.id AS conversationId,
                        b.full_name AS buyer, f.full_name AS farmer,
                        p.name AS product, p.unit
                 FROM inquiries i JOIN users b ON b.id = i.buyer_id JOIN users f ON f.id = i.farmer_id
                 JOIN products p ON p.id = i.product_id LEFT JOIN conversations c ON c.inquiry_id = i.id
                 ORDER BY i.created_at DESC LIMIT 500'
            );
        }
        json_response(['data' => $statement->fetchAll()]);
    }

    if ($method === 'GET' && $action === 'conversations') {
        $user = require_user();
        if (!in_array($user['role'], ['buyer', 'farmer'], true)) {
            json_response(['error' => 'Only Buyers and Farmers can access conversations.'], 403);
        }
        $userId = (int) $user['id'];
        $participantColumn = $user['role'] === 'buyer' ? 'i.buyer_id' : 'i.farmer_id';
        $statement = db()->prepare(
            'SELECT c.id, c.inquiry_id AS inquiryId, i.status, i.subject,
                    i.product_id AS productId, p.name AS product,
                    IF(i.buyer_id = ?, f.full_name, b.full_name) AS participant,
                    (SELECT m.message_content FROM messages m
                     WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS lastMessage,
                    (SELECT m.created_at FROM messages m
                     WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS lastMessageAt,
                    (SELECT COUNT(*) FROM messages m
                     WHERE m.conversation_id = c.id AND m.receiver_id = ? AND m.is_read = 0) AS unreadCount
             FROM conversations c
             JOIN inquiries i ON i.id = c.inquiry_id
             JOIN users b ON b.id = i.buyer_id
             JOIN users f ON f.id = i.farmer_id
             JOIN products p ON p.id = i.product_id
             WHERE ' . $participantColumn . ' = ?
             ORDER BY c.updated_at DESC, c.id DESC'
        );
        $statement->execute([$userId, $userId, $userId]);
        json_response(['data' => $statement->fetchAll()]);
    }

    if ($method === 'GET' && $action === 'conversation-messages') {
        $user = require_user();
        if (!in_array($user['role'], ['buyer', 'farmer'], true)) {
            json_response(['error' => 'Only Buyers and Farmers can access conversations.'], 403);
        }
        $conversationId = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$conversationId) {
            json_response(['error' => 'A valid conversation ID is required.'], 422);
        }
        $userId = (int) $user['id'];
        $conversation = db()->prepare(
            'SELECT c.id
             FROM conversations c JOIN inquiries i ON i.id = c.inquiry_id
             WHERE c.id = ? AND (i.buyer_id = ? OR i.farmer_id = ?)
             LIMIT 1'
        );
        $conversation->execute([$conversationId, $userId, $userId]);
        if (!$conversation->fetch()) {
            json_response(['error' => 'Conversation not found.'], 404);
        }
        db_transaction(function (PDO $connection) use ($conversationId, $userId): void {
            $statement = $connection->prepare(
                'UPDATE messages SET is_read = 1
                 WHERE conversation_id = ? AND receiver_id = ? AND is_read = 0'
            );
            $statement->execute([$conversationId, $userId]);
            $notification = $connection->prepare(
                'UPDATE notifications SET is_read = 1
                 WHERE conversation_id = ? AND user_id = ? AND is_read = 0'
            );
            $notification->execute([$conversationId, $userId]);
        });
        $statement = db()->prepare(
            'SELECT m.id, m.sender_id AS senderId, u.full_name AS sender,
                    m.receiver_id AS receiverId, m.message_content AS body,
                    m.is_read AS isRead, m.created_at AS createdAt
             FROM messages m JOIN users u ON u.id = m.sender_id
             WHERE m.conversation_id = ? ORDER BY m.id'
        );
        $statement->execute([$conversationId]);
        json_response(['data' => $statement->fetchAll()]);
    }

    if ($method === 'GET' && $action === 'notifications') {
        $user = require_user();
        if (!in_array($user['role'], ['buyer', 'farmer'], true)) {
            json_response(['error' => 'Only Buyers and Farmers can access notifications.'], 403);
        }
        $statement = db()->prepare(
            'SELECT id, conversation_id AS conversationId, inquiry_id AS inquiryId,
                    type, content, is_read AS isRead, created_at AS createdAt
             FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 100'
        );
        $statement->execute([(int) $user['id']]);
        json_response(['data' => $statement->fetchAll()]);
    }

    if ($method === 'POST' && $action === 'message-send') {
        require_csrf();
        $user = require_user();
        if (!in_array($user['role'], ['buyer', 'farmer'], true)) {
            json_response(['error' => 'Only Buyers and Farmers can send messages.'], 403);
        }
        $conversationId = filter_var($input['conversationId'] ?? null, FILTER_VALIDATE_INT);
        $message = trim((string) ($input['message'] ?? ''));
        if (!$conversationId || $message === '' || mb_strlen($message) > 2000) {
            json_response(['error' => 'Enter a valid conversation and a message of up to 2,000 characters.'], 422);
        }
        $userId = (int) $user['id'];
        $rateLimit = db()->prepare(
            'SELECT COUNT(*) FROM messages
             WHERE sender_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)'
        );
        $rateLimit->execute([$userId]);
        if ((int) $rateLimit->fetchColumn() >= 10) {
            json_response(['error' => 'You are sending messages too quickly. Please wait a minute and try again.'], 429);
        }
        $result = db_transaction(function (PDO $connection) use ($user, $userId, $conversationId, $message): array {
            $statement = $connection->prepare(
                'SELECT c.id, i.id AS inquiryId, i.buyer_id AS buyerId, i.farmer_id AS farmerId,
                        i.status, p.name AS product
                 FROM conversations c
                 JOIN inquiries i ON i.id = c.inquiry_id
                 JOIN products p ON p.id = i.product_id
                 WHERE c.id = ? AND (i.buyer_id = ? OR i.farmer_id = ?)
                 FOR UPDATE'
            );
            $statement->execute([$conversationId, $userId, $userId]);
            $conversation = $statement->fetch();
            if (!$conversation) {
                return ['error' => 'not_found'];
            }
            $isBuyer = $user['role'] === 'buyer' && (int) $conversation['buyerId'] === $userId;
            $isFarmer = $user['role'] === 'farmer' && (int) $conversation['farmerId'] === $userId;
            if (!$isBuyer && !$isFarmer) {
                return ['error' => 'forbidden'];
            }
            $receiverId = $isBuyer ? (int) $conversation['farmerId'] : (int) $conversation['buyerId'];
            $insert = $connection->prepare(
                'INSERT INTO messages (conversation_id, sender_id, receiver_id, message_content)
                 VALUES (?, ?, ?, ?)'
            );
            $insert->execute([$conversationId, $userId, $receiverId, $message]);
            $id = (int) $connection->lastInsertId();
            $updated = $connection->prepare(
                'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?'
            );
            $updated->execute([$conversationId]);
            if ($isFarmer && $conversation['status'] === 'Pending') {
                $status = $connection->prepare(
                    'UPDATE inquiries SET status = "Responded", updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = "Pending"'
                );
                $status->execute([(int) $conversation['inquiryId']]);
                if ($status->rowCount() === 1) {
                    $statusNotice = $connection->prepare(
                        'INSERT INTO notifications (user_id, conversation_id, inquiry_id, type, content)
                         VALUES (?, ?, ?, "status", "Inquiry status updated to Responded")'
                    );
                    $statusNotice->execute([
                        (int) $conversation['buyerId'], $conversationId, (int) $conversation['inquiryId'],
                    ]);
                }
            }
            $notification = $connection->prepare(
                'INSERT INTO notifications (user_id, conversation_id, inquiry_id, type, content)
                 VALUES (?, ?, ?, "message", ?)'
            );
            $notification->execute([
                $receiverId, $conversationId, (int) $conversation['inquiryId'],
                mb_substr('New message about ' . $conversation['product'], 0, 255),
            ]);
            log_activity($userId, 'message.sent', 'Inquiry #' . (int) $conversation['inquiryId']);
            return ['id' => $id];
        });
        if (isset($result['error'])) {
            json_response(
                ['error' => $result['error'] === 'forbidden'
                    ? 'You do not have permission to send messages in this conversation.'
                    : 'Conversation not found.'],
                $result['error'] === 'forbidden' ? 403 : 404
            );
        }
        json_response(['success' => true, 'id' => $result['id']], 201);
    }

    if ($method === 'POST' && $action === 'notification-read') {
        require_csrf();
        $user = require_user();
        if (!in_array($user['role'], ['buyer', 'farmer'], true)) {
            json_response(['error' => 'Only Buyers and Farmers can access notifications.'], 403);
        }
        $id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$id) {
            json_response(['error' => 'A valid notification ID is required.'], 422);
        }
        $statement = db()->prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?');
        $statement->execute([$id, (int) $user['id']]);
        if ($statement->rowCount() !== 1) {
            $check = db()->prepare('SELECT id FROM notifications WHERE id = ? AND user_id = ?');
            $check->execute([$id, (int) $user['id']]);
            if (!$check->fetch()) {
                json_response(['error' => 'Notification not found.'], 404);
            }
        }
        json_response(['success' => true]);
    }

    if ($method === 'POST' && $action === 'notification-read-all') {
        require_csrf();
        $user = require_user();
        if (!in_array($user['role'], ['buyer', 'farmer'], true)) {
            json_response(['error' => 'Only Buyers and Farmers can access notifications.'], 403);
        }
        $statement = db()->prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0');
        $statement->execute([(int) $user['id']]);
        json_response(['success' => true]);
    }

    if ($method === 'POST' && $action === 'inquiry-status') {
        require_csrf();
        $user = require_user('farmer');
        $id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);
        $status = (string) ($input['status'] ?? '');
        if (!$id || !in_array($status, ['Responded', 'Accepted', 'Declined', 'Closed'], true)) {
            json_response(['error' => 'Choose a valid inquiry status.'], 422);
        }
        $changed = db_transaction(function (PDO $connection) use ($user, $id, $status): bool {
            $lookup = $connection->prepare(
                'SELECT buyer_id, status FROM inquiries WHERE id = ? AND farmer_id = ? FOR UPDATE'
            );
            $lookup->execute([$id, (int) $user['id']]);
            $inquiry = $lookup->fetch();
            if (!$inquiry) {
                return false;
            }
            if ($inquiry['status'] === $status) {
                return true;
            }
            $statement = $connection->prepare(
                'UPDATE inquiries SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND farmer_id = ?'
            );
            $statement->execute([$status, $id, (int) $user['id']]);
            $conversation = $connection->prepare('SELECT id FROM conversations WHERE inquiry_id = ?');
            $conversation->execute([$id]);
            $conversationId = $conversation->fetchColumn();
            $notification = $connection->prepare(
                'INSERT INTO notifications (user_id, conversation_id, inquiry_id, type, content)
                 VALUES (?, ?, ?, "status", ?)'
            );
            $notification->execute([
                (int) $inquiry['buyer_id'],
                $conversationId !== false ? (int) $conversationId : null,
                $id,
                mb_substr('Inquiry status updated to ' . $status, 0, 255),
            ]);
            log_activity((int) $user['id'], 'inquiry.status_updated', 'Inquiry #' . $id . ': ' . $status);
            return true;
        });
        if (!$changed) {
            json_response(['error' => 'Inquiry not found or status unchanged.'], 404);
        }
        json_response(['success' => true]);
    }

    if ($method === 'GET' && $action === 'admin-stats') {
        require_user('admin');
        $statement = db()->query(
            "SELECT
                (SELECT COUNT(*) FROM users) AS users,
                (SELECT COUNT(*) FROM users WHERE role = 'farmer') AS farmers,
                (SELECT COUNT(*) FROM users WHERE role = 'buyer') AS buyers,
                (SELECT COUNT(*) FROM products) AS products,
                (SELECT COUNT(*) FROM products WHERE status = 'inactive') AS pending_products,
                (SELECT COUNT(*) FROM reports WHERE status IN ('Pending', 'Under Review')) AS reported_content,
                (SELECT COUNT(*) FROM inquiries WHERE status = 'Pending') AS unread_inquiries,
                (SELECT COUNT(*) FROM announcements WHERE publish_status = 'Published') AS published_announcements,
                (SELECT COUNT(*) FROM inquiries) AS inquiries"
        );
        json_response(['data' => $statement->fetch()]);
    }

    if ($method === 'GET' && $action === 'admin-users') {
        require_user('admin');
        $statement = db()->query(
            'SELECT id, full_name AS name, email, phone, address AS location, role AS type,
                    IF(is_active = 1, "Active", "Inactive") AS status, created_at AS createdAt
             FROM users ORDER BY created_at DESC LIMIT 1000'
        );
        json_response(['data' => $statement->fetchAll()]);
    }

    if ($method === 'POST' && $action === 'admin-user-status') {
        require_csrf();
        $admin = require_user('admin');
        $id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);
        $active = filter_var($input['active'] ?? null, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if (!$id || $active === null || $id === (int) $admin['id']) {
            json_response(['error' => 'Choose a valid account. Administrators cannot deactivate their own account.'], 422);
        }
        $statement = db()->prepare('UPDATE users SET is_active = ? WHERE id = ?');
        $statement->execute([$active ? 1 : 0, $id]);
        if ($statement->rowCount() !== 1) {
            json_response(['error' => 'Account not found or status unchanged.'], 404);
        }
        log_activity((int) $admin['id'], 'user.status_updated', 'User #' . $id . ': ' . ($active ? 'active' : 'inactive'));
        json_response(['success' => true]);
    }

    if ($method === 'POST' && $action === 'admin-product-status') {
        require_csrf();
        $admin = require_user('admin');
        $id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);
        $status = (string) ($input['status'] ?? '');
        if (!$id || !in_array($status, ['active', 'inactive', 'removed'], true)) {
            json_response(['error' => 'Choose a valid listing status.'], 422);
        }
        $statement = db()->prepare('UPDATE products SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        $statement->execute([$status, $id]);
        if ($statement->rowCount() !== 1) {
            json_response(['error' => 'Listing not found or status unchanged.'], 404);
        }
        log_activity((int) $admin['id'], 'product.moderated', 'Product #' . $id . ': ' . $status);
        json_response(['success' => true]);
    }

    if (in_array($action, ['admin-price-create', 'admin-price-update', 'admin-price-delete'], true)) {
        require_method('POST');
        require_csrf();
        $admin = require_user('admin');
        if ($action === 'admin-price-delete') {
            $id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);
            if (!$id) {
                json_response(['error' => 'A valid price record ID is required.'], 422);
            }
            $statement = db()->prepare('DELETE FROM market_prices WHERE id = ?');
            $statement->execute([$id]);
            if ($statement->rowCount() !== 1) {
                json_response(['error' => 'Price record not found.'], 404);
            }
            log_activity((int) $admin['id'], 'market_price.deleted', 'Price #' . $id);
            json_response(['success' => true]);
        }

        $productName = trim((string) ($input['product'] ?? ''));
        $category = trim((string) ($input['category'] ?? ''));
        $location = trim((string) ($input['location'] ?? ''));
        $unit = trim((string) ($input['unit'] ?? ''));
        $source = trim((string) ($input['source'] ?? ''));
        $price = filter_var($input['reference'] ?? null, FILTER_VALIDATE_FLOAT);
        $date = trim((string) ($input['date'] ?? ''));
        if ($productName === '' || mb_strlen($productName) > 120 || $category === ''
            || $location === '' || $unit === '' || $source === '' || mb_strlen($source) > 190
            || $price === false || !is_finite((float) $price) || $price <= 0 || $price > 9999999999.99
            || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)
            || !checkdate((int) substr($date, 5, 2), (int) substr($date, 8, 2), (int) substr($date, 0, 4))) {
            json_response(['error' => 'Check the product, category, location, unit, price, source, and recorded date.'], 422);
        }
        $sample = filter_var($input['isSample'] ?? false, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
        if ($action === 'admin-price-create') {
            $statement = db()->prepare(
                'INSERT INTO market_prices
                 (product_name, category, market_location, price_per_unit, unit, source, date_recorded, is_sample)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $statement->execute([$productName, $category, $location, $price, $unit, $source, $date, $sample]);
        } else {
            $id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);
            if (!$id) {
                json_response(['error' => 'A valid price record ID is required.'], 422);
            }
            $statement = db()->prepare(
                'UPDATE market_prices SET product_name = ?, category = ?, market_location = ?,
                 price_per_unit = ?, unit = ?, source = ?, date_recorded = ?, is_sample = ?,
                 updated_at = CURRENT_TIMESTAMP WHERE id = ?'
            );
            $statement->execute([$productName, $category, $location, $price, $unit, $source, $date, $sample, $id]);
            if ($statement->rowCount() !== 1) {
                json_response(['error' => 'Price record not found or unchanged.'], 404);
            }
        }
        log_activity((int) $admin['id'], 'market_price.saved', $productName);
        json_response(['success' => true], $action === 'admin-price-create' ? 201 : 200);
    }

    if ($method === 'GET' && $action === 'admin-reports') {
        require_user('admin');
        $statement = db()->query(
            'SELECT r.id, r.title, r.category, r.description, r.status, r.admin_notes AS notes,
                    r.created_at AS createdAt, reporter.full_name AS reporter,
                    reported.full_name AS reportedUser, p.name AS productName
             FROM reports r
             LEFT JOIN users reporter ON reporter.id = r.reporter_id
             LEFT JOIN users reported ON reported.id = r.reported_user_id
             LEFT JOIN products p ON p.id = r.product_id
             ORDER BY r.created_at DESC LIMIT 500'
        );
        json_response(['data' => $statement->fetchAll()]);
    }

    if ($method === 'POST' && $action === 'admin-report-status') {
        require_csrf();
        $admin = require_user('admin');
        $id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);
        $status = (string) ($input['status'] ?? '');
        $notes = trim((string) ($input['notes'] ?? ''));
        if (!$id || !in_array($status, ['Pending', 'Under Review', 'Resolved', 'Dismissed'], true)) {
            json_response(['error' => 'Choose a valid report status.'], 422);
        }
        $statement = db()->prepare(
            'UPDATE reports SET status = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        );
        $statement->execute([$status, mb_substr($notes, 0, 2000), $id]);
        if ($statement->rowCount() !== 1) {
            json_response(['error' => 'Report not found or status unchanged.'], 404);
        }
        log_activity((int) $admin['id'], 'report.updated', 'Report #' . $id . ': ' . $status);
        json_response(['success' => true]);
    }

    if ($method === 'GET' && $action === 'admin-announcements') {
        require_user('admin');
        $statement = db()->query(
            'SELECT a.id, a.title, a.content, a.featured_image AS featuredImage, a.category, a.audience,
                    a.publish_status AS status, a.published_at AS publishedAt, a.expires_at AS expiresAt,
                    a.created_at AS createdAt, u.full_name AS author
             FROM announcements a JOIN users u ON u.id = a.admin_id
             ORDER BY a.created_at DESC LIMIT 500'
        );
        json_response(['data' => $statement->fetchAll()]);
    }

    if ($method === 'POST' && $action === 'admin-announcement-save') {
        require_csrf();
        $admin = require_user('admin');
        $id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);
        $title = trim((string) ($input['title'] ?? ''));
        $content = trim((string) ($input['content'] ?? ''));
        $category = trim((string) ($input['category'] ?? ''));
        $audience = trim((string) ($input['audience'] ?? ''));
        $status = trim((string) ($input['status'] ?? 'Draft'));
        $expiresAt = trim((string) ($input['expiresAt'] ?? ''));
        $featuredImage = trim((string) ($input['featuredImage'] ?? ''));
        $allowedCategories = ['General Announcement', 'Agricultural Updates', 'Market Information', 'System Maintenance', 'Important Notices', 'Farmer Information'];
        $allowedAudiences = ['All Users', 'Farmers Only', 'Buyers Only'];
        $allowedStatuses = ['Draft', 'Published', 'Archived'];
        if ($title === '' || mb_strlen($title) > 150 || $content === '' || mb_strlen($content) > 5000
            || !in_array($category, $allowedCategories, true) || !in_array($audience, $allowedAudiences, true)
            || !in_array($status, $allowedStatuses, true) || ($expiresAt !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $expiresAt))
            || ($expiresAt !== '' && !checkdate((int) substr($expiresAt, 5, 2), (int) substr($expiresAt, 8, 2), (int) substr($expiresAt, 0, 4)))) {
            json_response(['error' => 'Check the announcement title, content, category, audience, status, and expiration date.'], 422);
        }
        if ($featuredImage !== '' && mb_strlen($featuredImage) > 255) {
            json_response(['error' => 'Announcement image path is too long.'], 422);
        }
        if ($id) {
            $statement = db()->prepare(
                'UPDATE announcements SET title = ?, content = ?, featured_image = ?, category = ?, audience = ?,
                 publish_status = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND admin_id = ?'
            );
            $statement->execute([$title, $content, $featuredImage !== '' ? $featuredImage : null, $category, $audience, $status, $expiresAt !== '' ? $expiresAt : null, $id, (int) $admin['id']]);
            if ($statement->rowCount() !== 1) {
                json_response(['error' => 'Announcement not found or you do not have permission to edit it.'], 404);
            }
            $event = 'announcement.updated';
        } else {
            $statement = db()->prepare(
                'INSERT INTO announcements (admin_id, title, content, featured_image, category, audience, publish_status, published_at, expires_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $statement->execute([
                (int) $admin['id'], $title, $content, $featuredImage !== '' ? $featuredImage : null,
                $category, $audience, $status, $status === 'Published' ? date('Y-m-d H:i:s') : null,
                $expiresAt !== '' ? $expiresAt . ' 23:59:59' : null,
            ]);
            $id = (int) db()->lastInsertId();
            $event = 'announcement.created';
        }
        log_activity((int) $admin['id'], $event, 'Announcement #' . $id . ': ' . $status);
        json_response(['success' => true, 'id' => $id]);
    }

    if ($method === 'POST' && $action === 'admin-announcement-delete') {
        require_csrf();
        $admin = require_user('admin');
        $id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$id) {
            json_response(['error' => 'A valid announcement ID is required.'], 422);
        }
        $statement = db()->prepare('DELETE FROM announcements WHERE id = ? AND admin_id = ?');
        $statement->execute([$id, (int) $admin['id']]);
        if ($statement->rowCount() !== 1) {
            json_response(['error' => 'Announcement not found or it was not created by this administrator.'], 404);
        }
        log_activity((int) $admin['id'], 'announcement.deleted', 'Announcement #' . $id);
        json_response(['success' => true]);
    }

    if ($method === 'GET' && $action === 'admin-activity') {
        require_user('admin');
        $statement = db()->query(
            'SELECT a.id, a.action, a.details, a.created_at AS createdAt, u.full_name AS actor
             FROM activity_logs a LEFT JOIN users u ON u.id = a.actor_id
             ORDER BY a.created_at DESC LIMIT 100'
        );
        json_response(['data' => $statement->fetchAll()]);
    }

    json_response(['error' => 'Unknown API action.'], 404);
} catch (Throwable $error) {
    error_log('[AniLink API] ' . $error->getMessage());
    json_response(['error' => 'The request could not be completed. Check the server configuration and try again.'], 500);
}
