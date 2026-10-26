<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/AuthMiddleware.php';
require_once __DIR__ . '/../../core/Response.php';

$session   = AuthMiddleware::authenticate();
$negocioId = (int)$session['negocio_id'];
$db        = Database::getConnection();
$method    = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $soloFiados = ($_GET['fiados'] ?? '') === '1';
    $search = trim($_GET['q'] ?? $_GET['doc'] ?? '');
    
    $sql = "
        SELECT id, documento, nombre, email, telefono, direccion, saldo_pendiente, created_at
        FROM clientes
        WHERE negocio_id = :nid
    ";
    $params = ['nid' => $negocioId];

    if ($soloFiados) {
        $sql .= " AND saldo_pendiente > 0";
    }

    try {
        if ($search !== '') {
            $cleanDoc = preg_replace('/[^0-9A-Za-z]/', '', $search);
            $likeSearch = "%{$search}%";
            $sql .= " AND (
                documento = :exact_doc 
                OR documento LIKE :like_doc 
                OR nombre LIKE :like_nom
                " . ($cleanDoc !== '' ? " OR REPLACE(REPLACE(REPLACE(documento, '-', ''), '.', ''), ' ', '') LIKE :clean_doc" : "") . "
            )";
            $params['exact_doc'] = $search;
            $params['like_doc'] = $likeSearch;
            $params['like_nom'] = $likeSearch;
            if ($cleanDoc !== '') {
                $params['clean_doc'] = "%{$cleanDoc}%";
            }
        }

        $sql .= " ORDER BY saldo_pendiente DESC, nombre ASC";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        Response::json(['customers' => $stmt->fetchAll()]);
    } catch (Throwable $e) {
        Response::json(['error' => 'Error al buscar clientes: ' . $e->getMessage()], 500);
    }
}

if ($method === 'POST') {
    $input     = json_decode(file_get_contents('php://input'), true) ?? [];
    $id        = (int)($input['id'] ?? 0);
    $documento = trim($input['documento'] ?? '');
    $nombre    = trim($input['nombre'] ?? '');
    $email     = strtolower(trim($input['email'] ?? ''));
    $telefono  = trim($input['telefono'] ?? '');
    $direccion = trim($input['direccion'] ?? '');

    if ($nombre === '') {
        Response::json(['error' => 'El nombre del cliente es obligatorio.'], 422);
    }

    if ($id > 0) {
        $stmt = $db->prepare("
            UPDATE clientes
            SET documento = :doc, nombre = :nom, email = :email, telefono = :tel, direccion = :dir
            WHERE id = :id AND negocio_id = :nid
        ");
        $stmt->execute([
            'doc'   => $documento ?: null,
            'nom'   => $nombre,
            'email' => $email ?: null,
            'tel'   => $telefono ?: null,
            'dir'   => $direccion ?: null,
            'id'    => $id,
            'nid'   => $negocioId
        ]);
        Response::json(['message' => 'Cliente actualizado.']);
    } else {
        $stmt = $db->prepare("
            INSERT INTO clientes (negocio_id, documento, nombre, email, telefono, direccion)
            VALUES (:nid, :doc, :nom, :email, :tel, :dir)
        ");
        $stmt->execute([
            'nid'   => $negocioId,
            'doc'   => $documento ?: null,
            'nom'   => $nombre,
            'email' => $email ?: null,
            'tel'   => $telefono ?: null,
            'dir'   => $direccion ?: null
        ]);
        Response::json(['message' => 'Cliente registrado.', 'cliente_id' => (int)$db->lastInsertId()], 201);
    }
}

Response::json(['error' => 'Método no soportado'], 405);
