<?php
declare(strict_types=1);

class JwtHandler {
    private static function getSecret(): string {
        return $_ENV['JWT_SECRET'] ?? 'pymeweb_super_secret_key_change_in_prod_2026';
    }

    private static function base64UrlEncode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $data): string {
        return base64_decode(strtr($data, '-_', '+/'));
    }

    public static function encode(array $payload, int $ttlSeconds = 86400): string {
        $header = ['typ' => 'JWT', 'alg' => 'HS256'];
        $payload['iat'] = time();
        $payload['exp'] = time() + $ttlSeconds;

        $base64Header  = self::base64UrlEncode(json_encode($header));
        $base64Payload = self::base64UrlEncode(json_encode($payload));

        $signature = hash_hmac('sha256', "$base64Header.$base64Payload", self::getSecret(), true);
        $base64Signature = self::base64UrlEncode($signature);

        return "$base64Header.$base64Payload.$base64Signature";
    }

    public static function decode(string $token): ?array {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }

        [$base64Header, $base64Payload, $base64Signature] = $parts;
        $expectedSig = self::base64UrlEncode(
            hash_hmac('sha256', "$base64Header.$base64Payload", self::getSecret(), true)
        );

        if (!hash_equals($expectedSig, $base64Signature)) {
            return null;
        }

        $payload = json_decode(self::base64UrlDecode($base64Payload), true);
        if (!$payload || !isset($payload['exp']) || $payload['exp'] < time()) {
            return null;
        }

        return $payload;
    }
}
