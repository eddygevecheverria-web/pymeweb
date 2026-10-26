<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/AuthMiddleware.php';
require_once __DIR__ . '/../../core/ElectronicInvoiceService.php';
require_once __DIR__ . '/../../core/PdfInvoiceGenerator.php';
require_once __DIR__ . '/../../core/MailerService.php';
require_once __DIR__ . '/../../core/AccountingService.php';
require_once __DIR__ . '/../../core/Response.php';

$session   = AuthMiddleware::authenticate();
$negocioId = (int)$session['negocio_id'];
$usuarioId = (int)$session['sub'];
$db        = Database::getConnection();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::json(['error' => 'Método no permitido'], 405);
}

$input         = json_decode(file_get_contents('php://input'), true) ?? [];
$items         = $input['items'] ?? [];
$metodoPago    = $input['metodo_pago'] ?? 'efectivo'; // 'efectivo', 'transferencia', 'fiado'
$comprobanteTransferencia = trim((string)($input['comprobante_transferencia'] ?? $input['numero_comprobante_deposito'] ?? ''));
$montoRecibido = (float)($input['monto_recibido'] ?? 0);
$generarFactura= (bool)($input['generar_factura'] ?? true);

// Datos del cliente enviados desde el POS
$clienteId        = !empty($input['cliente_id']) ? (int)$input['cliente_id'] : null;
$clienteDocumento = trim($input['cliente_documento'] ?? '');
$clienteNombre    = trim($input['cliente_nombre'] ?? '');
$clienteEmail     = strtolower(trim($input['cliente_email'] ?? ''));
$clienteTelefono  = trim($input['cliente_telefono'] ?? '');
$clienteDireccion = trim($input['cliente_direccion'] ?? '');

if (empty($items) || !is_array($items)) {
    Response::json(['error' => 'El carrito de venta está vacío.'], 422);
}

// Normalizar método de pago (soporta credito_directo o fiado)
if ($metodoPago === 'credito_directo') {
    $metodoPago = 'fiado';
}

// Opciones permitidas: efectivo, transferencia, fiado (tarjeta eliminada por requerimiento)
if (!in_array($metodoPago, ['efectivo', 'transferencia', 'fiado'], true)) {
    Response::json(['error' => 'Método de pago no válido. Selecciona Efectivo, Transferencia o Crédito Directo.'], 422);
}

try {
    $db->beginTransaction();

    // 1. Manejo unificado del Cliente
    // Si no se pasó cliente_id pero se ingresó cédula/RUC o nombre, buscar si ya existe o crearlo automáticamente
    if (!$clienteId && ($clienteDocumento !== '' || $clienteNombre !== '')) {
        if ($clienteDocumento !== '') {
            $stmtFind = $db->prepare("SELECT id FROM clientes WHERE negocio_id = :nid AND documento = :doc LIMIT 1");
            $stmtFind->execute(['nid' => $negocioId, 'doc' => $clienteDocumento]);
            $clienteId = $stmtFind->fetchColumn() ? (int)$stmtFind->fetchColumn() : null;
        }

        if (!$clienteId) {
            $nombreFinal = $clienteNombre ?: 'Cliente ' . ($clienteDocumento ?: 'Sin Identificación');
            $stmtNewCli = $db->prepare("
                INSERT INTO clientes (negocio_id, documento, nombre, email, telefono, direccion)
                VALUES (:nid, :doc, :nom, :email, :tel, :dir)
            ");
            $stmtNewCli->execute([
                'nid'   => $negocioId,
                'doc'   => $clienteDocumento ?: null,
                'nom'   => $nombreFinal,
                'email' => $clienteEmail ?: null,
                'tel'   => $clienteTelefono ?: null,
                'dir'   => $clienteDireccion ?: null,
            ]);
            $clienteId = (int)$db->lastInsertId();
        } else {
            // Actualizar datos si se modificaron en el POS
            $stmtUpdCli = $db->prepare("
                UPDATE clientes
                SET nombre = COALESCE(NULLIF(:nom, ''), nombre),
                    email = COALESCE(NULLIF(:email, ''), email),
                    telefono = COALESCE(NULLIF(:tel, ''), telefono),
                    direccion = COALESCE(NULLIF(:dir, ''), direccion)
                WHERE id = :cid AND negocio_id = :nid
            ");
            $stmtUpdCli->execute([
                'nom'   => $clienteNombre,
                'email' => $clienteEmail,
                'tel'   => $clienteTelefono,
                'dir'   => $clienteDireccion,
                'cid'   => $clienteId,
                'nid'   => $negocioId
            ]);
        }
    }

    if ($metodoPago === 'fiado' && !$clienteId) {
        throw new RuntimeException('Para registrar una venta a Crédito Directo debes ingresar o seleccionar un cliente.');
    }

    // 2. Procesamiento de productos y stock
    $totalVenta         = 0.0;
    $detallesPreparados = [];

    $stmtProd = $db->prepare("
        SELECT id, nombre, precio_compra, precio_venta, stock
        FROM productos
        WHERE id = :id AND negocio_id = :nid AND activo = 1
        FOR UPDATE
    ");

    foreach ($items as $item) {
        $prodId   = (int)($item['producto_id'] ?? 0);
        $cantidad = (int)($item['cantidad'] ?? 0);

        if ($prodId <= 0 || $cantidad <= 0) {
            throw new RuntimeException('Cantidad inválida para uno de los productos.');
        }

        $stmtProd->execute(['id' => $prodId, 'nid' => $negocioId]);
        $producto = $stmtProd->fetch();

        if (!$producto) {
            throw new RuntimeException("El producto ID #{$prodId} no existe.");
        }

        if ((int)$producto['stock'] < $cantidad) {
            throw new RuntimeException("Stock insuficiente para '{$producto['nombre']}' (Disponible: {$producto['stock']}).");
        }

        $precioUnitario = (float)$producto['precio_venta'];
        $tarifaIva      = (float)($producto['sri_tarifa_iva'] ?? 15.00);
        $subtotalItem   = round($precioUnitario * $cantidad, 2);
        $totalVenta    += $subtotalItem;

        $detallesPreparados[] = [
            'producto_id'            => (int)$producto['id'],
            'nombre_producto'        => $producto['nombre'],
            'cantidad'               => $cantidad,
            'precio_compra_unitario' => (float)$producto['precio_compra'],
            'precio_unitario'        => $precioUnitario,
            'tarifa_iva'             => $tarifaIva,
            'subtotal'               => $subtotalItem
        ];
    }

    $totalVenta   = round($totalVenta, 2);
    $subtotalNeto = 0.0;
    foreach ($detallesPreparados as $det) {
        $tarifa = $det['tarifa_iva'];
        $base = ($tarifa > 0) ? round($det['subtotal'] / (1 + ($tarifa / 100)), 2) : $det['subtotal'];
        $subtotalNeto += $base;
    }
    $subtotalNeto = round($subtotalNeto, 2);
    $impuesto     = round($totalVenta - $subtotalNeto, 2);
    $subtotal     = $subtotalNeto;


    if ($metodoPago === 'efectivo') {
        if ($montoRecibido < $totalVenta) {
            throw new RuntimeException('El monto en efectivo recibido es menor al total a cobrar.');
        }
        $vuelto = round($montoRecibido - $totalVenta, 2);
    } else {
        $montoRecibido = $totalVenta;
        $vuelto        = 0.00;
    }

    // 3. Si es fiado, actualizar saldo pendiente del cliente
    if ($metodoPago === 'fiado' && $clienteId) {
        $updCliente = $db->prepare("
            UPDATE clientes 
            SET saldo_pendiente = saldo_pendiente + :monto 
            WHERE id = :cid AND negocio_id = :nid
        ");
        $updCliente->execute([
            'monto' => $totalVenta,
            'cid'   => $clienteId,
            'nid'   => $negocioId
        ]);
    }

    // 4. Guardar Venta
    $stmtVenta = $db->prepare("
        INSERT INTO ventas 
            (negocio_id, usuario_id, cliente_id, origen, metodo_pago, comprobante_transferencia, subtotal, impuesto, total, monto_recibido, vuelto, estado)
        VALUES 
            (:nid, :uid, :cid, 'pos', :metodo, :comptransf, :sub, :imp, :tot, :recibido, :vuelto, 'completada')
    ");
    $stmtVenta->execute([
        'nid'        => $negocioId,
        'uid'        => $usuarioId,
        'cid'        => $clienteId,
        'metodo'     => $metodoPago,
        'comptransf' => $metodoPago === 'transferencia' ? ($comprobanteTransferencia ?: null) : null,
        'sub'        => $subtotal,
        'imp'        => $impuesto,
        'tot'        => $totalVenta,
        'recibido'   => $montoRecibido,
        'vuelto'     => $vuelto
    ]);
    $ventaId = (int)$db->lastInsertId();

    // 5. Detalles y reducción de stock
    $stmtDet = $db->prepare("
        INSERT INTO venta_detalles 
            (venta_id, negocio_id, producto_id, nombre_producto, cantidad, precio_compra_unitario, precio_unitario, subtotal)
        VALUES 
            (:vid, :nid, :pid, :nombre, :cant, :pcompra, :pventa, :sub)
    ");
    $stmtStock = $db->prepare("
        UPDATE productos 
        SET stock = stock - :cant 
        WHERE id = :pid AND negocio_id = :nid
    ");

    foreach ($detallesPreparados as $det) {
        $stmtDet->execute([
            'vid'     => $ventaId,
            'nid'     => $negocioId,
            'pid'     => $det['producto_id'],
            'nombre'  => $det['nombre_producto'],
            'cant'    => $det['cantidad'],
            'pcompra' => $det['precio_compra_unitario'],
            'pventa'  => $det['precio_unitario'],
            'sub'     => $det['subtotal']
        ]);

        $stmtStock->execute([
            'cant' => $det['cantidad'],
            'pid'  => $det['producto_id'],
            'nid'  => $negocioId
        ]);
    }

    // 6. Generación Automática de Factura Electrónica (XML + PDF + Envío Correo)
    $facturaInfo = null;
    if ($generarFactura) {
        // Datos del Negocio
        $stmtNeg = $db->prepare("SELECT id, nombre, ruc_nit, telefono, direccion, logo_url FROM negocios WHERE id = :nid");
        $stmtNeg->execute(['nid' => $negocioId]);
        $negocio = $stmtNeg->fetch();

        // Datos del Cliente cargados de la base de datos
        $clienteData = [
            'documento' => $clienteDocumento ?: '9999999999',
            'nombre'    => $clienteNombre ?: 'Consumidor Final',
            'email'     => $clienteEmail,
            'telefono'  => $clienteTelefono,
            'direccion' => $clienteDireccion
        ];
        if ($clienteId) {
            $stmtCli = $db->prepare("SELECT id, documento, nombre, email, telefono, direccion FROM clientes WHERE id = :cid AND negocio_id = :nid");
            $stmtCli->execute(['cid' => $clienteId, 'nid' => $negocioId]);
            if ($rowCli = $stmtCli->fetch()) {
                $clienteData = array_merge($clienteData, array_filter($rowCli));
            }
        }

        // Correlativo automático por negocio
        $stmtCorr = $db->prepare("
            SELECT COALESCE(MAX(correlativo), 0) + 1 
            FROM facturas_electronicas 
            WHERE negocio_id = :nid AND serie = 'F001'
        ");
        $stmtCorr->execute(['nid' => $negocioId]);
        $correlativo = (int)$stmtCorr->fetchColumn();

        // Construir XML UBL 2.1 y JSON
        $comprobante = ElectronicInvoiceService::buildXmlAndJson(
            $negocio,
            $clienteData,
            ['subtotal' => $subtotal, 'impuesto' => $impuesto, 'total' => $totalVenta],
            $detallesPreparados,
            'F001',
            $correlativo
        );

        // Generar PDF
        $fechaHoy = date('Y-m-d H:i:s');
        $pdfContent = PdfInvoiceGenerator::generate(
            $negocio,
            $clienteData,
            $comprobante['numero_comprobante'],
            $fechaHoy,
            $subtotal,
            $impuesto,
            $totalVenta,
            $metodoPago,
            $detallesPreparados
        );

        // Enviar por correo con PDF y XML adjuntos
        $emailEnviado = false;
        if (!empty($clienteData['email']) && filter_var($clienteData['email'], FILTER_VALIDATE_EMAIL)) {
            $emailEnviado = MailerService::sendInvoiceEmail(
                $clienteData['email'],
                $clienteData['nombre'],
                $negocio,
                $comprobante['numero_comprobante'],
                $totalVenta,
                $comprobante['xml'],
                $comprobante['json'],
                $pdfContent
            );
        }

        // Guardar factura
        $insFact = $db->prepare("
            INSERT INTO facturas_electronicas
                (negocio_id, venta_id, cliente_id, serie, correlativo, numero_comprobante, cufe_hash, xml_content, json_content, email_enviado)
            VALUES
                (:nid, :vid, :cid, 'F001', :corr, :num, :hash, :xml, :json, :enviado)
        ");
        $insFact->execute([
            'nid'     => $negocioId,
            'vid'     => $ventaId,
            'cid'     => $clienteId,
            'corr'    => $correlativo,
            'num'     => $comprobante['numero_comprobante'],
            'hash'    => $comprobante['cufe_hash'],
            'xml'     => $comprobante['xml'],
            'json'    => $comprobante['json'],
            'enviado' => $emailEnviado ? 1 : 0
        ]);

        $updVenta = $db->prepare("UPDATE ventas SET comprobante_xml_json = :json WHERE id = :vid AND negocio_id = :nid");
        $updVenta->execute(['json' => $comprobante['json'], 'vid' => $ventaId, 'nid' => $negocioId]);

        $facturaInfo = [
            'numero_comprobante' => $comprobante['numero_comprobante'],
            'cufe_hash'          => $comprobante['cufe_hash'],
            'email_enviado'      => $emailEnviado,
            'pdf_base64'         => base64_encode($pdfContent),
            'xml'                => $comprobante['xml']
        ];
    }

    $db->commit();

    // 7. Generar Asiento Contable Automático de la Venta (Partida Doble NIIF)
    $asientoId = null;
    $numComprobanteContable = $facturaInfo['numero_comprobante'] ?? "VTA-" . str_pad((string)$ventaId, 6, '0', STR_PAD_LEFT);
    try {
        $asientoId = AccountingService::recordSaleEntry(
            $negocioId,
            $usuarioId,
            $ventaId,
            $numComprobanteContable,
            $metodoPago,
            $subtotal,
            $impuesto,
            $totalVenta,
            $detallesPreparados,
            $comprobanteTransferencia ?: null
        );

        if ($asientoId) {
            $updAsiento = $db->prepare("UPDATE ventas SET asiento_id = :aid WHERE id = :vid AND negocio_id = :nid");
            $updAsiento->execute(['aid' => $asientoId, 'vid' => $ventaId, 'nid' => $negocioId]);
        }
    } catch (Throwable $ex) {
        error_log("Error al generar asiento de venta: " . $ex->getMessage());
    }

    Response::json([
        'message'     => 'Venta y factura procesadas con éxito.',
        'venta_id'    => $ventaId,
        'asiento_id'  => $asientoId,
        'total'       => $totalVenta,
        'vuelto'      => $vuelto,
        'cliente_id'  => $clienteId,
        'metodo_pago' => $metodoPago,
        'factura'     => $facturaInfo
    ], 201);

} catch (Throwable $e) {
    $db->rollBack();
    Response::json(['error' => $e->getMessage()], 400);
}
