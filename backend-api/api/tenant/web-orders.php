<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/AuthMiddleware.php';
require_once __DIR__ . '/../../core/AccountingService.php';
require_once __DIR__ . '/../../core/Response.php';

// SRI libraries for automated billing on confirmation
require_once __DIR__ . '/../../core/SriCrypto.php';
require_once __DIR__ . '/../../core/sri/SriDocumentoFactory.php';
require_once __DIR__ . '/../../core/sri/SriSigner.php';
require_once __DIR__ . '/../../core/sri/SriSoapClient.php';
require_once __DIR__ . '/../../core/sri/SriRideGenerator.php';
require_once __DIR__ . '/../../core/MailerService.php';

$session   = AuthMiddleware::authenticate();
$negocioId = (int)$session['negocio_id'];
$usuarioId = (int)$session['user_id'];
$db        = Database::getConnection();

$method = $_SERVER['REQUEST_METHOD'];
$action = trim((string)($_GET['action'] ?? ''));

// =========================================================================
// 1. GET: LISTADO, DETALLE Y MÉTRICAS DE PEDIDOS WEB
// =========================================================================
if ($method === 'GET') {
    $pedidoId = isset($_GET['id']) ? (int)$_GET['id'] : 0;

    // Detalle individual
    if ($pedidoId > 0) {
        $stmt = $db->prepare("
            SELECT pw.*, 
                   v.estado AS venta_estado, v.metodo_pago AS venta_metodo_pago,
                   ac.numero_asiento, ac.estado AS asiento_estado, ac.concepto AS asiento_concepto
            FROM pedidos_web pw
            LEFT JOIN ventas v ON v.id = pw.venta_id
            LEFT JOIN asientos_contables ac ON ac.id = pw.asiento_id
            WHERE pw.id = :id AND pw.negocio_id = :nid
            LIMIT 1
        ");
        $stmt->execute(['id' => $pedidoId, 'nid' => $negocioId]);
        $pedido = $stmt->fetch();

        if (!$pedido) {
            Response::json(['error' => 'Pedido web no encontrado.'], 404);
        }

        // Obtener detalles de productos
        $stmtDet = $db->prepare("
            SELECT pwd.*, p.codigo_barra, p.stock AS stock_actual, p.imagen_url
            FROM pedido_web_detalles pwd
            LEFT JOIN productos p ON p.id = pwd.producto_id
            WHERE pwd.pedido_id = :pid
            ORDER BY pwd.id ASC
        ");
        $stmtDet->execute(['pid' => $pedidoId]);
        $pedido['detalles'] = $stmtDet->fetchAll();

        // Obtener comprobante SRI si existe
        if (!empty($pedido['factura_id'])) {
            $stmtSri = $db->prepare("
                SELECT id, clave_acceso, numero_comprobante, estado_sri AS estado, 
                       fecha_autorizacion AS autorizacion_fecha, pdf_ride_path AS pdf_ride_url, xml_autorizado
                FROM comprobantes_electronicos_sri
                WHERE id = :fid AND negocio_id = :nid
                LIMIT 1
            ");
            $stmtSri->execute(['fid' => $pedido['factura_id'], 'nid' => $negocioId]);
            $pedido['comprobante_sri'] = $stmtSri->fetch() ?: null;
        } else {
            $pedido['comprobante_sri'] = null;
        }

        // Datos del negocio para rótulos y comprobantes
        $stmtNegInfo = $db->prepare("SELECT nombre, ruc_nit, telefono, direccion, logo_url FROM negocios WHERE id = :nid LIMIT 1");
        $stmtNegInfo->execute(['nid' => $negocioId]);
        $pedido['negocio'] = $stmtNegInfo->fetch() ?: [];

        Response::json(['success' => true, 'pedido' => $pedido]);
    }

    // Listado paginado con filtros y métricas
    $estado    = trim((string)($_GET['estado'] ?? ''));
    $busqueda  = trim((string)($_GET['busqueda'] ?? ''));
    $desde     = trim((string)($_GET['desde'] ?? ''));
    $hasta     = trim((string)($_GET['hasta'] ?? ''));
    $page      = max(1, (int)($_GET['page'] ?? 1));
    $limit     = min(100, max(1, (int)($_GET['limit'] ?? 10)));
    $offset    = ($page - 1) * $limit;

    $where = ["pw.negocio_id = :nid"];
    $params = ['nid' => $negocioId];

    if (!empty($estado) && in_array($estado, ['pendiente', 'confirmado', 'enviado', 'entregado', 'cancelado'], true)) {
        $where[] = "pw.estado = :estado";
        $params['estado'] = $estado;
    }

    if (!empty($busqueda)) {
        $where[] = "(pw.numero_pedido LIKE :q OR pw.cliente_nombre LIKE :q OR pw.cliente_documento LIKE :q OR pw.cliente_email LIKE :q OR pw.cliente_telefono LIKE :q OR pw.cliente_direccion LIKE :q OR pw.motorizado_nombre LIKE :q OR pw.courier_nombre LIKE :q OR pw.guia_envio LIKE :q)";
        $params['q'] = '%' . $busqueda . '%';
    }

    if (!empty($desde)) {
        $where[] = "DATE(pw.created_at) >= :desde";
        $params['desde'] = $desde;
    }
    if (!empty($hasta)) {
        $where[] = "DATE(pw.created_at) <= :hasta";
        $params['hasta'] = $hasta;
    }

    $whereSql = implode(' AND ', $where);

    // Contar total con filtros
    $countStmt = $db->prepare("SELECT COUNT(*) FROM pedidos_web pw WHERE {$whereSql}");
    $countStmt->execute($params);
    $totalFiltrados = (int)$countStmt->fetchColumn();

    // Obtener pedidos
    $sql = "
        SELECT 
            pw.id, pw.numero_pedido, pw.cliente_nombre, pw.cliente_documento,
            pw.cliente_telefono, pw.cliente_email, pw.cliente_ciudad, pw.cliente_direccion, pw.ubicacion_gps,
            pw.metodo_pago, pw.comprobante_pago_url, pw.subtotal, pw.costo_envio,
            pw.impuesto, pw.total, pw.estado, pw.tipo_despacho, pw.motorizado_nombre, pw.motorizado_telefono,
            pw.courier_nombre, pw.courier_telefono, pw.guia_envio, pw.notas,
            pw.venta_id, pw.asiento_id, pw.factura_id,
            pw.created_at, pw.updated_at,
            (SELECT COUNT(*) FROM pedido_web_detalles WHERE pedido_id = pw.id) AS items_count
        FROM pedidos_web pw
        WHERE {$whereSql}
        ORDER BY pw.id DESC
        LIMIT {$limit} OFFSET {$offset}
    ";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $pedidos = $stmt->fetchAll();

    // Métricas globales del canal web para este negocio
    $stmtMetrics = $db->prepare("
        SELECT 
            COUNT(*) AS total_pedidos,
            SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END) AS pendientes_count,
            COALESCE(SUM(CASE WHEN estado = 'pendiente' THEN total ELSE 0 END), 0) AS pendientes_monto,
            SUM(CASE WHEN estado = 'confirmado' THEN 1 ELSE 0 END) AS confirmados_count,
            COALESCE(SUM(CASE WHEN estado = 'confirmado' THEN total ELSE 0 END), 0) AS confirmados_monto,
            SUM(CASE WHEN estado = 'enviado' THEN 1 ELSE 0 END) AS enviados_count,
            SUM(CASE WHEN estado = 'entregado' THEN 1 ELSE 0 END) AS entregados_count,
            COALESCE(SUM(CASE WHEN estado = 'entregado' THEN total ELSE 0 END), 0) AS entregados_monto,
            SUM(CASE WHEN estado = 'cancelado' THEN 1 ELSE 0 END) AS cancelados_count
        FROM pedidos_web
        WHERE negocio_id = :nid
    ");
    $stmtMetrics->execute(['nid' => $negocioId]);
    $metricas = $stmtMetrics->fetch();

    // Datos del negocio para la tienda
    $stmtNeg = $db->prepare("
        SELECT slug, descripcion, datos_bancarios, telefono, whatsapp_contacto, direccion, ciudad, costo_envio_fijo, costo_envio_local, costo_envio_nacional, tienda_online_activa
        FROM negocios
        WHERE id = :nid
        LIMIT 1
    ");
    $stmtNeg->execute(['nid' => $negocioId]);
    $configTienda = $stmtNeg->fetch();

    Response::json([
        'success'        => true,
        'pedidos'        => $pedidos,
        'metricas'       => $metricas,
        'config_tienda'  => $configTienda,
        'paginacion'     => [
            'total'        => $totalFiltrados,
            'page'         => $page,
            'limit'        => $limit,
            'total_pages'  => (int)ceil($totalFiltrados / $limit)
        ]
    ]);
}

// =========================================================================
// 2. POST: GESTIÓN DE ESTADOS Y TRANSACCIONES
// =========================================================================
if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];

    // --- ACCIÓN: ACTUALIZAR CONFIGURACIÓN DE LA TIENDA B2C ---
    if ($action === 'actualizar_tienda') {
        $descripcion         = trim((string)($input['descripcion'] ?? ''));
        $datosBancarios      = trim((string)($input['datos_bancarios'] ?? ''));
        $telefono            = trim((string)($input['telefono'] ?? ''));
        $whatsappContacto    = trim((string)($input['whatsapp_contacto'] ?? ''));
        $ciudad              = trim((string)($input['ciudad'] ?? 'Ibarra'));
        $costoEnvioFijo      = max(0.0, (float)($input['costo_envio_fijo'] ?? 0.0));
        $costoEnvioLocal     = max(0.0, (float)($input['costo_envio_local'] ?? 2.0));
        $costoEnvioNacional  = max(0.0, (float)($input['costo_envio_nacional'] ?? 5.0));
        $tiendaOnlineActiva  = isset($input['tienda_online_activa']) ? ((int)$input['tienda_online_activa'] ? 1 : 0) : 1;

        if (empty($whatsappContacto) && !empty($telefono)) {
            $whatsappContacto = $telefono;
        } elseif (empty($telefono) && !empty($whatsappContacto)) {
            $telefono = $whatsappContacto;
        }

        $updateNeg = $db->prepare("
            UPDATE negocios
            SET descripcion = :desc,
                datos_bancarios = :banco,
                telefono = :tel,
                whatsapp_contacto = :wsp,
                ciudad = :ciu,
                costo_envio_fijo = :env,
                costo_envio_local = :env_loc,
                costo_envio_nacional = :env_nac,
                tienda_online_activa = :act
            WHERE id = :nid
        ");
        $updateNeg->execute([
            'desc'    => $descripcion ?: null,
            'banco'   => $datosBancarios ?: null,
            'tel'     => $telefono ?: null,
            'wsp'     => $whatsappContacto ?: null,
            'ciu'     => $ciudad ?: 'Ibarra',
            'env'     => $costoEnvioFijo,
            'env_loc' => $costoEnvioLocal,
            'env_nac' => $costoEnvioNacional,
            'act'     => $tiendaOnlineActiva,
            'nid'     => $negocioId
        ]);

        Response::json([
            'success' => true,
            'mensaje' => 'Configuración de la tienda online B2C actualizada con éxito.'
        ]);
    }

    $pedidoId = (int)($input['id'] ?? $input['pedido_id'] ?? 0);
    if ($pedidoId <= 0) {
        Response::json(['error' => 'ID de pedido requerido.'], 422);
    }

    // Buscar pedido
    $stmtPed = $db->prepare("
        SELECT *
        FROM pedidos_web
        WHERE id = :id AND negocio_id = :nid
        LIMIT 1
    ");
    $stmtPed->execute(['id' => $pedidoId, 'nid' => $negocioId]);
    $pedido = $stmtPed->fetch();

    if (!$pedido) {
        Response::json(['error' => 'Pedido no encontrado en este negocio.'], 404);
    }

    // --- ACCIÓN: CONFIRMAR PAGO DEL PEDIDO ---
    // Promueve el asiento borrador a mayorizado, completa la venta y dispara factura SRI
    if ($action === 'confirmar') {
        if ($pedido['estado'] !== 'pendiente') {
            Response::json(['error' => "El pedido ya no está pendiente (estado actual: {$pedido['estado']})."], 400);
        }

        try {
            $db->beginTransaction();

            // 1. Actualizar estado del pedido a 'confirmado'
            $db->prepare("
                UPDATE pedidos_web
                SET estado = 'confirmado', updated_at = NOW()
                WHERE id = :id AND negocio_id = :nid
            ")->execute(['id' => $pedidoId, 'nid' => $negocioId]);

            // 2. Actualizar estado de la venta a 'completada'
            if (!empty($pedido['venta_id'])) {
                $db->prepare("
                    UPDATE ventas
                    SET estado = 'completada', monto_recibido = total
                    WHERE id = :vid AND negocio_id = :nid
                ")->execute(['vid' => $pedido['venta_id'], 'nid' => $negocioId]);
            }

            // 3. Promover Asiento Contable de 'borrador' a 'mayorizado' (Inmutabilidad Contable)
            $asientoId = (int)($pedido['asiento_id'] ?? 0);
            if ($asientoId > 0) {
                $db->prepare("
                    UPDATE asientos_contables
                    SET estado = 'mayorizado',
                        concepto = REPLACE(concepto, '(BORRADOR)', '(MAYORIZADO)'),
                        updated_at = NOW()
                    WHERE id = :aid AND negocio_id = :nid
                ")->execute(['aid' => $asientoId, 'nid' => $negocioId]);
            }

            // 4. Emisión automática de Factura Electrónica SRI si está configurada
            $sriEmitido = false;
            $sriMensaje = null;
            $facturaIdGenerada = null;

            $stmtSriCfg = $db->prepare("SELECT * FROM configuracion_sri WHERE negocio_id = :nid LIMIT 1");
            $stmtSriCfg->execute(['nid' => $negocioId]);
            $sriConfig = $stmtSriCfg->fetch();

            if ($sriConfig && !empty($pedido['venta_id'])) {
                try {
                    $stmtV = $db->prepare("SELECT * FROM ventas WHERE id = :vid AND negocio_id = :nid LIMIT 1");
                    $stmtV->execute(['vid' => $pedido['venta_id'], 'nid' => $negocioId]);
                    $ventaData = $stmtV->fetch();

                    $clienteData = [
                        'documento' => $pedido['cliente_documento'] ?: '9999999999999',
                        'nombre'    => $pedido['cliente_nombre'] ?: 'CONSUMIDOR FINAL',
                        'email'     => $pedido['cliente_email'] ?: '',
                        'telefono'  => $pedido['cliente_telefono'] ?: '',
                        'direccion' => $pedido['cliente_direccion'] ?: 'Ecuador',
                    ];

                    $stmtItems = $db->prepare("
                        SELECT vd.*, COALESCE(p.sri_tarifa_iva, 15.00) as tarifa_iva, p.codigo_barra as producto_codigo
                        FROM venta_detalles vd
                        LEFT JOIN productos p ON p.id = vd.producto_id
                        WHERE vd.venta_id = :vid AND vd.negocio_id = :nid
                    ");
                    $stmtItems->execute(['vid' => $pedido['venta_id'], 'nid' => $negocioId]);
                    $detallesData = $stmtItems->fetchAll();

                    if ($ventaData && !empty($detallesData)) {
                        $serie = sprintf('%03d%03d', (int)$sriConfig['codigo_establecimiento'], (int)$sriConfig['punto_emision']);
                        $stmtCorr = $db->prepare("
                            SELECT COALESCE(MAX(secuencial), 0) + 1 
                            FROM comprobantes_electronicos_sri 
                            WHERE negocio_id = :nid AND tipo_documento = '01' AND serie = :serie
                        ");
                        $stmtCorr->execute(['nid' => $negocioId, 'serie' => $serie]);
                        $secuencial = (int)$stmtCorr->fetchColumn();

                        $facturaObj = SriDocumentoFactory::crearFactura(
                            $sriConfig,
                            $clienteData,
                            $ventaData,
                            $detallesData,
                            $serie,
                            $secuencial,
                            (int)$sriConfig['ambiente'],
                            (int)$sriConfig['tipo_emision']
                        );

                        $xmlGenerado   = $facturaObj->generarXml();
                        $claveAcceso   = $facturaObj->getClaveAcceso();
                        $numComprobante = $facturaObj->getNumeroComprobante();

                        $xmlFinal = $xmlGenerado;
                        $firmado = false;

                        if (!empty($sriConfig['firma_p12_path']) && file_exists($sriConfig['firma_p12_path']) && !empty($sriConfig['firma_password_enc'])) {
                            $p12Pass = SriCrypto::decrypt($sriConfig['firma_password_enc']);
                            $xmlFinal = SriSigner::signXml($xmlGenerado, $sriConfig['firma_p12_path'], $p12Pass);
                            $firmado = true;
                        }

                        $soapClient = new SriSoapClient((int)$sriConfig['ambiente']);
                        $estadoSri = 'PENDIENTE';
                        $mensajeSri = '';
                        $numAutorizacion = null;
                        $fechaAutorizacion = null;

                        if ($firmado) {
                            $resRecep = $soapClient->enviarComprobante($xmlFinal);
                            if ($resRecep['success']) {
                                usleep(1500000);
                                $resAut = $soapClient->consultarAutorizacion($claveAcceso);
                                if ($resAut['success']) {
                                    $estadoSri = 'AUTORIZADO';
                                    $numAutorizacion = $resAut['numero_autorizacion'];
                                    $fechaAutorizacion = $resAut['fecha_autorizacion'];
                                    $mensajeSri = 'Factura AUTORIZADA legalmente por el SRI.';
                                } else {
                                    $estadoSri = $resAut['estado'] ?: 'EN_PROCESAMIENTO';
                                    $mensajeSri = $resAut['mensaje'] ?: 'Comprobante en procesamiento.';
                                }
                            } else {
                                $estadoSri = $resRecep['estado'];
                                $mensajeSri = $resRecep['mensaje'];
                            }
                        } else {
                            $estadoSri = 'AUTORIZADO';
                            $numAutorizacion = $claveAcceso;
                            $fechaAutorizacion = date('Y-m-d H:i:s');
                            $mensajeSri = 'Factura generada en modo Pruebas internas (sin .p12).';
                        }

                        // Guardar en comprobantes_electronicos_sri
                        $insSri = $db->prepare("
                            INSERT INTO comprobantes_electronicos_sri
                                (negocio_id, tipo_documento, origen_tipo, origen_id, serie, secuencial, numero_comprobante, clave_acceso, fecha_emision, ambiente, estado_sri, mensaje_sri, numero_autorizacion, fecha_autorizacion, xml_firmado, xml_autorizado, asiento_id)
                            VALUES
                                (:nid, '01', 'venta', :vid, :serie, :sec, :num, :clave, :fec, :amb, :est, :msg, :naut, :faut, :xmlf, :xmla, :aid)
                        ");
                        $insSri->execute([
                            'nid'   => $negocioId,
                            'vid'   => $pedido['venta_id'],
                            'serie' => $serie,
                            'sec'   => $secuencial,
                            'num'   => $numComprobante,
                            'clave' => $claveAcceso,
                            'fec'   => date('Y-m-d'),
                            'amb'   => (int)$sriConfig['ambiente'],
                            'est'   => $estadoSri,
                            'msg'   => $mensajeSri,
                            'naut'  => $numAutorizacion,
                            'faut'  => $fechaAutorizacion,
                            'xmlf'  => $xmlFinal,
                            'xmla'  => ($estadoSri === 'AUTORIZADO') ? $xmlFinal : null,
                            'aid'   => $asientoId ?: null
                        ]);
                        $facturaIdGenerada = (int)$db->lastInsertId();

                        // Asociar factura con el pedido web
                        $db->prepare("UPDATE pedidos_web SET factura_id = :fid WHERE id = :pid")
                           ->execute(['fid' => $facturaIdGenerada, 'pid' => $pedidoId]);

                        $sriEmitido = true;
                        $sriMensaje = "Factura SRI emitida: {$numComprobante} ({$estadoSri})";
                    }
                } catch (Throwable $eSri) {
                    error_log("Error SRI automático en pedido web: " . $eSri->getMessage());
                    $sriMensaje = "Pago confirmado. SRI pendiente: " . $eSri->getMessage();
                }
            }

            $db->commit();

            Response::json([
                'success'      => true,
                'mensaje'      => '¡Pedido web confirmado con éxito! El pago fue validado y el asiento contable fue mayorizado.',
                'pedido_id'    => $pedidoId,
                'nuevo_estado' => 'confirmado',
                'sri_emitido'  => $sriEmitido,
                'sri_detalle'  => $sriMensaje,
                'factura_id'   => $facturaIdGenerada
            ]);

        } catch (Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            Response::json(['error' => 'Error al confirmar pedido: ' . $e->getMessage()], 500);
        }
    }

    // --- ACCIÓN: CANCELAR PEDIDO (REVERSA DE STOCK Y CONTABILIDAD INMUTABLE) ---
    if ($action === 'cancelar') {
        if ($pedido['estado'] === 'cancelado') {
            Response::json(['error' => 'El pedido ya se encuentra cancelado.'], 400);
        }

        $motivo = trim((string)($input['motivo'] ?? 'Cancelado por el administrador'));

        try {
            $db->beginTransaction();

            // 1. Restaurar stock de los productos
            $stmtDet = $db->prepare("SELECT producto_id, cantidad FROM pedido_web_detalles WHERE pedido_id = :pid");
            $stmtDet->execute(['pid' => $pedidoId]);
            $itemsACancelar = $stmtDet->fetchAll();

            $stmtRestoreStock = $db->prepare("
                UPDATE productos
                SET stock = stock + :cant
                WHERE id = :pid AND negocio_id = :nid
            ");
            foreach ($itemsACancelar as $item) {
                $stmtRestoreStock->execute([
                    'cant' => $item['cantidad'],
                    'pid'  => $item['producto_id'],
                    'nid'  => $negocioId
                ]);
            }

            // 2. Manejo contable estricto (Principio de Inmutabilidad)
            $asientoId = (int)($pedido['asiento_id'] ?? 0);
            if ($asientoId > 0) {
                $stmtAs = $db->prepare("SELECT * FROM asientos_contables WHERE id = :aid AND negocio_id = :nid LIMIT 1");
                $stmtAs->execute(['aid' => $asientoId, 'nid' => $negocioId]);
                $asientoOriginal = $stmtAs->fetch();

                if ($asientoOriginal) {
                    if ($asientoOriginal['estado'] === 'borrador') {
                        // Si estaba en borrador, simplemente se marca como anulado
                        $db->prepare("
                            UPDATE asientos_contables 
                            SET estado = 'anulado', concepto = CONCAT(concepto, ' - ANULADO: ', :motivo)
                            WHERE id = :aid
                        ")->execute(['motivo' => $motivo, 'aid' => $asientoId]);
                    } elseif ($asientoOriginal['estado'] === 'mayorizado') {
                        // Si ya estaba mayorizado, NUNCA SE BORRA: se genera un Asiento de Reversión
                        $stmtLineas = $db->prepare("SELECT * FROM detalles_asiento WHERE asiento_id = :aid");
                        $stmtLineas->execute(['aid' => $asientoId]);
                        $lineasOriginales = $stmtLineas->fetchAll();

                        $stmtNumAs = $db->prepare("SELECT COALESCE(MAX(numero_asiento), 0) + 1 FROM asientos_contables WHERE negocio_id = :nid");
                        $stmtNumAs->execute(['nid' => $negocioId]);
                        $numRev = (int)$stmtNumAs->fetchColumn();

                        $insRev = $db->prepare("
                            INSERT INTO asientos_contables
                                (negocio_id, periodo_id, numero_asiento, fecha, tipo_asiento, concepto, origen, origen_id, total_debe, total_haber, estado, creado_por)
                            VALUES
                                (:nid, :pid, :num, :fec, 'AJUSTE', :glosa, 'ajuste_manual', :oid, :debe, :haber, 'mayorizado', :creador)
                        ");
                        $insRev->execute([
                            'nid'     => $negocioId,
                            'pid'     => $asientoOriginal['periodo_id'],
                            'num'     => $numRev,
                            'fec'     => date('Y-m-d'),
                            'glosa'   => "REVERSIÓN: Cancelación de Pedido Web {$pedido['numero_pedido']} ({$motivo})",
                            'oid'     => $asientoId,
                            'debe'    => $asientoOriginal['total_haber'], // Se invierten
                            'haber'   => $asientoOriginal['total_debe'],
                            'creador' => $usuarioId
                        ]);
                        $nuevoAsientoRevId = (int)$db->lastInsertId();

                        // Invertir Debe y Haber en las líneas
                        $insDetRev = $db->prepare("
                            INSERT INTO detalles_asiento (asiento_id, cuenta_id, linea, debe, haber, concepto, referencia_documento)
                            VALUES (:aid, :cid, :lin, :debe, :haber, :con, :ref)
                        ");
                        $lNum = 1;
                        foreach ($lineasOriginales as $lo) {
                            $insDetRev->execute([
                                'aid'   => $nuevoAsientoRevId,
                                'cid'   => $lo['cuenta_id'],
                                'lin'   => $lNum++,
                                'debe'  => $lo['haber'], // Reversa exacta
                                'haber' => $lo['debe'],  // Reversa exacta
                                'con'   => "Reversión: " . $lo['concepto'],
                                'ref'   => $pedido['numero_pedido']
                            ]);
                        }
                    }
                }
            }

            // 3. Anular venta si existe
            if (!empty($pedido['venta_id'])) {
                $db->prepare("
                    UPDATE ventas
                    SET estado = 'anulada'
                    WHERE id = :vid AND negocio_id = :nid
                ")->execute(['vid' => $pedido['venta_id'], 'nid' => $negocioId]);
            }

            // 4. Actualizar estado del pedido a 'cancelado'
            $db->prepare("
                UPDATE pedidos_web
                SET estado = 'cancelado',
                    notas = CONCAT(COALESCE(notas, ''), '\n[Cancelado]: ', :motivo),
                    updated_at = NOW()
                WHERE id = :id AND negocio_id = :nid
            ")->execute(['id' => $pedidoId, 'nid' => $negocioId, 'motivo' => $motivo]);

            $db->commit();

            Response::json([
                'success'      => true,
                'mensaje'      => 'Pedido cancelado con éxito. El inventario ha sido restituido y la contabilidad fue ajustada conforme a NIIF.',
                'pedido_id'    => $pedidoId,
                'nuevo_estado' => 'cancelado'
            ]);

        } catch (Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            Response::json(['error' => 'Error al cancelar el pedido: ' . $e->getMessage()], 500);
        }
    }

    // --- ACCIÓN: ACTUALIZAR ESTADO DE DESPACHO (ENVIADO / ENTREGADO) ---
    if ($action === 'cambiar_estado') {
        $nuevoEstado        = trim((string)($input['nuevo_estado'] ?? ''));
        $notasAdicionales   = trim((string)($input['notas'] ?? ''));
        $tipoDespacho       = isset($input['tipo_despacho']) && in_array($input['tipo_despacho'], ['motorizado', 'empresa'], true) ? $input['tipo_despacho'] : null;
        $motorizadoNombre   = isset($input['motorizado_nombre']) ? trim((string)$input['motorizado_nombre']) : null;
        $motorizadoTelefono = isset($input['motorizado_telefono']) ? trim((string)$input['motorizado_telefono']) : null;
        $courierNombre      = isset($input['courier_nombre']) ? trim((string)$input['courier_nombre']) : null;
        $courierTelefono    = isset($input['courier_telefono']) ? trim((string)$input['courier_telefono']) : null;
        $guiaEnvio          = isset($input['guia_envio']) ? trim((string)$input['guia_envio']) : null;

        if (!in_array($nuevoEstado, ['enviado', 'entregado', 'confirmado'], true)) {
            Response::json(['error' => 'Estado de despacho no válido.'], 422);
        }

        $stmtUp = $db->prepare("
            UPDATE pedidos_web
            SET estado = :est,
                tipo_despacho = CASE WHEN :despacho_set = 1 THEN :tipo_despacho ELSE tipo_despacho END,
                motorizado_nombre = CASE WHEN :moto_nom_set = 1 THEN :moto_nom ELSE motorizado_nombre END,
                motorizado_telefono = CASE WHEN :moto_tel_set = 1 THEN :moto_tel ELSE motorizado_telefono END,
                courier_nombre = CASE WHEN :courier_set = 1 THEN :courier ELSE courier_nombre END,
                courier_telefono = CASE WHEN :courier_tel_set = 1 THEN :courier_tel ELSE courier_telefono END,
                guia_envio = CASE WHEN :guia_set = 1 THEN :guia ELSE guia_envio END,
                notas = CASE 
                    WHEN :notas != '' THEN CONCAT(COALESCE(notas, ''), '\n', :notas)
                    ELSE notas
                END,
                updated_at = NOW()
            WHERE id = :id AND negocio_id = :nid
        ");
        $stmtUp->execute([
            'est'             => $nuevoEstado,
            'despacho_set'    => $tipoDespacho !== null ? 1 : 0,
            'tipo_despacho'   => $tipoDespacho ?: 'motorizado',
            'moto_nom_set'    => $motorizadoNombre !== null ? 1 : 0,
            'moto_nom'        => $motorizadoNombre ?: null,
            'moto_tel_set'    => $motorizadoTelefono !== null ? 1 : 0,
            'moto_tel'        => $motorizadoTelefono ?: null,
            'courier_set'     => $courierNombre !== null ? 1 : 0,
            'courier'         => $courierNombre ?: null,
            'courier_tel_set' => $courierTelefono !== null ? 1 : 0,
            'courier_tel'     => $courierTelefono ?: null,
            'guia_set'        => $guiaEnvio !== null ? 1 : 0,
            'guia'            => $guiaEnvio ?: null,
            'notas'           => $notasAdicionales,
            'id'              => $pedidoId,
            'nid'             => $negocioId
        ]);

        Response::json([
            'success'      => true,
            'mensaje'      => "Estado del pedido actualizado a '{$nuevoEstado}'.",
            'pedido_id'    => $pedidoId,
            'nuevo_estado' => $nuevoEstado
        ]);
    }

    Response::json(['error' => 'Acción no soportada.'], 400);
}
