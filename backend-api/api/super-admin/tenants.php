<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/AuthMiddleware.php';
require_once __DIR__ . '/../../core/Response.php';

AuthMiddleware::authenticate(true);
$db = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $search = trim($_GET['q'] ?? '');
    $filtro = trim($_GET['filtro'] ?? '');

    $sql = "
        SELECT 
            n.id, n.nombre, n.slug, n.ruc_nit, n.telefono, n.direccion,
            n.estado, n.fecha_registro, n.fecha_expiracion,
            DATEDIFF(n.fecha_expiracion, NOW()) AS dias_restantes,
            u.id AS usuario_id, u.nombre AS dueno_nombre, u.email AS dueno_email
        FROM negocios n
        LEFT JOIN usuarios u ON u.negocio_id = n.id AND u.rol = 'admin_negocio'
        WHERE 1=1
    ";
    $params = [];

    if ($search !== '') {
        $sql .= " AND (n.nombre LIKE :q OR n.slug LIKE :q OR u.email LIKE :q OR n.ruc_nit LIKE :q)";
        $params['q'] = "%{$search}%";
    }

    if ($filtro === 'por_expirar') {
        $sql .= " AND n.estado IN ('activo', 'prueba') AND n.fecha_expiracion BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 3 DAY)";
    } elseif (in_array($filtro, ['activo', 'prueba', 'inactivo'], true)) {
        $sql .= " AND n.estado = :estado";
        $params['estado'] = $filtro;
    }

    $sql .= " ORDER BY n.fecha_expiracion ASC";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    Response::json(['tenants' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $nombreNegocio = trim($input['nombre_negocio'] ?? '');
    $rucNit        = trim($input['ruc_nit'] ?? '');
    $telefono      = trim($input['telefono'] ?? '');
    $duenoNombre   = trim($input['dueno_nombre'] ?? '');
    $duenoEmail    = strtolower(trim($input['dueno_email'] ?? ''));
    $password      = $input['password'] ?? '';
    $diasIniciales = (int)($input['dias_iniciales'] ?? 7);
    $estadoInicial = in_array($input['estado'] ?? '', ['activo', 'prueba'], true) ? $input['estado'] : 'prueba';

    if (!$nombreNegocio || !$duenoNombre || !filter_var($duenoEmail, FILTER_VALIDATE_EMAIL) || strlen($password) < 6) {
        Response::json(['error' => 'Datos incompletos o contraseña menor a 6 caracteres.'], 422);
    }

    $check = $db->prepare("SELECT id FROM usuarios WHERE email = :email LIMIT 1");
    $check->execute(['email' => $duenoEmail]);
    if ($check->fetch()) {
        Response::json(['error' => 'El correo del dueño ya está registrado.'], 409);
    }

    $baseSlug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', iconv('UTF-8', 'ASCII//TRANSLIT', $nombreNegocio)), '-'));
    $slug = ($baseSlug ?: 'negocio') . '-' . random_int(100, 999);

    try {
        $db->beginTransaction();

        $fechaExp = (new DateTimeImmutable("+{$diasIniciales} days"))->format('Y-m-d H:i:s');
        $stmtNeg = $db->prepare("
            INSERT INTO negocios (nombre, slug, ruc_nit, telefono, estado, fecha_expiracion)
            VALUES (:nombre, :slug, :ruc, :tel, :estado, :exp)
        ");
        $stmtNeg->execute([
            'nombre' => $nombreNegocio,
            'slug'   => $slug,
            'ruc'    => $rucNit ?: null,
            'tel'    => $telefono ?: null,
            'estado' => $estadoInicial,
            'exp'    => $fechaExp
        ]);
        $negocioId = (int)$db->lastInsertId();

        $stmtUsr = $db->prepare("
            INSERT INTO usuarios (negocio_id, nombre, email, password_hash, rol)
            VALUES (:nid, :nombre, :email, :hash, 'admin_negocio')
        ");
        $stmtUsr->execute([
            'nid'    => $negocioId,
            'nombre' => $duenoNombre,
            'email'  => $duenoEmail,
            'hash'   => password_hash($password, PASSWORD_DEFAULT)
        ]);

        $db->commit();
        Response::json([
            'message' => 'Cliente creado exitosamente.',
            'negocio_id' => $negocioId,
            'slug' => $slug,
            'nombre_negocio' => $nombreNegocio,
            'dueno_nombre' => $duenoNombre,
            'dueno_email' => $duenoEmail,
            'telefono' => $telefono,
            'password' => $password,
            'dias_iniciales' => $diasIniciales,
            'fecha_expiracion' => $fechaExp
        ], 201);
    } catch (Throwable $e) {
        $db->rollBack();
        Response::json(['error' => 'No se pudo crear el cliente.'], 500);
    }
}

if ($method === 'PUT') {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $negocioId     = (int)($input['id'] ?? 0);
    $nombreNegocio = trim($input['nombre'] ?? '');
    $rucNit        = trim($input['ruc_nit'] ?? '');
    $telefono      = trim($input['telefono'] ?? '');
    $duenoNombre   = trim($input['dueno_nombre'] ?? '');
    $duenoEmail    = strtolower(trim($input['dueno_email'] ?? ''));

    if ($negocioId <= 0 || !$nombreNegocio) {
        Response::json(['error' => 'ID de negocio y nombre son obligatorios.'], 422);
    }

    try {
        $db->beginTransaction();

        $updNeg = $db->prepare("
            UPDATE negocios 
            SET nombre = :nombre, ruc_nit = :ruc, telefono = :tel
            WHERE id = :id
        ");
        $updNeg->execute([
            'nombre' => $nombreNegocio,
            'ruc'    => $rucNit ?: null,
            'tel'    => $telefono ?: null,
            'id'     => $negocioId
        ]);

        if ($duenoNombre && filter_var($duenoEmail, FILTER_VALIDATE_EMAIL)) {
            $updUsr = $db->prepare("
                UPDATE usuarios 
                SET nombre = :nombre, email = :email
                WHERE negocio_id = :nid AND rol = 'admin_negocio'
            ");
            $updUsr->execute([
                'nombre' => $duenoNombre,
                'email'  => $duenoEmail,
                'nid'    => $negocioId
            ]);
        }

        $db->commit();
        Response::json(['message' => 'Datos del cliente actualizados correctamente.']);
    } catch (Throwable $e) {
        $db->rollBack();
        Response::json(['error' => 'Error al actualizar el cliente (verifica que el email no esté duplicado).'], 400);
    }
}

Response::json(['error' => 'Método no soportado'], 405);
