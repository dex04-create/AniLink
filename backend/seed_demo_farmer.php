<?php

declare(strict_types=1);

require_once __DIR__ . '/config/database.php';

function normalize_username(string $source): string
{
    $clean = strtolower($source);
    $clean = preg_replace('/[^a-z0-9._-]+/', '.', $clean) ?? $clean;
    $clean = preg_replace('/\.+/', '.', $clean) ?? $clean;
    return trim($clean, '.');
}

$pdo = db();

$columns = $pdo->query("SHOW COLUMNS FROM users LIKE 'username'")->fetch(PDO::FETCH_ASSOC);
if (!$columns) {
    $pdo->exec("ALTER TABLE users ADD COLUMN username VARCHAR(60) NOT NULL DEFAULT '' AFTER id");
}

$columns = $pdo->query("SHOW COLUMNS FROM users LIKE 'account_type'")->fetch(PDO::FETCH_ASSOC);
if (!$columns) {
    $pdo->exec("ALTER TABLE users ADD COLUMN account_type VARCHAR(60) NOT NULL DEFAULT 'Regular Account' AFTER role");
}

$indexes = $pdo->query("SHOW INDEX FROM users WHERE Key_name = 'uq_users_username'")->fetch(PDO::FETCH_ASSOC);
if (!$indexes) {
    $pdo->exec('ALTER TABLE users ADD UNIQUE KEY uq_users_username (username)');
}

$rows = $pdo->query('SELECT id, username, full_name, email FROM users ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);
foreach ($rows as $row) {
    if ((string) $row['username'] !== '') {
        continue;
    }
    $base = normalize_username((string) ($row['full_name'] ?: $row['email']));
    if ($base === '') {
        $base = normalize_username((string) ($row['email'] ?: 'user'));
    }
    $username = $base;
    $suffix = 1;
    while (true) {
        $check = $pdo->prepare('SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1');
        $check->execute([$username, (int) $row['id']]);
        if (!$check->fetch()) {
            break;
        }
        $username = $base . $suffix;
        $suffix++;
    }
    if ($row['full_name'] && (string) $row['email'] !== '' && $username !== '') {
        $pdo->prepare('UPDATE users SET username = ? WHERE id = ?')->execute([$username, (int) $row['id']]);
    }
}

$demoPassword = 'JuanDemo2026!';
$demoUser = [
    'username' => 'juan.farmer',
    'full_name' => 'Juan Farmer',
    'email' => 'juan.farmer@anilink.local',
    'password_hash' => password_hash($demoPassword, PASSWORD_DEFAULT),
    'phone' => '+63 917 123 4567',
    'address' => 'Boac',
    'role' => 'farmer',
    'account_type' => 'Demonstration Account',
    'is_active' => 1,
];

$statement = $pdo->prepare(
    'INSERT INTO users (username, full_name, email, password_hash, phone, address, role, account_type, is_active)
     VALUES (:username, :full_name, :email, :password_hash, :phone, :address, :role, :account_type, :is_active)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)'
);
$statement->execute($demoUser);

$farmer = $pdo->query(
    "SELECT id, full_name, role, is_active FROM users WHERE username = 'juan.farmer' LIMIT 1"
)->fetch(PDO::FETCH_ASSOC);
if (!$farmer || $farmer['full_name'] !== 'Juan Farmer' || $farmer['role'] !== 'farmer' || (int) $farmer['is_active'] !== 1) {
    fwrite(STDERR, "The active Juan Farmer account could not be verified; no product listings were seeded.\n");
    exit(1);
}
$farmId = (int) $farmer['id'];

$products = [
    [
        'name' => 'Carabao Mango',
        'category' => 'Fruit',
        'description' => 'Locally harvested Carabao mangoes from Boac, known for their sweet, golden flesh and rich orchard flavor.',
        'quantity' => 120.00,
        'unit' => 'kg',
        'price' => 85.00,
        'harvest_date' => '2026-11-05',
        'location' => 'Boac',
        'image_path' => 'assets/images/products/carabao-mango.jpg',
    ],
    [
        'name' => 'Saba Banana',
        'category' => 'Fruit',
        'description' => 'Fresh saba bananas grown on our family farm in Boac. Ideal for steaming, frying, or home cooking.',
        'quantity' => 200.00,
        'unit' => 'kg',
        'price' => 45.00,
        'harvest_date' => '2026-11-06',
        'location' => 'Boac',
        'image_path' => 'assets/images/products/saba-banana.jpg',
    ],
    [
        'name' => 'Fresh Coconut',
        'category' => 'Coconut',
        'description' => 'Fresh coconuts harvested for their water and mature white meat, suitable for drinks and home cooking.',
        'quantity' => 150.00,
        'unit' => 'piece',
        'price' => 30.00,
        'harvest_date' => '2026-11-03',
        'location' => 'Boac',
        'image_path' => 'assets/images/products/fresh-coconut.jpg',
    ],
    [
        'name' => 'Cassava',
        'category' => 'Root crops',
        'description' => 'Cleanly harvested cassava roots from Mogpog, suitable for local food preparation and small-batch processing.',
        'quantity' => 100.00,
        'unit' => 'kg',
        'price' => 35.00,
        'harvest_date' => '2026-11-02',
        'location' => 'Mogpog',
        'image_path' => 'assets/images/products/cassava.jpg',
    ],
    [
        'name' => 'Fresh Eggplant',
        'category' => 'Vegetables',
        'description' => 'Premium eggplants harvested fresh from Gasan, ideal for sautés, stir-fries, and hearty local dishes.',
        'quantity' => 80.00,
        'unit' => 'kg',
        'price' => 55.00,
        'harvest_date' => '2026-11-01',
        'location' => 'Gasan',
        'image_path' => 'assets/images/products/fresh-eggplant.jpg',
    ],
    [
        'name' => 'Squash',
        'category' => 'Vegetables',
        'description' => 'Tender squash harvested in Boac with naturally sweet flesh and excellent storage quality for households and stalls.',
        'quantity' => 90.00,
        'unit' => 'kg',
        'price' => 40.00,
        'harvest_date' => '2026-11-04',
        'location' => 'Boac',
        'image_path' => 'assets/images/products/squash.jpg',
    ],
    [
        'name' => 'Fresh Tomatoes',
        'category' => 'Vegetables',
        'description' => 'Field-ripened tomatoes sourced from Santa Cruz, vibrant in color and ideal for daily meals and food preparation.',
        'quantity' => 75.00,
        'unit' => 'kg',
        'price' => 65.00,
        'harvest_date' => '2026-11-07',
        'location' => 'Santa Cruz',
        'image_path' => 'assets/images/products/fresh-tomatoes.jpg',
    ],
    [
        'name' => 'Local Rice',
        'category' => 'Grains',
        'description' => 'Locally grown rice from Boac, cleanly milled and ready for household consumption or small retail sales.',
        'quantity' => 100.00,
        'unit' => 'kg',
        'price' => 55.00,
        'harvest_date' => '2026-11-05',
        'location' => 'Boac',
        'image_path' => 'assets/images/products/local-rice.jpg',
    ],
    [
        'name' => 'Sweet Potato',
        'category' => 'Root crops',
        'description' => 'Freshly harvested sweet potatoes from Mogpog. Demonstration listing and price only; confirm actual availability with the farmer.',
        'quantity' => 100.00,
        'unit' => 'kg',
        'price' => 40.00,
        'harvest_date' => '2026-11-08',
        'location' => 'Mogpog',
        'image_path' => 'assets/images/products/sweet-potato.jpg',
    ],
    [
        'name' => 'Papaya',
        'category' => 'Fruit',
        'description' => 'Ripe papaya from Boac, shown as a sample local produce listing. Price and quantity are fictional demonstration values.',
        'quantity' => 80.00,
        'unit' => 'kg',
        'price' => 50.00,
        'harvest_date' => '2026-11-09',
        'location' => 'Boac',
        'image_path' => 'assets/images/products/papaya.jpg',
    ],
    [
        'name' => 'Calamansi',
        'category' => 'Fruit',
        'description' => 'Fresh calamansi from Gasan. Demonstration listing and price only; confirm actual availability with the farmer.',
        'quantity' => 60.00,
        'unit' => 'kg',
        'price' => 70.00,
        'harvest_date' => '2026-11-08',
        'location' => 'Gasan',
        'image_path' => 'assets/images/products/calamansi.jpg',
    ],
    [
        'name' => 'Pineapple',
        'category' => 'Fruit',
        'description' => 'Fresh pineapple from Santa Cruz, listed for demonstration. The sample price and quantity are not verified market data.',
        'quantity' => 45.00,
        'unit' => 'piece',
        'price' => 65.00,
        'harvest_date' => '2026-11-10',
        'location' => 'Santa Cruz',
        'image_path' => 'assets/images/products/pineapple.jpg',
    ],
    [
        'name' => 'Watermelon',
        'category' => 'Fruit',
        'description' => 'Watermelon from Buenavista. Demonstration listing and price only; confirm actual availability with the farmer.',
        'quantity' => 120.00,
        'unit' => 'kg',
        'price' => 35.00,
        'harvest_date' => '2026-11-09',
        'location' => 'Buenavista',
        'image_path' => 'assets/images/products/watermelon.jpg',
    ],
    [
        'name' => 'String Beans',
        'category' => 'Vegetables',
        'description' => 'Fresh string beans from Boac. Demonstration listing and price only; confirm actual availability with the farmer.',
        'quantity' => 50.00,
        'unit' => 'kg',
        'price' => 60.00,
        'harvest_date' => '2026-11-10',
        'location' => 'Boac',
        'image_path' => 'assets/images/products/string-beans.jpg',
    ],
    [
        'name' => 'Bitter Gourd',
        'category' => 'Vegetables',
        'description' => 'Fresh bitter gourd from Mogpog. Demonstration listing and price only; confirm actual availability with the farmer.',
        'quantity' => 40.00,
        'unit' => 'kg',
        'price' => 65.00,
        'harvest_date' => '2026-11-08',
        'location' => 'Mogpog',
        'image_path' => 'assets/images/products/bitter-gourd.jpg',
    ],
    [
        'name' => 'Cabbage',
        'category' => 'Vegetables',
        'description' => 'Fresh cabbage from Santa Cruz. Demonstration listing and price only; confirm actual availability with the farmer.',
        'quantity' => 55.00,
        'unit' => 'kg',
        'price' => 75.00,
        'harvest_date' => '2026-11-09',
        'location' => 'Santa Cruz',
        'image_path' => 'assets/images/products/cabbage.jpg',
    ],
    [
        'name' => 'Okra',
        'category' => 'Vegetables',
        'description' => 'Fresh okra from Gasan. Demonstration listing and price only; confirm actual availability with the farmer.',
        'quantity' => 60.00,
        'unit' => 'kg',
        'price' => 50.00,
        'harvest_date' => '2026-11-10',
        'location' => 'Gasan',
        'image_path' => 'assets/images/products/okra.jpg',
    ],
    [
        'name' => 'Chili Pepper',
        'category' => 'Vegetables',
        'description' => 'Fresh chili peppers from Boac. Demonstration listing and price only; confirm actual availability with the farmer.',
        'quantity' => 25.00,
        'unit' => 'kg',
        'price' => 120.00,
        'harvest_date' => '2026-11-09',
        'location' => 'Boac',
        'image_path' => 'assets/images/products/chili-pepper.jpg',
    ],
    [
        'name' => 'Sweet Corn',
        'category' => 'Grains',
        'description' => 'Fresh sweet corn from Buenavista. Demonstration listing and price only; confirm actual availability with the farmer.',
        'quantity' => 90.00,
        'unit' => 'kg',
        'price' => 35.00,
        'harvest_date' => '2026-11-08',
        'location' => 'Buenavista',
        'image_path' => 'assets/images/products/sweet-corn.jpg',
    ],
    [
        'name' => 'Young Coconut',
        'category' => 'Coconut',
        'description' => 'Young coconuts from Torrijos. Demonstration listing and price only; confirm actual availability with the farmer.',
        'quantity' => 100.00,
        'unit' => 'piece',
        'price' => 25.00,
        'harvest_date' => '2026-11-10',
        'location' => 'Torrijos',
        'image_path' => 'assets/images/products/young-coconut.jpg',
    ],
    [
        'name' => 'Ginger',
        'category' => 'Root crops',
        'description' => 'Fresh ginger roots from Boac. Demonstration listing and price only; confirm actual availability with the farmer.',
        'quantity' => 35.00,
        'unit' => 'kg',
        'price' => 100.00,
        'harvest_date' => '2026-11-09',
        'location' => 'Boac',
        'image_path' => 'assets/images/products/ginger.jpg',
    ],
    [
        'name' => 'Taro (Gabi)',
        'category' => 'Root crops',
        'description' => 'Fresh taro roots from Mogpog. Demonstration listing and price only; confirm actual availability with the farmer.',
        'quantity' => 70.00,
        'unit' => 'kg',
        'price' => 45.00,
        'harvest_date' => '2026-11-08',
        'location' => 'Mogpog',
        'image_path' => 'assets/images/products/taro.jpg',
    ],
    [
        'name' => 'Dragon Fruit',
        'category' => 'Fruit',
        'description' => 'Dragon fruit from Santa Cruz. Demonstration listing and price only; confirm actual availability with the farmer.',
        'quantity' => 30.00,
        'unit' => 'kg',
        'price' => 120.00,
        'harvest_date' => '2026-11-10',
        'location' => 'Santa Cruz',
        'image_path' => 'assets/images/products/dragon-fruit.jpg',
    ],
];

foreach ($products as $product) {
    $exists = $pdo->prepare('SELECT id FROM products WHERE farmer_id = ? AND name = ? AND location = ? LIMIT 1');
    $exists->execute([$farmId, $product['name'], $product['location']]);
    if ($exists->fetch()) {
        $pdo->prepare(
            'UPDATE products SET category = ?, description = ?, quantity = ?, unit = ?, price = ?, harvest_date = ?, image_path = ?, status = ? WHERE farmer_id = ? AND name = ? AND location = ?'
        )->execute([
            $product['category'],
            $product['description'],
            $product['quantity'],
            $product['unit'],
            $product['price'],
            $product['harvest_date'],
            $product['image_path'],
            'active',
            $farmId,
            $product['name'],
            $product['location'],
        ]);
        continue;
    }

    $pdo->prepare(
        'INSERT INTO products (farmer_id, name, category, description, quantity, unit, price, harvest_date, location, image_path, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "active")'
    )->execute([
        $farmId,
        $product['name'],
        $product['category'],
        $product['description'],
        $product['quantity'],
        $product['unit'],
        $product['price'],
        $product['harvest_date'],
        $product['location'],
        $product['image_path'],
    ]);
}

fwrite(STDOUT, "Demo product listings are up to date; the existing farmer account was preserved.\n");
