<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

function start_app_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_set_cookie_params([
        'httponly' => true,
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'samesite' => 'Lax',
        'path' => '/',
    ]);
    session_start();
}

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function request_data(): array
{
    $type = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($type, 'application/json') !== false) {
        $decoded = json_decode((string) file_get_contents('php://input'), true);
        return is_array($decoded) ? $decoded : [];
    }
    return $_POST;
}

function require_method(string ...$methods): void
{
    if (!in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', $methods, true)) {
        header('Allow: ' . implode(', ', $methods));
        json_response(['error' => 'Method not allowed.'], 405);
    }
}

function current_user(): ?array
{
    if (empty($_SESSION['user_id'])) {
        return null;
    }
    $statement = db()->prepare(
        'SELECT id, username, full_name AS name, email, phone, address AS location, role, account_type, is_active
         FROM users WHERE id = ? LIMIT 1'
    );
    $statement->execute([(int) $_SESSION['user_id']]);
    $user = $statement->fetch();
    if (!$user || !(int) $user['is_active']) {
        $_SESSION = [];
        session_regenerate_id(true);
        return null;
    }
    unset($user['is_active']);
    return $user;
}

function require_user(?string $role = null): array
{
    $user = current_user();
    if (!$user) {
        json_response(['error' => 'Please sign in to continue.'], 401);
    }
    if ($role !== null && $user['role'] !== $role) {
        json_response(['error' => 'You do not have permission to perform this action.'], 403);
    }
    return $user;
}

function require_csrf(): void
{
    $provided = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $expected = $_SESSION['csrf_token'] ?? '';
    if (!$expected || !$provided || !hash_equals($expected, $provided)) {
        json_response(['error' => 'Your session token has expired. Refresh the page and try again.'], 403);
    }
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function log_activity(?int $actorId, string $action, string $details = ''): void
{
    $statement = db()->prepare(
        'INSERT INTO activity_logs (actor_id, action, details, ip_address) VALUES (?, ?, ?, ?)'
    );
    $statement->execute([
        $actorId,
        $action,
        mb_substr($details, 0, 1000),
        mb_substr($_SERVER['REMOTE_ADDR'] ?? '', 0, 45),
    ]);
}

function db_transaction(callable $operation)
{
    $connection = db();
    $connection->beginTransaction();
    try {
        $result = $operation($connection);
        $connection->commit();
        return $result;
    } catch (Throwable $error) {
        if ($connection->inTransaction()) {
            $connection->rollBack();
        }
        throw $error;
    }
}

function product_image_upload(?array $file): ?string
{
    if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return null;
    }
    if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
        json_response(['error' => 'The product image could not be uploaded.'], 400);
    }
    if (($file['size'] ?? 0) > 5 * 1024 * 1024) {
        json_response(['error' => 'Product images must be 5 MB or smaller.'], 400);
    }

    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    $extensions = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];
    $imageInfo = @getimagesize($file['tmp_name']);
    if (!isset($extensions[$mime]) || $imageInfo === false || $imageInfo[0] > 8000 || $imageInfo[1] > 8000) {
        json_response(['error' => 'Upload a valid JPEG, PNG, or WebP image.'], 400);
    }

    $directory = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'products';
    if (!is_dir($directory) && !mkdir($directory, 0755, true) && !is_dir($directory)) {
        throw new RuntimeException('Unable to create the product image directory.');
    }
    $filename = bin2hex(random_bytes(20)) . '.' . $extensions[$mime];
    if (!move_uploaded_file($file['tmp_name'], $directory . '/' . $filename)) {
        throw new RuntimeException('Unable to store the uploaded product image.');
    }
    return 'uploads/products/' . $filename;
}

function validate_product(array $input): array
{
    $name = trim((string) ($input['name'] ?? ''));
    $category = trim((string) ($input['category'] ?? ''));
    $description = trim((string) ($input['description'] ?? ''));
    $location = trim((string) ($input['location'] ?? ''));
    $unit = trim((string) ($input['unit'] ?? ''));
    $quantity = filter_var($input['quantity'] ?? null, FILTER_VALIDATE_FLOAT);
    $price = filter_var($input['price'] ?? null, FILTER_VALIDATE_FLOAT);
    $harvest = trim((string) ($input['harvest'] ?? ''));
    $allowedUnits = ['kg', 'piece', 'sack', 'bundle', 'crate'];
    $allowedLocations = ['Boac', 'Buenavista', 'Gasan', 'Mogpog', 'Santa Cruz', 'Torrijos'];
    if ($name === '' || mb_strlen($name) > 120 || $category === '' || mb_strlen($category) > 80
        || $description === '' || mb_strlen($description) > 3000
        || !in_array($unit, $allowedUnits, true) || !in_array($location, $allowedLocations, true)
        || $quantity === false || !is_finite((float) $quantity) || $quantity <= 0 || $quantity > 9999999999.99
        || $price === false || !is_finite((float) $price) || $price <= 0 || $price > 9999999999.99
        || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $harvest)
        || !checkdate((int) substr($harvest, 5, 2), (int) substr($harvest, 8, 2), (int) substr($harvest, 0, 4))) {
        json_response(['error' => 'Check the product details and submit valid values.'], 422);
    }
    return [
        'name' => $name,
        'category' => $category,
        'description' => $description,
        'quantity' => $quantity,
        'unit' => $unit,
        'price' => $price,
        'harvest' => $harvest,
        'location' => $location,
    ];
}

function product_rows(string $where = '', array $params = [], string $order = 'p.created_at DESC'): array
{
    $sql = "SELECT p.id, p.farmer_id AS farmerId, p.name, p.category, p.description,
                   p.quantity, p.unit, p.price, p.harvest_date AS harvest,
                   p.location, p.image_path AS photoUrl, p.status,
                   u.full_name AS farmer
            FROM products p JOIN users u ON u.id = p.farmer_id
            WHERE u.is_active = 1 {$where} ORDER BY {$order}";
    $statement = db()->prepare($sql);
    $statement->execute($params);
    return $statement->fetchAll();
}

function price_rows(): array
{
    $statement = db()->query(
        "SELECT id, product_name AS product, category, market_location AS location,
                price_per_unit AS reference, unit, source, date_recorded AS date,
                is_sample
         FROM market_prices ORDER BY date_recorded DESC, product_name"
    );
    return $statement->fetchAll();
}
