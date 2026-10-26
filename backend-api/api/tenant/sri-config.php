<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/AuthMiddleware.php';
require_once __DIR__ . '/../../core/SriCrypto.php';
require_once __DIR__ . '/../../core/Response.php';

$session   = AuthMiddleware::authenticate();
$negocioId = (int)$session['negocio_id'];
$db        = Database::getConnection();
$method    = $_SERVER['REQUEST_METHOD'];

// GET: Cargar configuración SRI del negocio
if ($method === 'GET') {
    $stmt = $db->prepare("
        SELECT 
            id, negocio_id, ruc, razon_social, nombre_comercial,
            dir_matriz, dir_establecimiento, codigo_establecimiento, punto_emision,
            tipo_contribuyente, obligado_contabilidad, contribuyente_especial,
            ambiente, tipo_emision,
            IF(firma_p12_path IS NOT NULL AND firma_p12_path != '', 1, 0) AS has_firma,
            IF(firma_password_enc IS NOT NULL AND firma_password_enc != '', 1, 0) AS has_password,
            created_at, updated_at
        FROM configuracion_sri
        WHERE negocio_id = :nid
        LIMIT 1
    ");
    $stmt->execute(['nid' => $negocioId]);
    $config = $stmt->fetch();

    if (!$config) {
        // Inicializar si no existe
        $negStmt = $db->prepare("SELECT nombre, ruc_nit, direccion FROM negocios WHERE id = :nid LIMIT 1");
        $negStmt->execute(['nid' => $negocioId]);
        $neg = $negStmt->fetch();

        $rucVal = preg_replace('/\D/', '', $neg['ruc_nit'] ?? '') ?: '1790011122001';
        $rucVal = str_pad(substr($rucVal, 0, 13), 13, '0', STR_PAD_RIGHT);

        $ins = $db->prepare("
            INSERT INTO configuracion_sri (negocio_id, ruc, razon_social, nombre_comercial, dir_matriz, ambiente)
            VALUES (:nid, :ruc, :razon, :nom, :dir, 1)
        ");
        $ins->execute([
            'nid' => $negocioId,
            'ruc' => $rucVal,
            'razon' => $neg['nombre'] ?? 'Mi Negocio',
            'nom' => $neg['nombre'] ?? 'Mi Negocio',
            'dir' => $neg['direccion'] ?? 'Ecuador',
        ]);

        $stmt->execute(['nid' => $negocioId]);
        $config = $stmt->fetch();
    }

    // Estadísticas de facturas SRI emitidas y pendientes
    $statsStmt = $db->prepare("
        SELECT 
            COUNT(*) AS total_facturas,
            SUM(CASE WHEN estado_sri = 'AUTORIZADO' THEN 1 ELSE 0 END) AS autorizadas,
            SUM(CASE WHEN estado_sri IN ('DEVUELTA', 'NO_AUTORIZADO') THEN 1 ELSE 0 END) AS devueltas,
            SUM(CASE WHEN estado_sri IN ('PENDIENTE', 'RECIBIDA') THEN 1 ELSE 0 END) AS en_cola
        FROM comprobantes_electronicos_sri
        WHERE negocio_id = :nid
    ");
    $statsStmt->execute(['nid' => $negocioId]);
    $stats = $statsStmt->fetch();

    Response::json([
        'config' => $config,
        'stats'  => $stats,
    ]);
}

// POST: Actualizar configuración y/o subir archivo de firma .p12
if ($method === 'POST') {
    $ruc                   = trim($_POST['ruc'] ?? '');
    $razonSocial           = trim($_POST['razon_social'] ?? '');
    $nombreComercial       = trim($_POST['nombre_comercial'] ?? '');
    $dirMatriz             = trim($_POST['dir_matriz'] ?? '');
    $dirEstablecimiento    = trim($_POST['dir_establecimiento'] ?? '');
    $codigoEstablecimiento = trim($_POST['codigo_establecimiento'] ?? '001');
    $puntoEmision          = trim($_POST['punto_emision'] ?? '001');
    $tipoContribuyente     = trim($_POST['tipo_contribuyente'] ?? 'REGIMEN_GENERAL');
    $obligadoContabilidad  = trim($_POST['obligado_contabilidad'] ?? 'NO');
    $contribuyenteEspecial = trim($_POST['contribuyente_especial'] ?? '');
    $ambiente              = (int)($_POST['ambiente'] ?? 1); // 1 = Pruebas, 2 = Producción
    $firmaPassword         = trim($_POST['firma_password'] ?? '');

    if ($ruc === '' || strlen($ruc) !== 13) {
        Response::json(['error' => 'El RUC debe tener exactamente 13 dígitos numéricos.'], 422);
    }
    if ($razonSocial === '') {
        Response::json(['error' => 'La Razón Social es obligatoria.'], 422);
    }
    if ($dirMatriz === '') {
        Response::json(['error' => 'La Dirección Matriz es obligatoria.'], 422);
    }

    // Manejo seguro del archivo .p12 (guardado en directorio privado storage/ fuera del web root)
    $p12RelativePath = null;
    if (!empty($_FILES['firma_p12']['name'])) {
        $file = $_FILES['firma_p12'];
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

        if (!in_array($ext, ['p12', 'pfx'], true)) {
            Response::json(['error' => 'El archivo debe ser un certificado digital con extensión .p12 o .pfx.'], 422);
        }

        $storageDir = realpath(__DIR__ . '/../../storage/certificados') ?: (__DIR__ . '/../../storage/certificados');
        if (!is_dir($storageDir)) {
            mkdir($storageDir, 0750, true);
        }

        // Nombre de archivo ofuscado e inaccesible
        $fileName = "firma_{$negocioId}_" . bin2hex(random_bytes(12)) . ".p12";
        $targetPath = "{$storageDir}/{$fileName}";

        if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
            Response::json(['error' => 'No se pudo guardar el archivo de firma en el servidor.'], 500);
        }

        // Verificar validez de la firma con la clave si se envió
        if ($firmaPassword !== '') {
            $p12Data = file_get_contents($targetPath);
            $certs = [];
            if (!openssl_pkcs12_read($p12Data, $certs, $firmaPassword)) {
                @unlink($targetPath);
                $err = openssl_error_string() ?: 'Clave de firma incorrecta.';
                Response::json(['error' => "El certificado no pudo abrirse con la contraseña provista: {$err}"], 422);
            }
        }

        $p12RelativePath = $targetPath;
    }

    // Encriptar contraseña con AES-256 si se envió
    $encPassword = null;
    if ($firmaPassword !== '') {
        $encPassword = SriCrypto::encrypt($firmaPassword);
    }

    // Actualizar configuración en la base de datos
    $sql = "
        UPDATE configuracion_sri
        SET ruc = :ruc,
            razon_social = :razon,
            nombre_comercial = :comercial,
            dir_matriz = :matriz,
            dir_establecimiento = :estab_dir,
            codigo_establecimiento = :estab_cod,
            punto_emision = :pto,
            tipo_contribuyente = :tipo_contr,
            obligado_contabilidad = :obligado,
            contribuyente_especial = :especial,
            ambiente = :amb
            " . ($p12RelativePath ? ", firma_p12_path = :firma_path" : "") . "
            " . ($encPassword ? ", firma_password_enc = :pass_enc" : "") . "
        WHERE negocio_id = :nid
    ";

    $params = [
        'ruc'         => $ruc,
        'razon'       => $razonSocial,
        'comercial'   => $nombreComercial ?: null,
        'matriz'      => $dirMatriz,
        'estab_dir'   => $dirEstablecimiento ?: null,
        'estab_cod'   => str_pad($codigoEstablecimiento, 3, '0', STR_PAD_LEFT),
        'pto'         => str_pad($puntoEmision, 3, '0', STR_PAD_LEFT),
        'tipo_contr'  => $tipoContribuyente,
        'obligado'    => $obligadoContabilidad,
        'especial'    => $contribuyenteEspecial ?: null,
        'amb'         => $ambiente,
        'nid'         => $negocioId,
    ];

    if ($p12RelativePath) {
        $params['firma_path'] = $p12RelativePath;
    }
    if ($encPassword) {
        $params['pass_enc'] = $encPassword;
    }

    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    Response::json([
        'message' => 'Configuración de Facturación Electrónica SRI guardada exitosamente.',
    ]);
}

Response::json(['error' => 'Método no soportado.'], 405);
