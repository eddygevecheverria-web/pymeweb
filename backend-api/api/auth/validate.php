<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../core/AuthMiddleware.php';
require_once __DIR__ . '/../../core/Response.php';

$session = AuthMiddleware::authenticate(false);
Response::json([
    'valid'   => true,
    'session' => $session
]);
