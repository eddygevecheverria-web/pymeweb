<?php
declare(strict_types=1);

require_once __DIR__ . '/../../../config/cors.php';
require_once __DIR__ . '/../../../config/database.php';
require_once __DIR__ . '/../../../core/AuthMiddleware.php';
require_once __DIR__ . '/../../../core/AccountingService.php';
require_once __DIR__ . '/../../../core/Response.php';

$session   = AuthMiddleware::authenticate();
$negocioId = (int)$session['negocio_id'];
$db        = Database::getConnection();
$method    = $_SERVER['REQUEST_METHOD'];

// Auto-seed si el negocio no tiene aún su plan de cuentas
AccountingService::seedBasicPlan($negocioId);

if ($method === 'GET') {
    $search = trim($_GET['q'] ?? '');
    $tipo   = strtoupper(trim($_GET['tipo'] ?? ''));

    $query = "
        SELECT 
            p.id, p.codigo, p.nombre, p.tipo, p.naturaleza, p.nivel, p.padre_id, 
            p.acepta_movimiento, p.es_sistema, p.activo,
            padre.nombre AS padre_nombre
        FROM plan_cuentas p
        LEFT JOIN plan_cuentas padre ON padre.id = p.padre_id
        WHERE p.negocio_id = :nid
    ";
    $params = ['nid' => $negocioId];

    if ($search !== '') {
        $query .= " AND (p.codigo LIKE :s OR p.nombre LIKE :s)";
        $params['s'] = "%{$search}%";
    }
    if ($tipo !== '' && in_array($tipo, ['ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESOS', 'COSTOS', 'GASTOS'], true)) {
        $query .= " AND p.tipo = :tipo";
        $params['tipo'] = $tipo;
    }

    $query .= " ORDER BY p.codigo ASC";

    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $cuentas = $stmt->fetchAll();

    Response::json([
        'total'   => count($cuentas),
        'cuentas' => $cuentas
    ]);
}

if ($method === 'POST') {
    $input           = json_decode(file_get_contents('php://input'), true) ?? [];
    $codigo          = trim($input['codigo'] ?? '');
    $nombre          = trim($input['nombre'] ?? '');
    $tipo            = strtoupper(trim($input['tipo'] ?? ''));
    $naturaleza      = strtoupper(trim($input['naturaleza'] ?? ''));
    $padreId         = !empty($input['padre_id']) ? (int)$input['padre_id'] : null;
    $aceptaMovimiento= !empty($input['acepta_movimiento']) ? 1 : 0;

    if ($codigo === '' || $nombre === '' || $tipo === '' || $naturaleza === '') {
        Response::json(['error' => 'Código, nombre, tipo y naturaleza son requeridos.'], 422);
    }

    if (!in_array($tipo, ['ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESOS', 'COSTOS', 'GASTOS'], true)) {
        Response::json(['error' => 'Tipo de cuenta inválido.'], 422);
    }
    if (!in_array($naturaleza, ['DEUDORA', 'ACREEDORA'], true)) {
        Response::json(['error' => 'Naturaleza inválida (DEUDORA o ACREEDORA).'], 422);
    }

    // Verificar unicidad de código
    $stmtCheck = $db->prepare("SELECT id FROM plan_cuentas WHERE negocio_id = :nid AND codigo = :cod LIMIT 1");
    $stmtCheck->execute(['nid' => $negocioId, 'cod' => $codigo]);
    if ($stmtCheck->fetch()) {
        Response::json(['error' => "El código contable '{$codigo}' ya existe en tu plan de cuentas."], 409);
    }

    $nivel = substr_count($codigo, '.') + 1;

    $stmtIns = $db->prepare("
        INSERT INTO plan_cuentas 
            (negocio_id, codigo, nombre, tipo, naturaleza, nivel, padre_id, acepta_movimiento, activo)
        VALUES 
            (:nid, :cod, :nom, :tipo, :nat, :niv, :pid, :mov, 1)
    ");
    $stmtIns->execute([
        'nid'  => $negocioId,
        'cod'  => $codigo,
        'nom'  => $nombre,
        'tipo' => $tipo,
        'nat'  => $naturaleza,
        'niv'  => $nivel,
        'pid'  => $padreId,
        'mov'  => $aceptaMovimiento
    ]);

    Response::json([
        'message' => 'Cuenta contable creada exitosamente.',
        'id'      => (int)$db->lastInsertId(),
        'codigo'  => $codigo,
        'nombre'  => $nombre
    ], 201);
}

Response::json(['error' => 'Método no permitido.'], 405);
