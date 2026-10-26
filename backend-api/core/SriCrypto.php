<?php
declare(strict_types=1);

require_once __DIR__ . '/EnvLoader.php';

class SriCrypto {
    private static function getKey(): string {
        $secret = $_ENV['JWT_SECRET'] ?? 'pymeweb_sri_secret_key_aes256_2026';
        return hash('sha256', $secret, true); // 32 bytes para AES-256
    }

    /**
     * Encripta una contraseña con AES-256-CBC
     */
    public static function encrypt(string $plainText): string {
        if ($plainText === '') return '';
        $iv = openssl_random_pseudo_bytes(openssl_cipher_iv_length('aes-256-cbc'));
        $encrypted = openssl_encrypt($plainText, 'aes-256-cbc', self::getKey(), 0, $iv);
        return base64_encode($iv . '::' . $encrypted);
    }

    /**
     * Desencripta una contraseña encriptada con AES-256-CBC
     */
    public static function decrypt(string $cipherText): string {
        if ($cipherText === '') return '';
        $raw = base64_decode($cipherText);
        $parts = explode('::', $raw, 2);
        if (count($parts) !== 2) {
            return '';
        }
        [$iv, $encrypted] = $parts;
        $decrypted = openssl_decrypt($encrypted, 'aes-256-cbc', self::getKey(), 0, $iv);
        return $decrypted !== false ? $decrypted : '';
    }
}
