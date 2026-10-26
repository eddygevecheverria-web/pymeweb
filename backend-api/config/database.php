<?php
declare(strict_types=1);

require_once __DIR__ . '/../core/EnvLoader.php';

class Database {
    private static ?PDO $instance = null;


    public static function getConnection(): PDO {
        if (self::$instance === null) {
            $host = $_ENV['DB_HOST'] ?? '127.0.0.1';
            $db   = $_ENV['DB_NAME'] ?? 'pymeweb';
            $user = $_ENV['DB_USER'] ?? 'root';
            $pass = $_ENV['DB_PASS'] ?? '';

            $dsn = "mysql:host={$host};dbname={$db};charset=utf8mb4";
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => true,
            ];

            self::$instance = new PDO($dsn, $user, $pass, $options);
        }
        return self::$instance;
    }
}
