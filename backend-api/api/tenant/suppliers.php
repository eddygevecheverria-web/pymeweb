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
    $id = !empty($_GET['id']) ? (int)$_GET['id'] : null;
    $q  = trim($_GET['q'] ?? '');

    if ($id) {
        $stmt = $db->prepare("
            SELECT 
                p.id, p.negocio_id, p.ruc, p.razon_social, p.nombre_comercial,
                p.email, p.telefono, p.direccion, p.cuenta_por_pagar_id, p.activo, p.created_at,
                c.codigo AS cuenta_codigo, c.nombre AS cuenta_nombre
            FROM proveedores p
            LEFT JOIN plan_cuentas c ON c.id = p.cuenta_por_pagar_id
            WHERE p.id = :id AND p.negocio_id = :nid
            LIMIT 1
        ");
        $stmt->execute(['id' => $id, 'nid' => $negocioId]);
        $supplier = $stmt->fetch();
        if (!$supplier) {
            Response::json(['error' => 'Proveedor no encontrado.'], 404);
        }
        Response::json(['supplier' => $supplier]);
    }

    $sql = "
        SELECT 
            p.id, p.ruc, p.razon_social, p.nombre_comercial,
            p.email, p.telefono, p.direccion, p.cuenta_por_pagar_id, p.activo, p.created_at,
            c.codigo AS cuenta_codigo, c.nombre AS cuenta_nombre,
            COUNT(comp.id) AS total_compras,
            COALESCE(SUM(comp.total_pagar), 0.00) AS total_facturado
        FROM proveedores p
        LEFT JOIN plan_cuentas c ON c.id = p.cuenta_por_pagar_id
        LEFT JOIN compras comp ON comp.proveedor_id = p.id AND comp.estado = 'registrada'
        WHERE p.negocio_id = :nid AND p.activo = 1
    ";
    $params = ['nid' => $negocioId];

    if ($q !== '') {
        $sql .= " AND (p.ruc LIKE :q OR p.razon_social LIKE :q OR p.nombre_comercial LIKE :q)";
        $params['q'] = "%{$q}%";
    }

    $sql .= " GROUP BY p.id ORDER BY p.razon_social ASC";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    Response::json(['suppliers' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    $input       = json_decode(file_get_contents('php://input'), true) ?? [];
    $id          = (int)($input['id'] ?? 0);
    $ruc         = trim($input['ruc'] ?? '');
    $razonSocial = trim($input['razon_social'] ?? '');
    $nomComercial= trim($input['nombre_comercial'] ?? '');
    $email       = trim($input['email'] ?? '');
    $telefono    = trim($input['telefono'] ?? '');
    $direccion   = trim($input['direccion'] ?? '');
    $cuentaCxPId = !empty($input['cuenta_por_pagar_id']) ? (int)$input['cuenta_por_pagar_id'] : null;

    if ($ruc === '' || $razonSocial === '') {
        Response::json(['error' => 'El RUC/Identificación y la Razón Social del proveedor son obligatorios.'], 422);
    }

    // Validar cuenta contable si se especificó
    if ($cuentaCxPId) {
        $chkCta = $db->prepare("SELECT id FROM plan_cuentas WHERE id = :cid AND negocio_id = :nid AND acepta_movimiento = 1");
        $chkCta->execute(['cid' => $cuentaCxPId, 'nid' => $negocioId]);
        if (!$chkCta->fetchColumn()) {
            Response::json(['error' => 'La cuenta contable seleccionada no es válida o no acepta movimientos.'], 422);
        }
    }

    if ($id > 0) {
        $stmt = $db->prepare("
            UPDATE proveedores 
            SET ruc = :ruc, razon_social = :rs, nombre_comercial = :nc,
                email = :email, telefono = :tel, direccion = :dir, cuenta_por_pagar_id = :cxp
            WHERE id = :id AND negocio_id = :nid
        ");
        $stmt->execute([
            'ruc'   => $ruc,
            'rs'    => $razonSocial,
            'nc'    => $nomComercial ?: null,
            'email' => $email ?: null,
            'tel'   => $telefono ?: null,
            'dir'   => $direccion ?: null,
            'cxp'   => $cuentaCxPId,
            'id'    => $id,
            'nid'   => $negocioId
        ]);

        Response::json(['message' => 'Proveedor actualizado correctamente.', 'proveedor_id' => $id]);
    } else {
        // Verificar si ya existe con el mismo RUC en este negocio
        $stmtDup = $db->prepare("SELECT id FROM proveedores WHERE negocio_id = :nid AND ruc = :ruc AND activo = 1 LIMIT 1");
        $stmtDup->execute(['nid' => $negocioId, 'ruc' => $ruc]);
        if ($stmtDup->fetchColumn()) {
            Response::json(['error' => 'Ya existe un proveedor registrado con este RUC/Cédula.'], 422);
        }

        $stmt = $db->prepare("
            INSERT INTO proveedores 
                (negocio_id, ruc, razon_social, nombre_comercial, email, telefono, direccion, cuenta_por_pagar_id, activo)
            VALUES 
                (:nid, :ruc, :rs, :nc, :email, :tel, :dir, :cxp, 1)
        ");
        $stmt->execute([
            'nid'   => $negocioId,
            'ruc'   => $ruc,
            'rs'    => $razonSocial,
            'nc'    => $nomComercial ?: null,
            'email' => $email ?: null,
            'tel'   => $telefono ?: null,
            'dir'   => $direccion ?: null,
            'cxp'   => $cuentaCxPId
        ]);

        Response::json([
            'message'      => 'Proveedor registrado exitosamente.',
            'proveedor_id' => (int)$db->lastInsertId()
        ], 201);
    }
}

if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) {
        Response::json(['error' => 'ID de proveedor inválido.'], 400);
    }

    // Verificar si tiene compras asociadas
    $chk = $db->prepare("SELECT COUNT(*) FROM compras WHERE proveedor_id = :pid AND negocio_id = :nid");
    $chk->execute(['pid' => $id, 'nid' => $negocioId]);
    $totalCompras = (int)$chk->fetchColumn();

    if ($totalCompras > 0) {
        // Soft delete para preservar integridad de transacciones
        $stmt = $db->prepare("UPDATE proveedores SET activo = 0 WHERE id = :id AND negocio_id = :nid");
        $stmt->execute(['id' => $id, 'nid' => $negocioId]);
        Response::json(['message' => 'El proveedor tiene compras asociadas; ha sido desactivado del catálogo.']);
    } else {
        $stmt = $db->prepare("DELETE FROM proveedores WHERE id = :id AND negocio_id = :nid");
        $stmt->execute(['id' => $id, 'nid' => $negocioId]);
        Response::json(['message' => 'Proveedor eliminado exitosamente.']);
    }
}

Response::json(['error' => 'Método no soportado.'], 405);
