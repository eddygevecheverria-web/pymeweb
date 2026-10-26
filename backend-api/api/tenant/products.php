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
    $q         = trim($_GET['q'] ?? '');
    $catId     = !empty($_GET['categoria_id']) ? (int)$_GET['categoria_id'] : null;
    $provId    = !empty($_GET['proveedor_id']) ? (int)$_GET['proveedor_id'] : null;
    $bajoStock = isset($_GET['bajo_stock']) && $_GET['bajo_stock'] === '1';

    $sql = "
        SELECT 
            p.id, 
            p.negocio_id, 
            p.categoria_id, 
            c.nombre AS categoria_nombre,
            p.codigo_barra, 
            p.nombre, 
            p.descripcion, 
            p.precio_compra, 
            p.precio_venta, 
            p.cuenta_inventario_id,
            ci.codigo AS cuenta_inventario_codigo,
            ci.nombre AS cuenta_inventario_nombre,
            p.cuenta_ingreso_id,
            cr.codigo AS cuenta_ingreso_codigo,
            cr.nombre AS cuenta_ingreso_nombre,
            p.cuenta_costo_id,
            cc.codigo AS cuenta_costo_codigo,
            cc.nombre AS cuenta_costo_nombre,
            p.sri_codigo_impuesto,
            p.sri_tarifa_iva,
            p.stock, 
            p.stock_minimo,
            p.proveedor_id,
            pr.razon_social AS proveedor_nombre,
            p.imagen_url, 
            p.activo,
            CASE WHEN p.stock <= p.stock_minimo THEN 1 ELSE 0 END AS bajo_stock
        FROM productos p
        LEFT JOIN categorias c ON c.id = p.categoria_id
        LEFT JOIN proveedores pr ON pr.id = p.proveedor_id
        LEFT JOIN plan_cuentas ci ON ci.id = COALESCE(p.cuenta_inventario_id, c.cuenta_inventario_id)
        LEFT JOIN plan_cuentas cr ON cr.id = COALESCE(p.cuenta_ingreso_id, c.cuenta_ingreso_id)
        LEFT JOIN plan_cuentas cc ON cc.id = COALESCE(p.cuenta_costo_id, c.cuenta_costo_id)
        WHERE p.negocio_id = :nid AND p.activo = 1
    ";
    $params = ['nid' => $negocioId];

    if ($q !== '') {
        $sql .= " AND (p.nombre LIKE :q OR p.codigo_barra LIKE :q)";
        $params['q'] = "%{$q}%";
    }

    if ($catId !== null) {
        if ($catId === 0) {
            $sql .= " AND p.categoria_id IS NULL";
        } else {
            $sql .= " AND p.categoria_id = :cat_id";
            $params['cat_id'] = $catId;
        }
    }

    if ($provId !== null) {
        $sql .= " AND p.proveedor_id = :prov_id";
        $params['prov_id'] = $provId;
    }

    if ($bajoStock) {
        $sql .= " AND p.stock <= p.stock_minimo";
    }

    $sql .= " ORDER BY c.nombre ASC, p.nombre ASC";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    Response::json(['products' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    $id                = (int)($_POST['id'] ?? 0);
    $categoriaId       = !empty($_POST['categoria_id']) ? (int)$_POST['categoria_id'] : null;
    $codigoBarra       = trim($_POST['codigo_barra'] ?? '');
    $nombre            = trim($_POST['nombre'] ?? '');
    $descripcion       = trim($_POST['descripcion'] ?? '');
    $precioCompra      = (float)($_POST['precio_compra'] ?? 0);
    $precioVenta       = (float)($_POST['precio_venta'] ?? 0);
    $sriCodigoImp      = trim($_POST['sri_codigo_impuesto'] ?? '4'); // 4=15%, 2=12%, 0=0%
    $sriTarifaIva      = (float)($_POST['sri_tarifa_iva'] ?? 15.00);
    $stock             = (int)($_POST['stock'] ?? 0);
    $stockMinimo       = (int)($_POST['stock_minimo'] ?? 5);
    $proveedorId       = !empty($_POST['proveedor_id']) ? (int)$_POST['proveedor_id'] : null;
    $cuentaInventarioId= !empty($_POST['cuenta_inventario_id']) ? (int)$_POST['cuenta_inventario_id'] : null;
    $cuentaIngresoId   = !empty($_POST['cuenta_ingreso_id']) ? (int)$_POST['cuenta_ingreso_id'] : null;
    $cuentaCostoId     = !empty($_POST['cuenta_costo_id']) ? (int)$_POST['cuenta_costo_id'] : null;

    // Sincronizar tarifa IVA según catálogo oficial SRI
    if ($sriCodigoImp === '0') {
        $sriTarifaIva = 0.00;
    } elseif ($sriCodigoImp === '2') {
        $sriTarifaIva = 12.00;
    } elseif ($sriCodigoImp === '3') {
        $sriTarifaIva = 14.00;
    } elseif ($sriCodigoImp === '4') {
        $sriTarifaIva = 15.00;
    }

    if ($nombre === '' || $precioVenta <= 0) {
        Response::json(['error' => 'El nombre y un precio de venta mayor a 0 son obligatorios.'], 422);
    }

    $imagenUrl = null;
    if (!empty($_FILES['imagen']['name'])) {
        try {
            $imagenUrl = ImageUploader::uploadAndOptimize($_FILES['imagen'], "productos/{$negocioId}", 600);
        } catch (Throwable $e) {
            Response::json(['error' => $e->getMessage()], 422);
        }
    }

    if ($id > 0) {
        $sql = "
            UPDATE productos
            SET categoria_id = :cat_id, 
                codigo_barra = :codigo, 
                nombre = :nombre, 
                descripcion = :desc,
                precio_compra = :pcompra, 
                precio_venta = :pventa, 
                cuenta_inventario_id = :ci,
                cuenta_ingreso_id = :cr,
                cuenta_costo_id = :cc,
                sri_codigo_impuesto = :cod_imp, 
                sri_tarifa_iva = :tarifa, 
                stock = :stock,
                stock_minimo = :stock_min,
                proveedor_id = :prov_id
                " . ($imagenUrl ? ", imagen_url = :img" : "") . "
            WHERE id = :id AND negocio_id = :nid
        ";
        $params = [
            'cat_id'    => $categoriaId ?: null,
            'codigo'    => $codigoBarra ?: null,
            'nombre'    => $nombre,
            'desc'      => $descripcion ?: null,
            'pcompra'   => $precioCompra,
            'pventa'    => $precioVenta,
            'ci'        => $cuentaInventarioId ?: null,
            'cr'        => $cuentaIngresoId ?: null,
            'cc'        => $cuentaCostoId ?: null,
            'cod_imp'   => $sriCodigoImp,
            'tarifa'    => $sriTarifaIva,
            'stock'     => $stock,
            'stock_min' => $stockMinimo,
            'prov_id'   => $proveedorId ?: null,
            'id'        => $id,
            'nid'       => $negocioId
        ];
        if ($imagenUrl) {
            $params['img'] = $imagenUrl;
        }
        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        Response::json(['message' => 'Producto y mapeo contable actualizados correctamente.']);
    } else {
        $stmt = $db->prepare("
            INSERT INTO productos 
                (negocio_id, categoria_id, codigo_barra, nombre, descripcion, precio_compra, precio_venta, 
                 cuenta_inventario_id, cuenta_ingreso_id, cuenta_costo_id, sri_codigo_impuesto, sri_tarifa_iva, 
                 stock, stock_minimo, proveedor_id, imagen_url)
            VALUES 
                (:nid, :cat_id, :codigo, :nombre, :desc, :pcompra, :pventa, 
                 :ci, :cr, :cc, :cod_imp, :tarifa, 
                 :stock, :stock_min, :prov_id, :img)
        ");
        $stmt->execute([
            'nid'       => $negocioId,
            'cat_id'    => $categoriaId ?: null,
            'codigo'    => $codigoBarra ?: null,
            'nombre'    => $nombre,
            'desc'      => $descripcion ?: null,
            'pcompra'   => $precioCompra,
            'pventa'    => $precioVenta,
            'ci'        => $cuentaInventarioId ?: null,
            'cr'        => $cuentaIngresoId ?: null,
            'cc'        => $cuentaCostoId ?: null,
            'cod_imp'   => $sriCodigoImp,
            'tarifa'    => $sriTarifaIva,
            'stock'     => $stock,
            'stock_min' => $stockMinimo,
            'prov_id'   => $proveedorId ?: null,
            'img'       => $imagenUrl
        ]);

        Response::json([
            'message'     => 'Producto agregado al inventario con mapeo contable.',
            'producto_id' => (int)$db->lastInsertId()
        ], 201);
    }
}

if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    $stmt = $db->prepare("UPDATE productos SET activo = 0 WHERE id = :id AND negocio_id = :nid");
    $stmt->execute(['id' => $id, 'nid' => $negocioId]);
    Response::json(['message' => 'Producto eliminado del catálogo.']);
}

Response::json(['error' => 'Método no soportado'], 405);
