<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/AuthMiddleware.php';
require_once __DIR__ . '/../../core/WhatsAppAIService.php';
require_once __DIR__ . '/../../core/Response.php';

$session = AuthMiddleware::authenticate();
$negocioId = (int)$session['negocio_id'];
$db = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'];

// GET: Obtener configuración actual del asistente WhatsApp
if ($method === 'GET') {
    $stmt = $db->prepare("
        SELECT 
            id, negocio_id, provider, phone_number_id, webhook_secret, 
            ai_provider, ai_model, system_prompt_extra, activo, created_at, updated_at,
            IF(api_token IS NOT NULL AND api_token != '', 1, 0) AS has_api_token,
            IF(ai_api_key IS NOT NULL AND ai_api_key != '', 1, 0) AS has_ai_api_key
        FROM whatsapp_configs
        WHERE negocio_id = :nid
        LIMIT 1
    ");
    $stmt->execute(['nid' => $negocioId]);
    $config = $stmt->fetch();

    if (!$config) {
        $secret = 'pymeweb_wa_' . bin2hex(random_bytes(8));
        $ins = $db->prepare("
            INSERT INTO whatsapp_configs (negocio_id, webhook_secret, ai_provider, ai_model)
            VALUES (:nid, :secret, 'gemini', 'gemini-1.5-flash')
        ");
        $ins->execute(['nid' => $negocioId, 'secret' => $secret]);

        $stmt->execute(['nid' => $negocioId]);
        $config = $stmt->fetch();
    }

    // Obtener negocio para URL del webhook
    $negStmt = $db->prepare("SELECT slug, nombre FROM negocios WHERE id = :nid LIMIT 1");
    $negStmt->execute(['nid' => $negocioId]);
    $neg = $negStmt->fetch();

    $backendUrl = rtrim($_ENV['BACKEND_PUBLIC_URL'] ?? 'http://localhost/pymeweb/backend-api', '/');
    $webhookUrl = "{$backendUrl}/api/webhook/whatsapp.php?negocio_id={$negocioId}";

    // Obtener últimos mensajes del historial
    $msgStmt = $db->prepare("
        SELECT id, cliente_telefono, cliente_nombre, direccion, mensaje, created_at
        FROM whatsapp_mensajes
        WHERE negocio_id = :nid
        ORDER BY id DESC
        LIMIT 50
    ");
    $msgStmt->execute(['nid' => $negocioId]);
    $recentMessages = $msgStmt->fetchAll();

    Response::json([
        'config' => $config,
        'webhook_url' => $webhookUrl,
        'business' => $neg,
        'recent_messages' => $recentMessages,
    ]);
}

// POST: Guardar configuración o probar simulación
if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $action = $input['action'] ?? 'save_config';

    if ($action === 'simulate_chat') {
        $userMessage = trim($input['message'] ?? '');
        $customerPhone = trim($input['phone'] ?? '+593999999999');
        $customerName = trim($input['name'] ?? 'Cliente');

        if ($userMessage === '') {
            Response::json(['error' => 'El mensaje no puede estar vacío.'], 422);
        }

        try {
            $waService = new WhatsAppAIService($negocioId);
            $aiReply = $waService->processCustomerMessage($customerPhone, $customerName, $userMessage);

            Response::json([
                'success' => true,
                'incoming' => $userMessage,
                'reply' => $aiReply,
            ]);
        } catch (Throwable $e) {
            Response::json(['error' => $e->getMessage()], 500);
        }
    }

    // Guardar configuración
    $provider = $input['provider'] ?? 'meta_official';
    $phoneNumberId = trim($input['phone_number_id'] ?? '');
    $apiToken = trim($input['api_token'] ?? '');
    $aiProvider = $input['ai_provider'] ?? 'gemini';
    $aiApiKey = trim($input['ai_api_key'] ?? '');
    $aiModel = trim($input['ai_model'] ?? 'gemini-1.5-flash');
    $promptExtra = trim($input['system_prompt_extra'] ?? '');
    $activo = isset($input['activo']) ? (int)$input['activo'] : 1;

    // Actualizar config
    $sql = "
        UPDATE whatsapp_configs 
        SET provider = :provider,
            phone_number_id = :phone_id,
            ai_provider = :ai_provider,
            ai_model = :ai_model,
            system_prompt_extra = :prompt_extra,
            activo = :activo
            " . ($apiToken !== '' ? ", api_token = :token" : "") . "
            " . ($aiApiKey !== '' ? ", ai_api_key = :ai_key" : "") . "
        WHERE negocio_id = :nid
    ";
    $params = [
        'provider'     => $provider,
        'phone_id'     => $phoneNumberId ?: null,
        'ai_provider'  => $aiProvider,
        'ai_model'     => $aiModel,
        'prompt_extra' => $promptExtra ?: null,
        'activo'       => $activo,
        'nid'          => $negocioId,
    ];
    if ($apiToken !== '') {
        $params['token'] = $apiToken;
    }
    if ($aiApiKey !== '') {
        $params['ai_key'] = $aiApiKey;
    }

    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    Response::json(['message' => 'Configuración de Asistente WhatsApp guardada con éxito.']);
}

Response::json(['error' => 'Método no permitido.'], 405);
