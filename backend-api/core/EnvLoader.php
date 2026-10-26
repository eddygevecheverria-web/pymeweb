<?php
declare(strict_types=1);

class EnvLoader {
    private static bool $loaded = false;

    public static function load(string $path = ''): void {
        if (self::$loaded) return;

        if ($path === '') {
            $path = __DIR__ . '/../.env';
        }

        if (file_exists($path)) {
            $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                $line = trim($line);
                if ($line === '' || str_starts_with($line, '#')) {
                    continue;
                }

                $parts = explode('=', $line, 2);
                if (count($parts) === 2) {
                    $key = trim($parts[0]);
                    $val = trim($parts[1]);
                    // Quitar comillas si las tuviese
                    $val = trim($val, "\"'");
                    if (!isset($_ENV[$key])) {
                        $_ENV[$key] = $val;
                    }
                    if (!isset($_SERVER[$key])) {
                        $_SERVER[$key] = $val;
                    }
                    putenv("{$key}={$val}");
                }
            }
        }
        self::$loaded = true;
    }
}

// Cargar automáticamente
EnvLoader::load();
