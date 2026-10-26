<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/AccountingService.php';
require_once __DIR__ . '/../../core/Response.php';

$db = Database::getConnection();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::json(['error' => 'Método no permitido'], 405);
}

$input      = json_decode(file_get_contents('php://input'), true) ?? [];
$slug       = trim((string)($input['slug'] ?? ''));
$cliente    = (array)($input['cliente'] ?? []);
$metodoPago = trim((string)($input['metodo_pago'] ?? 'transferencia'));
$items      = (array)($input['items'] ?? []);
$notas      = trim((string)($input['notas'] ?? ''));

if (empty($slug)) {
    Response::json(['error' => 'Slug de negocio requerido.'], 400);
}

if (empty($cliente['nombre']) || empty($cliente['documento']) || empty($cliente['telefono']) || empty($cliente['direccion'])) {
    Response::json(['error' => 'Completa los datos de envío y facturación (Nombre, Cédula/RUC, Teléfono y Dirección).'], 422);
}

if (empty($items)) {
    Response::json(['error' => 'El carrito de compras está vacío.'], 422);
}

if (!in_array($metodoPago, ['transferencia', 'contra_entrega'], true)) {
    $metodoPago = 'transferencia';
}

// 1. Validar negocio y estado de suscripción SaaS
$stmtNeg = $db->prepare("
    SELECT id, nombre, slug, estado, fecha_expiracion, direccion, ciudad, costo_envio_fijo, costo_envio_local, costo_envio_nacional, datos_bancarios, telefono, whatsapp_contacto
    FROM negocios
    WHERE slug = :slug OR id = :id_alt
    LIMIT 1
");
$stmtNeg->execute([
    'slug'   => $slug,
    'id_alt' => is_numeric($slug) ? (int)$slug : 0
]);
$negocio = $stmtNeg->fetch();

if (!$negocio) {
    Response::json(['error' => 'Negocio no encontrado.'], 404);
}

$negocioId = (int)$negocio['id'];
$ahora = date('Y-m-d H:i:s');
if ($negocio['estado'] === 'inactivo' || ($negocio['fecha_expiracion'] && $ahora > $negocio['fecha_expiracion'])) {
    Response::json(['error' => 'La tienda no puede recibir pedidos en este momento porque su suscripción ha expirado.'], 403);
}

// 2. Procesar productos, validar stock y calcular valores
try {
    $db->beginTransaction();

    // Cálculo inteligente de envío: Local (misma ciudad) vs Fuera de la ciudad (nacional/courier)
    $ciudadTienda = (string)($negocio['ciudad'] ?? $negocio['direccion'] ?? 'Ibarra');
    $ciudadCliente = (string)($cliente['ciudad'] ?? '');

    $normalizar = function(string $str): string {
        $str = mb_strtolower(trim($str), 'UTF-8');
        $str = str_replace(
            ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü', 'à', 'è', 'ì', 'ò', 'ù'],
            ['a', 'e', 'i', 'o', 'u', 'n', 'u', 'a', 'e', 'i', 'o', 'u'],
            $str
        );
        return preg_replace('/[^a-z0-9]/', '', $str) ?? '';
    };

    $cTienda = $normalizar($ciudadTienda);
    $cCliente = $normalizar($ciudadCliente);

    // Si cliente no especificó ciudad, se asume la de la tienda; si son distintas, es fuera de ciudad
    $esMismaCiudad = ($cCliente === '' || $cTienda === '') 
        || (strpos($cCliente, $cTienda) !== false || strpos($cTienda, $cCliente) !== false);

    if ($esMismaCiudad) {
        $costoEnvio = round((float)($negocio['costo_envio_local'] ?? 2.00), 2);
    } else {
        $costoEnvio = round((float)($negocio['costo_envio_nacional'] ?? ($negocio['costo_envio_fijo'] ?: 5.00)), 2);
    }
    $subtotal15 = 0.0;
    $subtotal0  = 0.0;
    $ivaTotal   = 0.0;
    $costoTotal = 0.0;
    $detallesProcesados = [];

    $stmtProd = $db->prepare("
        SELECT id, nombre, precio_venta, precio_compra AS costo, stock, COALESCE(sri_tarifa_iva, 15.00) AS tarifa_iva
        FROM productos
        WHERE id = :pid AND negocio_id = :nid
        FOR UPDATE
    ");

    $stmtStock = $db->prepare("
        UPDATE productos 
        SET stock = stock - :cant 
        WHERE id = :pid AND negocio_id = :nid AND stock >= :cant
    ");

    foreach ($items as $it) {
        $pId = (int)($it['producto_id'] ?? 0);
        $cant = max(1, (float)($it['cantidad'] ?? 1));

        if ($pId <= 0) continue;

        $stmtProd->execute(['pid' => $pId, 'nid' => $negocioId]);
        $prod = $stmtProd->fetch();

        if (!$prod) {
            throw new Exception("El producto ID {$pId} ya no está disponible.");
        }

        if ((float)$prod['stock'] < $cant) {
            throw new Exception("Stock insuficiente para '{$prod['nombre']}'. Disponibles: {$prod['stock']} unidades.");
        }

        // Descontar stock inmediatamente
        $stmtStock->execute(['cant' => $cant, 'pid' => $pId, 'nid' => $negocioId]);
        if ($stmtStock->rowCount() === 0) {
            throw new Exception("No se pudo reservar el stock para '{$prod['nombre']}'.");
        }

        $pu = (float)$prod['precio_venta'];
        $costoU = (float)$prod['costo'];
        $tarifaIva = (float)$prod['tarifa_iva'];
        $subLinea = round($cant * $pu, 2);

        if ($tarifaIva > 0) {
            $subtotal15 += $subLinea;
            $ivaTotal   += round($subLinea * ($tarifaIva / 100), 2);
        } else {
            $subtotal0  += $subLinea;
        }

        $costoTotal += ($cant * $costoU);

        $detallesProcesados[] = [
            'producto_id'     => $pId,
            'nombre_producto' => $prod['nombre'],
            'cantidad'        => $cant,
            'precio_unitario' => $pu,
            'subtotal'        => $subLinea,
            'costo_unitario'  => $costoU,
            'tarifa_iva'      => $tarifaIva,
        ];
    }

    $subtotalGeneral = round($subtotal15 + $subtotal0, 2);
    $totalPedido = round($subtotalGeneral + $ivaTotal + $costoEnvio, 2);

    // 3. Generar número de pedido único
    $prefijo = 'WEB-' . date('Ym') . '-';
    $stmtNum = $db->prepare("
        SELECT COALESCE(MAX(id), 0) + 1 
        FROM pedidos_web 
        WHERE negocio_id = :nid
    ");
    $stmtNum->execute(['nid' => $negocioId]);
    $nextId = (int)$stmtNum->fetchColumn();
    $numeroPedido = sprintf('%s%04d', $prefijo, $nextId);

    // 4. Crear o buscar cliente en la BD del negocio
    $docLimpio = preg_replace('/\D/', '', $cliente['documento']);
    $stmtFindCli = $db->prepare("SELECT id FROM clientes WHERE documento = :doc AND negocio_id = :nid LIMIT 1");
    $stmtFindCli->execute(['doc' => $docLimpio, 'nid' => $negocioId]);
    $clienteId = $stmtFindCli->fetchColumn() ? (int)$stmtFindCli->fetchColumn() : null;

    if (!$clienteId) {
        $insCli = $db->prepare("
            INSERT INTO clientes (negocio_id, documento, nombre, email, telefono, direccion)
            VALUES (:nid, :doc, :nom, :email, :tel, :dir)
        ");
        $insCli->execute([
            'nid'   => $negocioId,
            'doc'   => $docLimpio,
            'nom'   => trim($cliente['nombre']),
            'email' => trim($cliente['email'] ?? ''),
            'tel'   => trim($cliente['telefono']),
            'dir'   => trim($cliente['direccion']),
        ]);
        $clienteId = (int)$db->lastInsertId();
    }

    // 5. Pre-generar la venta en estado 'pendiente' (Borrador comercial)
    $insVenta = $db->prepare("
        INSERT INTO ventas
            (negocio_id, usuario_id, cliente_id, origen, metodo_pago, subtotal, impuesto, total, monto_recibido, vuelto, estado)
        VALUES
            (:nid, NULL, :cid, 'web', :mp, :sub, :iva, :tot, 0.00, 0.00, 'pendiente')
    ");
    $insVenta->execute([
        'nid' => $negocioId,
        'cid' => $clienteId,
        'mp'  => ($metodoPago === 'tarjeta') ? 'tarjeta' : 'transferencia',
        'sub' => $subtotalGeneral,
        'iva' => $ivaTotal,
        'tot' => $totalPedido,
    ]);
    $ventaId = (int)$db->lastInsertId();

    // Guardar detalles de la venta
    $insVentaDet = $db->prepare("
        INSERT INTO venta_detalles
            (negocio_id, venta_id, producto_id, nombre_producto, cantidad, precio_unitario, subtotal)
        VALUES
            (:nid, :vid, :pid, :nom, :cant, :pu, :sub)
    ");
    foreach ($detallesProcesados as $dp) {
        $insVentaDet->execute([
            'nid'  => $negocioId,
            'vid'  => $ventaId,
            'pid'  => $dp['producto_id'],
            'nom'  => $dp['nombre_producto'],
            'cant' => $dp['cantidad'],
            'pu'   => $dp['precio_unitario'],
            'sub'  => $dp['subtotal'],
        ]);
    }

    // 6. Pre-generar Asiento Contable en estado 'borrador' (Inmutabilidad y Auditoría)
    // Se prepara el asiento pero queda en estado borrador hasta que el dueño confirme el pago
    AccountingService::seedBasicPlan($negocioId);
    $ctaCobroKey = ($metodoPago === 'transferencia') ? 'BANCOS' : 'CAJA_GENERAL';
    $ctaCobro    = AccountingService::getAccountBySystemKey($negocioId, $ctaCobroKey)
                ?: AccountingService::getAccountBySystemKey($negocioId, 'CAJA_GENERAL');
    $ctaVentas15 = AccountingService::getAccountBySystemKey($negocioId, 'VENTAS_GRAVADAS_15');
    $ctaVentas0  = AccountingService::getAccountBySystemKey($negocioId, 'VENTAS_TARIFA_0');
    $ctaIva      = AccountingService::getAccountBySystemKey($negocioId, 'IVA_VENTAS_15');
    $ctaCosto    = AccountingService::getAccountBySystemKey($negocioId, 'COSTO_VENTAS');
    $ctaInv      = AccountingService::getAccountBySystemKey($negocioId, 'INVENTARIO');

    $lineasBorrador = [];
    if ($ctaCobro) {
        $lineasBorrador[] = [
            'cuenta_id' => (int)$ctaCobro['id'],
            'debe'      => $totalPedido,
            'haber'     => 0.00,
            'concepto'  => "Pedido Web {$numeroPedido} ({$metodoPago}) - Pendiente Confirmación",
            'ref_doc'   => $numeroPedido
        ];
    }
    if ($subtotal15 > 0 && $ctaVentas15) {
        $lineasBorrador[] = [
            'cuenta_id' => (int)$ctaVentas15['id'],
            'debe'      => 0.00,
            'haber'     => $subtotal15,
            'concepto'  => "Ventas 15% Pedido Web {$numeroPedido}",
            'ref_doc'   => $numeroPedido
        ];
    }
    if ($subtotal0 > 0 && $ctaVentas0) {
        $lineasBorrador[] = [
            'cuenta_id' => (int)$ctaVentas0['id'],
            'debe'      => 0.00,
            'haber'     => $subtotal0,
            'concepto'  => "Ventas 0% Pedido Web {$numeroPedido}",
            'ref_doc'   => $numeroPedido
        ];
    }
    if ($ivaTotal > 0 && $ctaIva) {
        $lineasBorrador[] = [
            'cuenta_id' => (int)$ctaIva['id'],
            'debe'      => 0.00,
            'haber'     => $ivaTotal,
            'concepto'  => "IVA 15% Pedido Web {$numeroPedido}",
            'ref_doc'   => $numeroPedido
        ];
    }
    if ($costoEnvio > 0 && ($ctaVentas0 ?: $ctaVentas15)) {
        $ctaEnvio = $ctaVentas0 ?: $ctaVentas15;
        $lineasBorrador[] = [
            'cuenta_id' => (int)$ctaEnvio['id'],
            'debe'      => 0.00,
            'haber'     => $costoEnvio,
            'concepto'  => "Servicio de Envío Pedido Web {$numeroPedido}",
            'ref_doc'   => $numeroPedido
        ];
    }
    if ($costoTotal > 0 && $ctaCosto && $ctaInv) {
        $lineasBorrador[] = [
            'cuenta_id' => (int)$ctaCosto['id'],
            'debe'      => $costoTotal,
            'haber'     => 0.00,
            'concepto'  => "Costo de ventas Pedido Web {$numeroPedido}",
            'ref_doc'   => $numeroPedido
        ];
        $lineasBorrador[] = [
            'cuenta_id' => (int)$ctaInv['id'],
            'debe'      => 0.00,
            'haber'     => $costoTotal,
            'concepto'  => "Salida inventario Pedido Web {$numeroPedido}",
            'ref_doc'   => $numeroPedido
        ];
    }

    $asientoId = null;
    try {
        // Obtener o crear periodo contable actual
        $stmtPer = $db->prepare("SELECT id FROM periodos_contables WHERE negocio_id = :nid AND anio = :a AND mes = :m LIMIT 1");
        $stmtPer->execute(['nid' => $negocioId, 'a' => date('Y'), 'm' => date('n')]);
        $periodoId = (int)($stmtPer->fetchColumn() ?: 1);

        // Obtener usuario creador del negocio
        $stmtUsr = $db->prepare("SELECT id FROM usuarios WHERE negocio_id = :nid ORDER BY id ASC LIMIT 1");
        $stmtUsr->execute(['nid' => $negocioId]);
        $creadorId = (int)($stmtUsr->fetchColumn() ?: 1);

        // Obtener correlativo de asiento
        $stmtNumAs = $db->prepare("SELECT COALESCE(MAX(numero_asiento), 0) + 1 FROM asientos_contables WHERE negocio_id = :nid");
        $stmtNumAs->execute(['nid' => $negocioId]);
        $numAsiento = (int)$stmtNumAs->fetchColumn();

        $insAs = $db->prepare("
            INSERT INTO asientos_contables
                (negocio_id, periodo_id, numero_asiento, fecha, tipo_asiento, concepto, origen, origen_id, total_debe, total_haber, estado, creado_por)
            VALUES
                (:nid, :pid, :num, :fec, 'INGRESO', :glosa, 'venta_pos', :vid, :debe, :haber, 'borrador', :creador)
        ");
        $totalDebeBorrador = round($totalPedido + $costoTotal, 2);
        $totalHaberBorrador = round($subtotal15 + $subtotal0 + $ivaTotal + $costoEnvio + $costoTotal, 2);

        $insAs->execute([
            'nid'     => $negocioId,
            'pid'     => $periodoId,
            'num'     => $numAsiento,
            'fec'     => date('Y-m-d'),
            'glosa'   => "Pedido Web {$numeroPedido} - {$cliente['nombre']} (BORRADOR)",
            'vid'     => $ventaId,
            'debe'    => $totalDebeBorrador,
            'haber'   => $totalHaberBorrador,
            'creador' => $creadorId,
        ]);
        $asientoId = (int)$db->lastInsertId();

        $insDetAs = $db->prepare("
            INSERT INTO detalles_asiento (asiento_id, cuenta_id, linea, debe, haber, concepto, referencia_documento)
            VALUES (:aid, :cid, :lin, :debe, :haber, :con, :ref)
        ");
        $lineNum = 1;
        foreach ($lineasBorrador as $lb) {
            $insDetAs->execute([
                'aid'   => $asientoId,
                'cid'   => $lb['cuenta_id'],
                'lin'   => $lineNum++,
                'debe'  => $lb['debe'],
                'haber' => $lb['haber'],
                'con'   => $lb['concepto'],
                'ref'   => $lb['ref_doc'],
            ]);
        }
    } catch (Throwable $e) {
        error_log("Error al pre-generar asiento contable borrador: " . $e->getMessage());
    }

    // Actualizar asiento_id en la venta
    if ($asientoId) {
        $db->prepare("UPDATE ventas SET asiento_id = :aid WHERE id = :vid")->execute(['aid' => $asientoId, 'vid' => $ventaId]);
    }

    // 7. Guardar en pedidos_web
    $ubicacionGps = trim((string)($cliente['ubicacion_gps'] ?? ''));
    $insPed = $db->prepare("
        INSERT INTO pedidos_web
            (negocio_id, numero_pedido, cliente_nombre, cliente_documento, cliente_email, cliente_telefono, cliente_direccion, cliente_ciudad, ubicacion_gps, metodo_pago, subtotal, costo_envio, impuesto, total, estado, venta_id, asiento_id, notas)
        VALUES
            (:nid, :num, :nom, :doc, :email, :tel, :dir, :ciu, :gps, :mp, :sub, :env, :iva, :tot, 'pendiente', :vid, :aid, :notas)
    ");
    $insPed->execute([
        'nid'   => $negocioId,
        'num'   => $numeroPedido,
        'nom'   => trim($cliente['nombre']),
        'doc'   => $docLimpio,
        'email' => trim($cliente['email'] ?? ''),
        'tel'   => trim($cliente['telefono']),
        'dir'   => trim($cliente['direccion']),
        'ciu'   => trim($cliente['ciudad'] ?? 'Quito'),
        'gps'   => $ubicacionGps ?: null,
        'mp'    => $metodoPago,
        'sub'   => $subtotalGeneral,
        'env'   => $costoEnvio,
        'iva'   => $ivaTotal,
        'tot'   => $totalPedido,
        'vid'   => $ventaId,
        'aid'   => $asientoId,
        'notas' => $notas ?: null,
    ]);
    $pedidoId = (int)$db->lastInsertId();

    // Guardar detalles del pedido web
    $insPedDet = $db->prepare("
        INSERT INTO pedido_web_detalles
            (pedido_id, producto_id, nombre_producto, cantidad, precio_unitario, subtotal, costo_unitario)
        VALUES
            (:pid, :prod_id, :nom, :cant, :pu, :sub, :costo)
    ");
    foreach ($detallesProcesados as $dp) {
        $insPedDet->execute([
            'pid'     => $pedidoId,
            'prod_id' => $dp['producto_id'],
            'nom'     => $dp['nombre_producto'],
            'cant'    => $dp['cantidad'],
            'pu'      => $dp['precio_unitario'],
            'sub'     => $dp['subtotal'],
            'costo'   => $dp['costo_unitario'],
        ]);
    }

    $db->commit();

    Response::json([
        'success'            => true,
        'pedido_id'          => $pedidoId,
        'numero_pedido'      => $numeroPedido,
        'subtotal'           => $subtotalGeneral,
        'costo_envio'        => $costoEnvio,
        'impuesto'           => $ivaTotal,
        'total'              => $totalPedido,
        'metodo_pago'        => $metodoPago,
        'estado'             => 'pendiente',
        'cliente_direccion'  => trim($cliente['direccion']),
        'cliente_ciudad'     => trim($cliente['ciudad'] ?? 'Quito'),
        'ubicacion_gps'      => $ubicacionGps,
        'instrucciones_pago' => [
            'tipo'            => $metodoPago,
            'datos_bancarios' => $negocio['datos_bancarios'] ?: 'Por favor comunícate por WhatsApp con tu comprobante.',
            'telefono'        => $negocio['telefono'],
            'mensaje'         => ($metodoPago === 'transferencia')
                ? 'Tu pedido ha sido recibido y el stock reservado. Realiza la transferencia bancaria y sube tu comprobante o envíalo por WhatsApp para que despachemos tu orden.'
                : 'Tu pedido ha sido registrado con éxito. Te contactaremos para coordinar la entrega.',
        ],
    ], 201);

} catch (Throwable $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    Response::json(['error' => $e->getMessage()], 422);
}
