<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/JwtHandler.php';
require_once __DIR__ . '/Response.php';

class AuthMiddleware {
    public static function authenticate(bool $requireSuperAdmin = false, bool $allowExpired = false): array {
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        $authHeader = $headers['Authorization']
            ?? $headers['authorization']
            ?? $_SERVER['HTTP_AUTHORIZATION']
            ?? '';

        $rawToken = null;
        if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            $rawToken = $matches[1];
        } elseif (!empty($_GET['token'])) {
            $rawToken = trim((string)$_GET['token']);
        }

        if (!$rawToken) {
            Response::json(['error' => 'No autenticado. Token faltante.'], 401);
        }

        $payload = JwtHandler::decode($rawToken);
        if (!$payload) {
            Response::json(['error' => 'Token inválido o sesión expirada.'], 401);
        }

        if ($requireSuperAdmin && ($payload['rol'] ?? '') !== 'super_admin') {
            Response::json(['error' => 'Acceso exclusivo para Super Administrador.'], 403);
        }

        // Si es un usuario de un Negocio (Tenant), verificamos la vigencia de su suscripción en BD
        if (($payload['rol'] ?? '') !== 'super_admin') {
            $db = Database::getConnection();
            $stmt = $db->prepare("
                SELECT id, nombre, slug, estado, fecha_expiracion, logo_url 
                FROM negocios 
                WHERE id = :negocio_id 
                LIMIT 1
            ");
            $stmt->execute(['negocio_id' => $payload['negocio_id']]);
            $negocio = $stmt->fetch();

            if (!$negocio) {
                Response::json(['error' => 'Negocio no encontrado.'], 404);
            }

            $ahora = new DateTimeImmutable('now');
            $expiracion = new DateTimeImmutable($negocio['fecha_expiracion']);

            // Regla estricta: si la fecha actual supera fecha_expiracion o está inactivo -> 403 Payment Required
            if (!$allowExpired && ($negocio['estado'] === 'inactivo' || $ahora > $expiracion)) {
                if ($negocio['estado'] !== 'inactivo' && $ahora > $expiracion) {
                    $update = $db->prepare("UPDATE negocios SET estado = 'inactivo' WHERE id = :id");
                    $update->execute(['id' => $negocio['id']]);
                }

                Response::json([
                    'error'            => 'Payment Required',
                    'code'             => 'SUBSCRIPTION_EXPIRED',
                    'message'          => 'El periodo de prueba o suscripción de tu negocio ha finalizado.',
                    'fecha_expiracion' => $negocio['fecha_expiracion'],
                    'negocio_nombre'   => $negocio['nombre']
                ], 403);
            }

            $payload['negocio'] = $negocio;
        }

        $payload['user_id'] = (int)($payload['user_id'] ?? $payload['sub'] ?? 0);
        return $payload;
    }
}
