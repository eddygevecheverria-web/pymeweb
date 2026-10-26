<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/AuthMiddleware.php';
require_once __DIR__ . '/../../core/Response.php';

$session   = AuthMiddleware::authenticate();
$negocioId = (int)$session['negocio_id'];
$usuarioId = (int)$session['sub'];
$db        = Database::getConnection();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::json(['error' => 'Método no permitido'], 405);
}

$input      = json_decode(file_get_contents('php://input'), true) ?? [];
$clienteId  = (int)($input['cliente_id'] ?? 0);
$tipo       = $input['tipo'] ?? 'abono';
$monto      = round((float)($input['monto'] ?? 0), 2);
$metodoPago = $input['metodo_pago'] ?? 'efectivo';
$notas      = trim($input['notas'] ?? '');

if ($clienteId <= 0 || $monto <= 0) {
    Response::json(['error' => 'Selecciona un cliente e ingresa un monto mayor a 0.'], 422);
}

try {
    $db->beginTransaction();

    $stmt = $db->prepare("
        SELECT id, nombre, saldo_pendiente 
        FROM clientes 
        WHERE id = :cid AND negocio_id = :nid 
        FOR UPDATE
    ");
    $stmt->execute(['cid' => $clienteId, 'nid' => $negocioId]);
    $cliente = $stmt->fetch();

    if (!$cliente) {
        throw new RuntimeException('Cliente no encontrado.');
    }

    $saldoAnterior = (float)$cliente['saldo_pendiente'];
    $saldoNuevo    = $tipo === 'cargo'
        ? round($saldoAnterior + $monto, 2)
        : max(0.0, round($saldoAnterior - $monto, 2));

    $upd = $db->prepare("UPDATE clientes SET saldo_pendiente = :nuevo WHERE id = :cid AND negocio_id = :nid");
    $upd->execute(['nuevo' => $saldoNuevo, 'cid' => $clienteId, 'nid' => $negocioId]);

    $ins = $db->prepare("
        INSERT INTO abonos_clientes 
            (negocio_id, cliente_id, usuario_id, monto, metodo_pago, notas, saldo_anterior, saldo_nuevo)
        VALUES 
            (:nid, :cid, :uid, :monto, :metodo, :notas, :ant, :nuevo)
    ");
    $ins->execute([
        'nid'    => $negocioId,
        'cid'    => $clienteId,
        'uid'    => $usuarioId,
        'monto'  => $tipo === 'cargo' ? -$monto : $monto,
        'metodo' => $metodoPago,
        'notas'  => $notas ?: ($tipo === 'cargo' ? 'Nuevo crédito directo registrado' : 'Abono de cuenta'),
        'ant'    => $saldoAnterior,
        'nuevo'  => $saldoNuevo
    ]);

    $db->commit();

    Response::json([
        'message'         => $tipo === 'cargo' ? 'Crédito directo registrado.' : 'Abono registrado exitosamente.',
        'saldo_pendiente' => $saldoNuevo
    ]);
} catch (Throwable $e) {
    $db->rollBack();
    Response::json(['error' => $e->getMessage()], 400);
}
