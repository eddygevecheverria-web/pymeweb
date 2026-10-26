<?php
declare(strict_types=1);

/**
 * =========================================================================
 * PYMEWEB ERP - SEGURIDAD Y CONFIGURACIÓN CORS (PRODUCCIÓN & DESARROLLO)
 * =========================================================================
 */

$appEnv = $_ENV['APP_ENV'] ?? 'development';
$httpOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';

// Origen por defecto
$defaultFrontend = $_ENV['FRONTEND_URL'] ?? 'http://localhost:3000';
$originToAllow = $defaultFrontend;

// Orígenes permitidos en producción (separados por coma en .env)
$allowedOriginsStr = $_ENV['ALLOWED_ORIGINS'] ?? '';
$allowedOrigins = array_filter(array_map('trim', explode(',', $allowedOriginsStr)));
if (!in_array($defaultFrontend, $allowedOrigins, true)) {
    $allowedOrigins[] = $defaultFrontend;
}

if (!empty($httpOrigin)) {
    if ($appEnv === 'production') {
        // En producción: coincidencia estricta contra la lista blanca configurada
        if (in_array($httpOrigin, $allowedOrigins, true)) {
            $originToAllow = $httpOrigin;
        } else {
            // Si no está en la lista blanca en producción, responder 403 Forbidden
            if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
                http_response_code(403);
                exit('CORS Origin no autorizado en producción.');
            }
        }
    } else {
        // En desarrollo/staging: permitir localhost, 127.0.0.1 en cualquier puerto, dominios vercel.app, o FRONTEND_URL
        if (
            preg_match('/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i', $httpOrigin) ||
            preg_match('/^https?:\/\/[a-z0-9-]+\.vercel\.app$/i', $httpOrigin) ||
            in_array($httpOrigin, $allowedOrigins, true)
        ) {
            $originToAllow = $httpOrigin;
        }
    }
}

// Encabezados CORS
header("Access-Control-Allow-Origin: {$originToAllow}");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Negocio-Slug");
header("Access-Control-Max-Age: 86400");
header("Vary: Origin");

// Encabezados estrictos de seguridad HTTP (Hardening de Producción)
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: SAMEORIGIN");
header("X-XSS-Protection: 1; mode=block");
header("Referrer-Policy: strict-origin-when-cross-origin");
header("Content-Type: application/json; charset=UTF-8");

// Manejo de pre-flight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
