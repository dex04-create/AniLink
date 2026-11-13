<?php
declare(strict_types=1);

function db(): PDO
{
    static $connection;
    if ($connection instanceof PDO) {
        return $connection;
    }

    $host = getenv('ANILINK_DB_HOST');
    $database = getenv('ANILINK_DB_NAME');
    $username = getenv('ANILINK_DB_USER');
    $password = getenv('ANILINK_DB_PASSWORD');

    $host = $host === false || $host === '' ? 'localhost' : $host;
    $database = $database === false || $database === '' ? 'anilink_db' : $database;
    $username = $username === false || $username === '' ? 'root' : $username;
    $password = $password === false ? '' : $password;

    $connection = new PDO(
        "mysql:host={$host};dbname={$database};charset=utf8mb4",
        $username,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );

    return $connection;
}
