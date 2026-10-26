<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/AuthMiddleware.php';
require_once __DIR__ . '/../../core/Response.php';

$adminSession = AuthMiddleware::authenticate(true);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::json(['error' => 'Método no permitido'], 405);
}

$input      = json_decode(file_get_contents('php://input'), true) ?? [];
$negocioId  = (int)($input['negocio_id'] ?? 0);
$dias       = (int)($input['dias'] ?? 0);
$monto      = (float)($input['monto'] ?? 0.00);
$metodoPago = trim($input['metodo_pago'] ?? 'transferencia');
$notas      = trim($input['notas'] ?? '');

if ($negocioId <= 0 || !in_array($dias, [30, 180, 365], true)) {
    Response::json(['error' => 'Debes seleccionar un negocio válido y un plan de +30, +180 o +365 días.'], 422);
}

$db = Database::getConnection();
$stmt = $db->prepare("SELECT id, nombre, fecha_expiracion FROM negocios WHERE id = :id LIMIT 1");
$stmt->execute(['id' => $negocioId]);
$negocio = $stmt->fetch();

if (!$negocio) {
    Response::json(['error' => 'Negocio no encontrado.'], 404);
}

$ahora          = new DateTimeImmutable('now');
$expiracionPrev = new DateTimeImmutable($negocio['fecha_expiracion']);

$baseCalculo     = ($expiracionPrev > $ahora) ? $expiracionPrev : $ahora;
$nuevaExpiracion = $baseCalculo->modify("+{$dias} days")->format('Y-m-d H:i:s');

try {
    $db->beginTransaction();

    $upd = $db->prepare("
        UPDATE negocios 
        SET estado = 'activo', fecha_expiracion = :nueva_exp
        WHERE id = :id
    ");
    $upd->execute([
        'nueva_exp' => $nuevaExpiracion,
        'id'        => $negocioId
    ]);

    $insPago = $db->prepare("
        INSERT INTO pagos_saas 
            (negocio_id, aprobado_por, dias_agregados, monto, metodo_pago, notas, fecha_expiracion_previa, fecha_expiracion_nueva)
        VALUES 
            (:nid, :admin_id, :dias, :monto, :metodo, :notas, :prev, :nueva)
    ");
    $insPago->execute([
        'nid'      => $negocioId,
        'admin_id' => $adminSession['sub'],
        'dias'     => $dias,
        'monto'    => $monto,
        'metodo'   => $metodoPago,
        'notas'    => $notas ?: "Renovación +{$dias} días",
        'prev'     => $negocio['fecha_expiracion'],
        'nueva'    => $nuevaExpiracion
    ]);

    $db->commit();

    Response::json([
        'message'          => "Se añadieron +{$dias} días a {$negocio['nombre']} y su cuenta fue activada.",
        'estado'           => 'activo',
        'fecha_expiracion' => $nuevaExpiracion
    ]);
} catch (Throwable $e) {
    $db->rollBack();
    Response::json(['error' => 'Error al procesar la renovación.'], 500);
}
