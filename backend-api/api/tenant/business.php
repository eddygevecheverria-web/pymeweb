<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/AuthMiddleware.php';
require_once __DIR__ . '/../../core/ImageUploader.php';
require_once __DIR__ . '/../../core/Response.php';

$session   = AuthMiddleware::authenticate();
$negocioId = (int)$session['negocio_id'];
$db        = Database::getConnection();
$method    = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->prepare("
        SELECT id, nombre, slug, ruc_nit, telefono, whatsapp_contacto, direccion, logo_url, estado, fecha_expiracion
        FROM negocios
        WHERE id = :id
        LIMIT 1
    ");
    $stmt->execute(['id' => $negocioId]);
    Response::json(['business' => $stmt->fetch()]);
}

if ($method === 'POST') {
    $nombre           = trim($_POST['nombre'] ?? '');
    $rucNit           = trim($_POST['ruc_nit'] ?? '');
    $telefono         = trim($_POST['telefono'] ?? '');
    $whatsappContacto = trim($_POST['whatsapp_contacto'] ?? '');
    $direccion        = trim($_POST['direccion'] ?? '');

    if ($nombre === '') {
        Response::json(['error' => 'El nombre del negocio es obligatorio.'], 422);
    }

    if (empty($whatsappContacto) && !empty($telefono)) {
        $whatsappContacto = $telefono;
    }

    $logoUrl = null;
    if (!empty($_FILES['logo']['name'])) {
        try {
            $logoUrl = ImageUploader::uploadAndOptimize($_FILES['logo'], "logos/{$negocioId}", 400);
        } catch (Throwable $e) {
            Response::json(['error' => $e->getMessage()], 422);
        }
    }

    $sql = "
        UPDATE negocios 
        SET nombre = :nombre, ruc_nit = :ruc, telefono = :tel, whatsapp_contacto = :wsp, direccion = :dir
        " . ($logoUrl ? ", logo_url = :logo" : "") . "
        WHERE id = :id
    ";
    $params = [
        'nombre' => $nombre,
        'ruc'    => $rucNit ?: null,
        'tel'    => $telefono ?: null,
        'wsp'    => $whatsappContacto ?: null,
        'dir'    => $direccion ?: null,
        'id'     => $negocioId,
    ];
    if ($logoUrl) {
        $params['logo'] = $logoUrl;
    }

    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    $updated = $db->prepare("SELECT id, nombre, slug, ruc_nit, telefono, whatsapp_contacto, direccion, logo_url, estado, fecha_expiracion FROM negocios WHERE id = :id");
    $updated->execute(['id' => $negocioId]);

    Response::json([
        'message'  => 'Datos de tu negocio actualizados correctamente.',
        'business' => $updated->fetch()
    ]);
}

Response::json(['error' => 'Método no permitido'], 405);
