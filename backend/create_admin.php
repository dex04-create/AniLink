<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/helpers/functions.php';

if ($argc < 5) {
    fwrite(STDERR, "Usage: php backend/create_admin.php \"Full Name\" email phone municipality\n");
    exit(1);
}

if ((int) db()->query('SELECT COUNT(*) FROM users WHERE role = "admin"')->fetchColumn() > 0) {
    fwrite(STDERR, "An administrator account already exists. Use the existing administrator account to manage the system.\n");
    exit(1);
}

[$script, $name, $email, $phone, $address] = $argv;
$email = strtolower(trim($email));
if (trim($name) === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)
    || !preg_match('/^[0-9+() -]{7,20}$/', $phone)
    || !in_array($address, ['Boac', 'Buenavista', 'Gasan', 'Mogpog', 'Santa Cruz', 'Torrijos'], true)) {
    fwrite(STDERR, "Provide a name, valid email, phone number, and Marinduque municipality.\n");
    exit(1);
}

fwrite(STDOUT, "Admin password (8-72 characters): ");
$password = trim((string) fgets(STDIN));
if (strlen($password) < 8 || strlen($password) > 72) {
    fwrite(STDERR, "Password must be between 8 and 72 characters.\n");
    exit(1);
}

try {
    db_transaction(function (PDO $connection) use ($name, $email, $password, $phone, $address): void {
        $base = strtolower(preg_replace('/[^a-z0-9._-]+/i', '.', trim($name)) ?? trim($name));
        $base = preg_replace('/\.+/', '.', $base) ?? $base;
        $base = trim((string) $base, '.');
        $username = $base !== '' ? $base : 'admin';
        $suffix = 1;
        while (true) {
            $check = $connection->prepare('SELECT id FROM users WHERE username = ? LIMIT 1');
            $check->execute([$username]);
            if (!$check->fetch()) {
                break;
            }
            $username = $base . $suffix;
            $suffix++;
        }
        $statement = $connection->prepare(
            'INSERT INTO users (username, full_name, email, password_hash, phone, address, role)
             VALUES (?, ?, ?, ?, ?, ?, "admin")'
        );
        $statement->execute([
            $username,
            trim($name),
            $email,
            password_hash($password, PASSWORD_DEFAULT),
            $phone,
            $address,
        ]);
        log_activity((int) $connection->lastInsertId(), 'account.admin_created', 'Administrator created from CLI setup');
    });
} catch (PDOException $error) {
    if ($error->getCode() === '23000') {
        fwrite(STDERR, "That email address is already registered.\n");
        exit(1);
    }
    throw $error;
}

fwrite(STDOUT, "Administrator account created for {$email}.\n");
