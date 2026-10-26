<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/WhatsAppAIService.php';
require_once __DIR__ . '/../../core/Response.php';

header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'];
$db = Database::getConnection();

// Identificar negocio: Puede venir por parámetro URL ?negocio_id=1 o ?slug=webcomp
$negocioId = null;
if (!empty($_GET['negocio_id'])) {
    $negocioId = (int)$_GET['negocio_id'];
} elseif (!empty($_GET['slug'])) {
    $slugStmt = $db->prepare("SELECT id FROM negocios WHERE slug = :s LIMIT 1");
    $slugStmt->execute(['s' => trim($_GET['slug'])]);
    $negocioId = (int)($slugStmt->fetchColumn() ?: 0);
}

// ==========================================================
// 1. VERIFICACIÓN DE WEBHOOK (GET - Meta WhatsApp Cloud API)
// ==========================================================
if ($method === 'GET') {
    $mode      = $_GET['hub_mode'] ?? null;
    $token     = $_GET['hub_verify_token'] ?? null;
    $challenge = $_GET['hub_challenge'] ?? null;

    if ($mode === 'subscribe') {
        // Validar token contra la base de datos o env
        $validToken = $_ENV['WHATSAPP_VERIFY_TOKEN'] ?? 'pymeweb_webhook_token_2026';

        if ($negocioId) {
            $stmt = $db->prepare("SELECT webhook_secret FROM whatsapp_configs WHERE negocio_id = :nid LIMIT 1");
            $stmt->execute(['nid' => $negocioId]);
            $customSecret = $stmt->fetchColumn();
            if ($customSecret) {
                $validToken = $customSecret;
            }
        }

        if ($token === $validToken || $token === ($_ENV['WHATSAPP_VERIFY_TOKEN'] ?? '')) {
            header('Content-Type: text/plain');
            echo $challenge;
            exit;
        }
    }

    // Si no es un challenge de Meta, devolver estado del webhook
    Response::json([
        'status'  => 'active',
        'message' => 'PymeWeb WhatsApp Webhook Endpoint está operativo.',
        'negocio_id' => $negocioId,
    ]);
}

// ==========================================================
// 2. RECEPCIÓN DE MENSAJES (POST - Meta o Evolution API / Baileys)
// ==========================================================
if ($method === 'POST') {
    $rawInput = file_get_contents('php://input');
    $payload  = json_decode($rawInput, true) ?: [];

    // Si aún no se resolvió el negocio_id, intentar resolverlo por phone_number_id o instance en el payload
    if (!$negocioId) {
        $candidatePhoneId = $payload['entry'][0]['changes'][0]['value']['metadata']['phone_number_id'] 
            ?? $payload['instance'] 
            ?? $payload['instanceName'] 
            ?? null;

        if ($candidatePhoneId) {
            $fStmt = $db->prepare("SELECT negocio_id FROM whatsapp_configs WHERE phone_number_id = :pid LIMIT 1");
            $fStmt->execute(['pid' => $candidatePhoneId]);
            $negocioId = (int)($fStmt->fetchColumn() ?: 0);
        }

        // Si no se encuentra, usar el primer negocio activo como predeterminado
        if (!$negocioId) {
            $negocioId = (int)($db->query("SELECT id FROM negocios WHERE estado != 'inactivo' LIMIT 1")->fetchColumn() ?: 1);
        }
    }

    try {
        $waService = new WhatsAppAIService($negocioId);
    } catch (Throwable $e) {
        Response::json(['error' => 'Negocio no configurado: ' . $e->getMessage()], 400);
    }

    // A. Detectar payload de Meta WhatsApp Cloud API
    if (isset($payload['object']) && $payload['object'] === 'whatsapp_business_account') {
        $entry = $payload['entry'][0] ?? [];
        $changes = $entry['changes'][0] ?? [];
        $value = $changes['value'] ?? [];
        $messages = $value['messages'] ?? [];

        if (empty($messages)) {
            // Posible evento de estado (delivery/read receipt)
            Response::json(['status' => 'acknowledged_status']);
        }

        foreach ($messages as $msg) {
            $from = $msg['from'] ?? '';
            $contactName = $value['contacts'][0]['profile']['name'] ?? 'Cliente';
            $type = $msg['type'] ?? 'text';
            $body = '';

            if ($type === 'text') {
                $body = $msg['text']['body'] ?? '';
            } elseif ($type === 'button') {
                $body = $msg['button']['text'] ?? '';
            } elseif ($type === 'interactive') {
                $body = $msg['interactive']['button_reply']['title'] 
                    ?? $msg['interactive']['list_reply']['title'] 
                    ?? '';
            }

            if ($from && $body !== '') {
                // Procesar con IA conectada a la base de datos de stock (solo lectura)
                $replyText = $waService->processCustomerMessage($from, $contactName, $body);

                // Enviar respuesta por WhatsApp
                $waService->sendWhatsAppMessage($from, $replyText);
            }
        }

        Response::json(['status' => 'success', 'messages_processed' => count($messages)]);
    }

    // B. Detectar payload de Evolution API / Baileys / WPPConnect
    // Ej: {"event": "messages.upsert", "data": {"key": {"remoteJid": "5939...@s.whatsapp.net", "fromMe": false}, "message": {"conversation": "..."}}}
    if (isset($payload['event']) || isset($payload['data']) || isset($payload['message'])) {
        $data = $payload['data'] ?? $payload;
        $remoteJid = $data['key']['remoteJid'] ?? $data['from'] ?? '';
        $fromMe = $data['key']['fromMe'] ?? false;

        // Ignorar mensajes enviados por el propio bot para no crear loops
        if ($fromMe) {
            Response::json(['status' => 'ignored_self_message']);
        }

        // Limpiar remoteJid (ej: 59399999999@s.whatsapp.net -> 59399999999)
        $cleanPhone = preg_replace('/@.*$/', '', $remoteJid);
        $contactName = $data['pushName'] ?? 'Cliente';
        $body = $data['message']['conversation'] 
            ?? $data['message']['extendedTextMessage']['text'] 
            ?? $data['body'] 
            ?? '';

        if ($cleanPhone && $body !== '') {
            $replyText = $waService->processCustomerMessage($cleanPhone, $contactName, $body);
            $waService->sendWhatsAppMessage($cleanPhone, $replyText);

            Response::json([
                'status' => 'success',
                'recipient' => $cleanPhone,
                'response' => $replyText,
            ]);
        }
    }

    // C. Formato genérico para pruebas directas / simuladores: {"phone": "...", "message": "...", "name": "..."}
    if (isset($payload['message']) && is_string($payload['message'])) {
        $phone = $payload['phone'] ?? $payload['from'] ?? '593999999999';
        $name = $payload['name'] ?? 'Cliente Demo';
        $msg = $payload['message'];

        $replyText = $waService->processCustomerMessage($phone, $name, $msg);

        // Si se pide envío real
        if (!empty($payload['send_real'])) {
            $waService->sendWhatsAppMessage($phone, $replyText);
        }

        Response::json([
            'status' => 'success',
            'negocio_id' => $negocioId,
            'customer_phone' => $phone,
            'incoming_message' => $msg,
            'ai_response' => $replyText,
        ]);
    }

    Response::json(['error' => 'Formato de payload no reconocido o vacío.'], 400);
}

Response::json(['error' => 'Método no soportado.'], 405);
