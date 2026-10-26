<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/AuthMiddleware.php';
require_once __DIR__ . '/../../core/ImageUploader.php';
require_once __DIR__ . '/../../core/Response.php';

// Permitir acceso aun si la cuenta está expirada para que pueda renovar
$session = AuthMiddleware::authenticate(false, true);
$negocioId = (int)$session['negocio_id'];
$db = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'];

// Asegurar existencia de tablas
$db->exec("
    CREATE TABLE IF NOT EXISTS configuracion_saas (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        precio_mensual DECIMAL(10,2) NOT NULL DEFAULT 15.00,
        precio_anual DECIMAL(10,2) NOT NULL DEFAULT 130.00,
        dias_prueba INT NOT NULL DEFAULT 7,
        datos_bancarios TEXT NULL,
        whatsapp_soporte VARCHAR(50) NULL,
        email_soporte VARCHAR(150) NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS solicitudes_suscripcion (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        negocio_id INT UNSIGNED NOT NULL,
        plan_tipo ENUM('mensual', 'anual') NOT NULL DEFAULT 'mensual',
        dias INT NOT NULL DEFAULT 30,
        monto DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        banco_origen VARCHAR(100) NULL,
        numero_comprobante VARCHAR(100) NOT NULL,
        fecha_transferencia DATE NULL,
        comprobante_url VARCHAR(255) NULL,
        estado ENUM('pendiente', 'aprobado', 'rechazado') NOT NULL DEFAULT 'pendiente',
        motivo_rechazo VARCHAR(255) NULL,
        revisado_por INT UNSIGNED NULL,
        revisado_en DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX (negocio_id),
        INDEX (estado)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
");

// 1. OBTENER INFORMACIÓN DE PLANES Y ESTADO DE SUSCRIPCIÓN
if ($method === 'GET') {
    // Configuración general SaaS
    $stmtCfg = $db->query("SELECT * FROM configuracion_saas LIMIT 1");
    $cfg = $stmtCfg ? $stmtCfg->fetch() : null;
    $precioMensual = (float)($cfg['precio_mensual'] ?? 15.00);
    $precioAnual   = (float)($cfg['precio_anual'] ?? 130.00);
    $diasPrueba    = (int)($cfg['dias_prueba'] ?? 7);
    $datosBancarios= $cfg['datos_bancarios'] ?? "Banco Pichincha - Cta Corriente # 2100458921\nTitular: PymeWeb ERP S.A.S.\nRUC: 1793148921001";
    $whatsapp      = $cfg['whatsapp_soporte'] ?? '0985559516';

    // Estado del negocio
    $stmtNeg = $db->prepare("
        SELECT id, nombre, slug, estado, fecha_registro, fecha_expiracion,
               DATEDIFF(fecha_expiracion, NOW()) AS dias_restantes
        FROM negocios
        WHERE id = :nid
        LIMIT 1
    ");
    $stmtNeg->execute(['nid' => $negocioId]);
    $negocio = $stmtNeg->fetch();

    // Historial de solicitudes de este negocio
    $stmtHist = $db->prepare("
        SELECT id, plan_tipo, dias, monto, banco_origen, numero_comprobante, fecha_transferencia, comprobante_url, estado, motivo_rechazo, created_at, revisado_en
        FROM solicitudes_suscripcion
        WHERE negocio_id = :nid
        ORDER BY id DESC
        LIMIT 15
    ");
    $stmtHist->execute(['nid' => $negocioId]);
    $solicitudes = $stmtHist->fetchAll();

    Response::json([
        'success'         => true,
        'negocio'         => $negocio,
        'planes'          => [
            'mensual' => [
                'tipo'        => 'mensual',
                'nombre'      => 'Plan Mensual',
                'dias'        => 30,
                'precio'      => $precioMensual,
                'descripcion' => 'Acceso completo al ERP durante 30 días.'
            ],
            'anual'   => [
                'tipo'        => 'anual',
                'nombre'      => 'Paquete Anual (1 Año)',
                'dias'        => 365,
                'precio'      => $precioAnual,
                'descripcion' => 'Acceso completo al ERP durante 365 días con tarifa preferencial.'
            ]
        ],
        'dias_prueba'     => $diasPrueba,
        'datos_bancarios' => $datosBancarios,
        'whatsapp_soporte'=> $whatsapp,
        'solicitudes'     => $solicitudes
    ]);
}

// 2. REPORTAR PAGO POR TRANSFERENCIA BANCARIA
if ($method === 'POST') {
    // Si viene como multipart/form-data o json
    $input = !empty($_POST) ? $_POST : (json_decode(file_get_contents('php://input'), true) ?? []);

    $planTipo    = in_array($input['plan_tipo'] ?? '', ['mensual', 'anual'], true) ? $input['plan_tipo'] : 'mensual';
    $bancoOrigen = trim((string)($input['banco_origen'] ?? ''));
    $numeroComp  = trim((string)($input['numero_comprobante'] ?? ''));
    $fechaTrans  = trim((string)($input['fecha_transferencia'] ?? date('Y-m-d')));

    if (empty($numeroComp)) {
        Response::json(['error' => 'El número de comprobante o depósito es obligatorio.'], 422);
    }

    if (empty($bancoOrigen)) {
        Response::json(['error' => 'Indica el banco de origen desde donde realizaste la transferencia.'], 422);
    }

    // Obtener precios vigentes
    $stmtCfg = $db->query("SELECT * FROM configuracion_saas LIMIT 1");
    $cfg = $stmtCfg ? $stmtCfg->fetch() : null;
    $precioMensual = (float)($cfg['precio_mensual'] ?? 15.00);
    $precioAnual   = (float)($cfg['precio_anual'] ?? 130.00);
    $whatsapp      = $cfg['whatsapp_soporte'] ?? '0985559516';

    $dias = ($planTipo === 'anual') ? 365 : 30;
    $monto = ($planTipo === 'anual') ? $precioAnual : $precioMensual;

    // Procesar archivo de imagen si se adjuntó
    $comprobanteUrl = null;
    if (!empty($_FILES['comprobante']['name'])) {
        try {
            $comprobanteUrl = ImageUploader::uploadAndOptimize($_FILES['comprobante'], "comprobantes_saas/{$negocioId}", 1200);
        } catch (Throwable $e) {
            Response::json(['error' => 'Error al subir la imagen del comprobante: ' . $e->getMessage()], 422);
        }
    } elseif (!empty($input['comprobante_url'])) {
        $comprobanteUrl = trim((string)$input['comprobante_url']);
    }

    // Verificar si ya existe un comprobante con el mismo número pendiente
    $check = $db->prepare("SELECT id FROM solicitudes_suscripcion WHERE negocio_id = :nid AND numero_comprobante = :comp AND estado = 'pendiente' LIMIT 1");
    $check->execute(['nid' => $negocioId, 'comp' => $numeroComp]);
    if ($check->fetch()) {
        Response::json(['error' => 'Ya existe una solicitud pendiente de revisión con este mismo número de comprobante.'], 409);
    }

    $stmtIns = $db->prepare("
        INSERT INTO solicitudes_suscripcion
            (negocio_id, plan_tipo, dias, monto, banco_origen, numero_comprobante, fecha_transferencia, comprobante_url, estado)
        VALUES
            (:nid, :plan, :dias, :monto, :banco, :comp, :fec, :url, 'pendiente')
    ");
    $stmtIns->execute([
        'nid'   => $negocioId,
        'plan'  => $planTipo,
        'dias'  => $dias,
        'monto' => $monto,
        'banco' => $bancoOrigen,
        'comp'  => $numeroComp,
        'fec'   => $fechaTrans ?: date('Y-m-d'),
        'url'   => $comprobanteUrl
    ]);
    $solicitudId = (int)$db->lastInsertId();

    // Obtener datos del negocio para armar el mensaje de WhatsApp
    $stmtNeg = $db->prepare("SELECT nombre, slug FROM negocios WHERE id = :nid LIMIT 1");
    $stmtNeg->execute(['nid' => $negocioId]);
    $negocio = $stmtNeg->fetch();
    $negocioNombre = $negocio['nombre'] ?? "Mi Negocio";

    $textoWsp = "Hola Administrador de PymeWeb, he registrado un pago por transferencia bancaria para mi suscripción:\n\n"
              . "🏢 Negocio: {$negocioNombre}\n"
              . "📋 Plan: " . strtoupper($planTipo) . " (+{$dias} días)\n"
              . "💰 Monto: \${$monto} USD\n"
              . "🏦 Banco Origen: {$bancoOrigen}\n"
              . "🔖 N° Comprobante: {$numeroComp}\n"
              . "📅 Fecha: {$fechaTrans}\n\n"
              . "Por favor confirmar y activar mi suscripción. ¡Muchas gracias!";

    let_clean:
    $wspClean = preg_replace('/\D/', '', $whatsapp);
    if (str_starts_with($wspClean, '09') && strlen($wspClean) === 10) {
        $wspClean = '593' . substr($wspClean, 1);
    }
    $whatsappUrl = $wspClean ? "https://wa.me/{$wspClean}?text=" . rawurlencode($textoWsp) : null;

    Response::json([
        'success'        => true,
        'solicitud_id'   => $solicitudId,
        'message'        => 'Tu comprobante de transferencia ha sido registrado con éxito. El administrador revisará y activará tu plan a la brevedad.',
        'whatsapp_url'   => $whatsappUrl,
        'monto'          => $monto,
        'plan_tipo'      => $planTipo
    ]);
}

Response::json(['error' => 'Método no permitido.'], 405);
