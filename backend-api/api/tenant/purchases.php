<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/AuthMiddleware.php';
require_once __DIR__ . '/../../core/AccountingService.php';
require_once __DIR__ . '/../../core/Response.php';

$session   = AuthMiddleware::authenticate();
$negocioId = (int)$session['negocio_id'];
$usuarioId = (int)$session['sub'];
$db        = Database::getConnection();
$method    = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $id = !empty($_GET['id']) ? (int)$_GET['id'] : null;

    if ($id) {
        $stmt = $db->prepare("
            SELECT 
                c.id, c.negocio_id, c.proveedor_id, c.usuario_id,
                c.numero_factura, c.fecha_emision, c.metodo_pago,
                c.subtotal_15, c.subtotal_0, c.iva, c.total,
                c.retencion_renta, c.retencion_iva, c.total_pagar,
                c.estado, c.asiento_id, c.observaciones, c.created_at,
                pr.ruc AS proveedor_ruc, pr.razon_social AS proveedor_nombre,
                u.nombre AS usuario_nombre,
                ac.numero_asiento AS asiento_numero
            FROM compras c
            JOIN proveedores pr ON pr.id = c.proveedor_id
            JOIN usuarios u ON u.id = c.usuario_id
            LEFT JOIN asientos_contables ac ON ac.id = c.asiento_id
            WHERE c.id = :id AND c.negocio_id = :nid
            LIMIT 1
        ");
        $stmt->execute(['id' => $id, 'nid' => $negocioId]);
        $compra = $stmt->fetch();

        if (!$compra) {
            Response::json(['error' => 'Compra no encontrada.'], 404);
        }

        $stmtDet = $db->prepare("
            SELECT 
                cd.id, cd.producto_id, cd.nombre_producto, cd.cantidad,
                cd.costo_unitario, cd.subtotal, cd.tarifa_iva, cd.valor_iva, cd.total
            FROM compra_detalles cd
            WHERE cd.compra_id = :cid AND cd.negocio_id = :nid
            ORDER BY cd.id ASC
        ");
        $stmtDet->execute(['cid' => $id, 'nid' => $negocioId]);
        $compra['detalles'] = $stmtDet->fetchAll();

        Response::json(['purchase' => $compra]);
    }

    $q           = trim($_GET['q'] ?? '');
    $provId      = !empty($_GET['proveedor_id']) ? (int)$_GET['proveedor_id'] : null;
    $fechaInicio = trim($_GET['fecha_inicio'] ?? '');
    $fechaFin    = trim($_GET['fecha_fin'] ?? '');
    $estado      = trim($_GET['estado'] ?? '');

    $sql = "
        SELECT 
            c.id, c.numero_factura, c.fecha_emision, c.metodo_pago,
            c.subtotal_15, c.subtotal_0, c.iva, c.total,
            c.retencion_renta, c.retencion_iva, c.total_pagar,
            c.estado, c.asiento_id, c.observaciones, c.created_at,
            pr.ruc AS proveedor_ruc, pr.razon_social AS proveedor_nombre,
            u.nombre AS usuario_nombre,
            ac.numero_asiento AS asiento_numero,
            COUNT(cd.id) AS total_items
        FROM compras c
        JOIN proveedores pr ON pr.id = c.proveedor_id
        JOIN usuarios u ON u.id = c.usuario_id
        LEFT JOIN asientos_contables ac ON ac.id = c.asiento_id
        LEFT JOIN compra_detalles cd ON cd.compra_id = c.id
        WHERE c.negocio_id = :nid
    ";
    $params = ['nid' => $negocioId];

    if ($provId !== null) {
        $sql .= " AND c.proveedor_id = :pid";
        $params['pid'] = $provId;
    }

    if ($estado !== '') {
        $sql .= " AND c.estado = :est";
        $params['est'] = $estado;
    }

    if ($fechaInicio !== '') {
        $sql .= " AND c.fecha_emision >= :fini";
        $params['fini'] = $fechaInicio;
    }

    if ($fechaFin !== '') {
        $sql .= " AND c.fecha_emision <= :ffin";
        $params['ffin'] = $fechaFin;
    }

    if ($q !== '') {
        $sql .= " AND (c.numero_factura LIKE :q OR pr.razon_social LIKE :q OR pr.ruc LIKE :q)";
        $params['q'] = "%{$q}%";
    }

    $sql .= " GROUP BY c.id ORDER BY c.fecha_emision DESC, c.id DESC LIMIT 100";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    Response::json(['purchases' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    $input          = json_decode(file_get_contents('php://input'), true) ?? [];
    $proveedorId    = (int)($input['proveedor_id'] ?? 0);
    $numeroFactura  = trim($input['numero_factura'] ?? '');
    $fechaEmision   = trim($input['fecha_emision'] ?? date('Y-m-d'));
    $metodoPago     = trim($input['metodo_pago'] ?? 'transferencia');
    $retRenta       = round((float)($input['retencion_renta'] ?? 0.0), 2);
    $retIva         = round((float)($input['retencion_iva'] ?? 0.0), 2);
    $observaciones  = trim($input['observaciones'] ?? '');
    $items          = (array)($input['items'] ?? []);

    if ($proveedorId <= 0) {
        Response::json(['error' => 'Debes seleccionar un proveedor válido.'], 422);
    }
    if ($numeroFactura === '') {
        Response::json(['error' => 'El número de factura física/electrónica del proveedor es obligatorio.'], 422);
    }
    if (empty($items)) {
        Response::json(['error' => 'Debes ingresar al menos un producto a la compra.'], 422);
    }
    if (!in_array($metodoPago, ['efectivo', 'transferencia', 'credito'], true)) {
        Response::json(['error' => 'Método de pago no válido.'], 422);
    }

    // Validar proveedor
    $stmtProv = $db->prepare("SELECT id, razon_social, ruc FROM proveedores WHERE id = :pid AND negocio_id = :nid AND activo = 1");
    $stmtProv->execute(['pid' => $proveedorId, 'nid' => $negocioId]);
    $proveedor = $stmtProv->fetch();
    if (!$proveedor) {
        Response::json(['error' => 'El proveedor especificado no existe o está inactivo.'], 422);
    }

    try {
        $db->beginTransaction();

        $subtotal15 = 0.0;
        $subtotal0  = 0.0;
        $totalIva   = 0.0;
        $detallesCalculados = [];

        $stmtProd = $db->prepare("SELECT id, nombre, stock, precio_compra FROM productos WHERE id = :pid AND negocio_id = :nid FOR UPDATE");

        foreach ($items as $idx => $it) {
            $prodId        = (int)($it['producto_id'] ?? 0);
            $cantidad      = (int)($it['cantidad'] ?? 0);
            $costoUnitario = round((float)($it['costo_unitario'] ?? 0.0), 4);
            $tarifaIva     = round((float)($it['tarifa_iva'] ?? 15.0), 2);

            if ($prodId <= 0 || $cantidad <= 0 || $costoUnitario <= 0) {
                throw new InvalidArgumentException("Línea #" . ($idx + 1) . ": Producto, cantidad y costo unitario deben ser mayores a cero.");
            }

            $stmtProd->execute(['pid' => $prodId, 'nid' => $negocioId]);
            $prod = $stmtProd->fetch();
            if (!$prod) {
                throw new DomainException("El producto ID {$prodId} no existe.");
            }

            $subtotalItem = round($cantidad * $costoUnitario, 2);
            $valorIvaItem = ($tarifaIva > 0) ? round(($subtotalItem * $tarifaIva) / 100, 2) : 0.00;
            $totalItem    = round($subtotalItem + $valorIvaItem, 2);

            if ($tarifaIva > 0) {
                $subtotal15 += $subtotalItem;
            } else {
                $subtotal0  += $subtotalItem;
            }
            $totalIva += $valorIvaItem;

            $detallesCalculados[] = [
                'producto_id'     => $prodId,
                'nombre_producto' => $prod['nombre'],
                'cantidad'        => $cantidad,
                'costo_unitario'  => $costoUnitario,
                'subtotal'        => $subtotalItem,
                'tarifa_iva'      => $tarifaIva,
                'valor_iva'       => $valorIvaItem,
                'total'           => $totalItem,
                'stock_actual'    => (int)$prod['stock'],
                'costo_actual'    => (float)$prod['precio_compra']
            ];
        }

        $subtotal15 = round($subtotal15, 2);
        $subtotal0  = round($subtotal0, 2);
        $totalIva   = round($totalIva, 2);
        $totalNeto  = round($subtotal15 + $subtotal0 + $totalIva, 2);
        $totalPagar = round($totalNeto - ($retRenta + $retIva), 2);

        if ($totalPagar < 0) {
            throw new DomainException("El valor total de retenciones (\$" . ($retRenta + $retIva) . ") supera el valor de la factura (\${$totalNeto}).");
        }

        // 1. Guardar Cabecera de Compra
        $stmtInsComp = $db->prepare("
            INSERT INTO compras 
                (negocio_id, proveedor_id, usuario_id, numero_factura, fecha_emision, metodo_pago,
                 subtotal_15, subtotal_0, iva, total, retencion_renta, retencion_iva, total_pagar, estado, observaciones)
            VALUES 
                (:nid, :pid, :uid, :num, :fec, :met, :s15, :s0, :iva, :tot, :rren, :riva, :tpag, 'registrada', :obs)
        ");
        $stmtInsComp->execute([
            'nid'  => $negocioId,
            'pid'  => $proveedorId,
            'uid'  => $usuarioId,
            'num'  => $numeroFactura,
            'fec'  => $fechaEmision,
            'met'  => $metodoPago,
            's15'  => $subtotal15,
            's0'   => $subtotal0,
            'iva'  => $totalIva,
            'tot'  => $totalNeto,
            'rren' => $retRenta,
            'riva' => $retIva,
            'tpag' => $totalPagar,
            'obs'  => $observaciones ?: null
        ]);
        $compraId = (int)$db->lastInsertId();

        // 2. Guardar Detalles y Actualizar Stock / Costo Promedio Ponderado
        $stmtInsDet = $db->prepare("
            INSERT INTO compra_detalles 
                (compra_id, negocio_id, producto_id, nombre_producto, cantidad, costo_unitario, subtotal, tarifa_iva, valor_iva, total)
            VALUES 
                (:cid, :nid, :pid, :nom, :cant, :costo, :sub, :tar, :viva, :tot)
        ");

        $stmtUpdProd = $db->prepare("
            UPDATE productos 
            SET stock = stock + :cant,
                precio_compra = :nuevo_costo
            WHERE id = :pid AND negocio_id = :nid
        ");

        foreach ($detallesCalculados as $det) {
            $stmtInsDet->execute([
                'cid'   => $compraId,
                'nid'   => $negocioId,
                'pid'   => $det['producto_id'],
                'nom'   => $det['nombre_producto'],
                'cant'  => $det['cantidad'],
                'costo' => $det['costo_unitario'],
                'sub'   => $det['subtotal'],
                'tar'   => $det['tarifa_iva'],
                'viva'  => $det['valor_iva'],
                'tot'   => $det['total']
            ]);

            // Costo Promedio Ponderado (NIIF PYMES)
            $stockActual = max(0, $det['stock_actual']);
            $costoActual = $det['costo_actual'];
            $stockNuevo  = $stockActual + $det['cantidad'];

            $nuevoCosto = ($stockNuevo > 0)
                ? round((($stockActual * $costoActual) + ($det['cantidad'] * $det['costo_unitario'])) / $stockNuevo, 4)
                : $det['costo_unitario'];

            $stmtUpdProd->execute([
                'cant'        => $det['cantidad'],
                'nuevo_costo' => $nuevoCosto,
                'pid'         => $det['producto_id'],
                'nid'         => $negocioId
            ]);
        }

        $db->commit();

        // 3. Generar Asiento Contable Automático en Aplicación (Fuera de triggers)
        $asientoId = AccountingService::recordPurchaseEntry(
            $negocioId,
            $usuarioId,
            $compraId,
            $numeroFactura,
            $metodoPago,
            $subtotal15,
            $subtotal0,
            $totalIva,
            $retRenta,
            $retIva,
            $totalPagar,
            $proveedor['razon_social']
        );

        if ($asientoId) {
            $updAsiento = $db->prepare("UPDATE compras SET asiento_id = :aid WHERE id = :cid AND negocio_id = :nid");
            $updAsiento->execute(['aid' => $asientoId, 'cid' => $compraId, 'nid' => $negocioId]);
        }

        Response::json([
            'message'    => 'Compra registrada exitosamente, stock actualizado y asiento contable generado.',
            'compra_id'  => $compraId,
            'asiento_id' => $asientoId,
            'total'      => $totalNeto,
            'total_pagar'=> $totalPagar
        ], 201);

    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        Response::json(['error' => $e->getMessage()], 400);
    }
}

if ($method === 'PATCH' || $method === 'DELETE') {
    // Anular compra y reversar inventario + asiento
    $input    = json_decode(file_get_contents('php://input'), true) ?? [];
    $compraId = (int)($input['id'] ?? ($_GET['id'] ?? 0));
    $motivo   = trim($input['motivo'] ?? 'Anulación de compra por el usuario');

    if ($compraId <= 0) {
        Response::json(['error' => 'ID de compra inválido.'], 400);
    }

    try {
        $db->beginTransaction();

        $stmt = $db->prepare("SELECT * FROM compras WHERE id = :id AND negocio_id = :nid FOR UPDATE");
        $stmt->execute(['id' => $compraId, 'nid' => $negocioId]);
        $compra = $stmt->fetch();

        if (!$compra) {
            throw new DomainException("La compra no existe.");
        }
        if ($compra['estado'] === 'anulada') {
            throw new DomainException("Esta compra ya se encuentra anulada.");
        }

        // Obtener detalles para restar stock
        $stmtDet = $db->prepare("SELECT producto_id, cantidad FROM compra_detalles WHERE compra_id = :cid");
        $stmtDet->execute(['cid' => $compraId]);
        $detalles = $stmtDet->fetchAll();

        $stmtStock = $db->prepare("UPDATE productos SET stock = stock - :cant WHERE id = :pid AND negocio_id = :nid");
        foreach ($detalles as $d) {
            $stmtStock->execute([
                'cant' => $d['cantidad'],
                'pid'  => $d['producto_id'],
                'nid'  => $negocioId
            ]);
        }

        // Marcar compra como anulada
        $upd = $db->prepare("UPDATE compras SET estado = 'anulada' WHERE id = :id AND negocio_id = :nid");
        $upd->execute(['id' => $compraId, 'nid' => $negocioId]);

        $db->commit();

        // Reversar asiento contable de forma inmutable si existía
        $asientoReversion = null;
        if (!empty($compra['asiento_id'])) {
            try {
                $asientoReversion = AccountingService::reverseAsiento(
                    $negocioId,
                    (int)$compra['asiento_id'],
                    $usuarioId,
                    "Anulación de Compra Factura #{$compra['numero_factura']}: " . $motivo
                );
            } catch (Throwable $ex) {
                error_log("Error al reversar asiento de compra: " . $ex->getMessage());
            }
        }

        Response::json([
            'message'           => 'Compra anulada exitosamente y stock reversado.',
            'compra_id'         => $compraId,
            'asiento_reversion' => $asientoReversion
        ]);

    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        Response::json(['error' => $e->getMessage()], 400);
    }
}

Response::json(['error' => 'Método no soportado.'], 405);
