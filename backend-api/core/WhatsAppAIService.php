<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/EnvLoader.php';

class WhatsAppAIService {
    private PDO $db;
    private int $negocioId;
    private array $negocio;
    private ?array $waConfig;
    private string $frontendUrl;

    public function __construct(int $negocioId) {
        $this->db = Database::getConnection();
        $this->negocioId = $negocioId;
        $this->frontendUrl = rtrim($_ENV['FRONTEND_URL'] ?? 'http://localhost:3000', '/');

        // Cargar negocio
        $stmt = $this->db->prepare("SELECT id, nombre, slug, telefono, direccion FROM negocios WHERE id = :id LIMIT 1");
        $stmt->execute(['id' => $negocioId]);
        $negocio = $stmt->fetch();
        if (!$negocio) {
            throw new Exception("Negocio no encontrado para ID {$negocioId}");
        }
        $this->negocio = $negocio;

        // Cargar configuración de WhatsApp e IA
        $cfgStmt = $this->db->prepare("SELECT * FROM whatsapp_configs WHERE negocio_id = :nid LIMIT 1");
        $cfgStmt->execute(['nid' => $negocioId]);
        $this->waConfig = $cfgStmt->fetch() ?: null;
    }

    /**
     * Consulta el catálogo de productos con acceso de SOLO LECTURA
     */
    public function getProductsCatalogReadOnly(string $searchQuery = ''): array {
        $sql = "
            SELECT 
                p.id,
                p.nombre,
                p.descripcion,
                c.nombre AS categoria,
                p.precio_venta,
                p.stock,
                p.codigo_barra
            FROM productos p
            LEFT JOIN categorias c ON c.id = p.categoria_id
            WHERE p.negocio_id = :nid AND p.activo = 1
        ";
        $params = ['nid' => $this->negocioId];

        if ($searchQuery !== '') {
            $sql .= " AND (p.nombre LIKE :q OR p.descripcion LIKE :q OR c.nombre LIKE :q)";
            $params['q'] = "%{$searchQuery}%";
        }

        $sql .= " ORDER BY p.stock DESC, p.nombre ASC LIMIT 40";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    /**
     * Genera un enlace directo al carrito o a la tienda web
     * Si se pasa productId y qty, se estructura ?cart=[{"id":1,"qty":1}]
     */
    public function generateCartUrl(?int $productId = null, int $quantity = 1): string {
        $storeUrl = "{$this->frontendUrl}/{$this->negocio['slug']}";
        if ($productId && $productId > 0) {
            $cartPayload = base64_encode(json_encode([
                ['id' => $productId, 'qty' => max(1, $quantity)]
            ]));
            return "{$storeUrl}?cart={$cartPayload}";
        }
        return $storeUrl;
    }

    /**
     * Procesa un mensaje de un cliente y genera una respuesta inteligente
     */
    public function processCustomerMessage(string $customerPhone, string $customerName, string $message): string {
        // 1. Guardar mensaje entrante en historial
        $this->logMessage($customerPhone, $customerName, 'entrante', $message);

        // 2. Obtener historial reciente para contexto conversacional (últimos 6 mensajes)
        $history = $this->getRecentConversation($customerPhone, 6);

        // 3. Obtener catálogo disponible (solo lectura)
        $catalog = $this->getProductsCatalogReadOnly();

        // 4. Determinar API Key y Proveedor de IA
        $aiProvider = $this->waConfig['ai_provider'] ?? 'gemini';
        $apiKey = !empty($this->waConfig['ai_api_key'])
            ? $this->waConfig['ai_api_key']
            : ($aiProvider === 'openai' ? ($_ENV['OPENAI_API_KEY'] ?? '') : ($_ENV['GEMINI_API_KEY'] ?? ''));

        // Si no hay API key configurada o falla la IA, usar respuesta basada en reglas inteligentes de fallback
        if (empty($apiKey) || $apiKey === 'tu_gemini_api_key_aqui' || $apiKey === 'tu_openai_api_key_aqui') {
            $response = $this->fallbackRuleBasedResponse($message, $catalog);
        } else {
            try {
                if ($aiProvider === 'openai') {
                    $response = $this->callOpenAI($apiKey, $message, $history, $catalog);
                } else {
                    $response = $this->callGemini($apiKey, $message, $history, $catalog);
                }
            } catch (Throwable $e) {
                error_log("WhatsApp AI Error: " . $e->getMessage());
                // Fallback seguro en caso de corte o cuota excedida de IA
                $response = $this->fallbackRuleBasedResponse($message, $catalog);
            }
        }

        // 5. Guardar respuesta saliente en historial
        $this->logMessage($customerPhone, $customerName, 'saliente', $response);

        return $response;
    }

    /**
     * Llamada a Google Gemini API
     */
    private function callGemini(string $apiKey, string $message, array $history, array $catalog): string {
        $model = !empty($this->waConfig['ai_model']) ? $this->waConfig['ai_model'] : 'gemini-1.5-flash';
        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";

        $systemPrompt = $this->buildSystemPrompt($catalog);

        // Formar contenidos
        $contents = [];
        foreach ($history as $h) {
            $role = ($h['direccion'] === 'entrante') ? 'user' : 'model';
            $contents[] = [
                'role' => $role,
                'parts' => [['text' => $h['mensaje']]]
            ];
        }
        $contents[] = [
            'role' => 'user',
            'parts' => [['text' => $message]]
        ];

        $payload = [
            'system_instruction' => [
                'parts' => [
                    ['text' => $systemPrompt]
                ]
            ],
            'contents' => $contents,
            'generationConfig' => [
                'temperature' => 0.4,
                'maxOutputTokens' => 600,
            ]
        ];

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_TIMEOUT, 20);

        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($err || $httpCode !== 200) {
            throw new Exception("Gemini API error (HTTP {$httpCode}): " . ($result ?: $err));
        }

        $json = json_decode($result, true);
        $reply = $json['candidates'][0]['content']['parts'][0]['text'] ?? null;

        if (!$reply) {
            throw new Exception("Gemini returned invalid structure: {$result}");
        }

        return trim($reply);
    }

    /**
     * Llamada a OpenAI API
     */
    private function callOpenAI(string $apiKey, string $message, array $history, array $catalog): string {
        $model = !empty($this->waConfig['ai_model']) ? $this->waConfig['ai_model'] : 'gpt-4o-mini';
        $url = "https://api.openai.com/v1/chat/completions";

        $systemPrompt = $this->buildSystemPrompt($catalog);

        $messages = [
            ['role' => 'system', 'content' => $systemPrompt]
        ];

        foreach ($history as $h) {
            $role = ($h['direccion'] === 'entrante') ? 'user' : 'assistant';
            $messages[] = [
                'role' => $role,
                'content' => $h['mensaje']
            ];
        }

        $messages[] = [
            'role' => 'user',
            'content' => $message
        ];

        $payload = [
            'model' => $model,
            'messages' => $messages,
            'temperature' => 0.4,
            'max_tokens' => 600,
        ];

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            "Authorization: Bearer {$apiKey}"
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 20);

        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($err || $httpCode !== 200) {
            throw new Exception("OpenAI API error (HTTP {$httpCode}): " . ($result ?: $err));
        }

        $json = json_decode($result, true);
        $reply = $json['choices'][0]['message']['content'] ?? null;

        if (!$reply) {
            throw new Exception("OpenAI returned invalid structure: {$result}");
        }

        return trim($reply);
    }

    /**
     * Construye el System Prompt con el catálogo inyectado y reglas de enlaces
     */
    private function buildSystemPrompt(array $catalog): string {
        $tiendaNombre = $this->negocio['nombre'];
        $tiendaUrl = "{$this->frontendUrl}/{$this->negocio['slug']}";
        $extra = trim($this->waConfig['system_prompt_extra'] ?? '');

        // Formato limpio del inventario en texto
        $catalogText = "";
        foreach ($catalog as $prod) {
            $cat = $prod['categoria'] ? " [{$prod['categoria']}]" : "";
            $desc = $prod['descripcion'] ? " - {$prod['descripcion']}" : "";
            $precio = number_format((float)$prod['precio_venta'], 2);
            $stock = (int)$prod['stock'];
            $cartUrl = $this->generateCartUrl((int)$prod['id'], 1);

            $catalogText .= "- [ID: {$prod['id']}] {$prod['nombre']}{$cat}: Precio: \${$precio} | Stock disponible: {$stock} unidades{$desc} | Enlace directo: {$cartUrl}\n";
        }

        return "Eres el Asistente Virtual y Gancho de Ventas oficial de la tienda '{$tiendaNombre}' por WhatsApp.
Tu objetivo es brindar una atención amable, ágil y cerrar ventas guiando al cliente con información precisa de stock y precios.

TIENDA WEB OFICIAL: {$tiendaUrl}

INVENTARIO EN TIEMPO REAL (ACCESO DE SOLO LECTURA):
{$catalogText}

REGLAS DE CONDUCTA OBLIGATORIAS:
1. INFORMACIÓN DE STOCK: Responde ÚNICAMENTE basado en la lista de inventario anterior. Si el cliente pregunta si tienen un producto (por ejemplo: '¿Tienen zapatos talla 40?'), busca si coincide en nombre o descripción.
2. DISPONIBILIDAD:
   - Si el producto existe y tiene stock > 0: Confirma amablemente que SÍ está disponible, indica el precio exacto y el stock disponible. Adjunta el 'Enlace directo' para que el cliente pueda añadirlo a su carrito con 1 clic.
   - Si el producto existe pero tiene stock = 0: Informa con educación que actualmente se encuentra agotado y sugiere productos similares o alternativos si existen.
   - Si el producto NO existe en el catálogo: Di con amabilidad que no dispones de ese modelo específico en este momento e invítalo a ver el catálogo completo en la tienda: {$tiendaUrl}
3. ENLACES DIRECTOS: Cuando el cliente demuestre interés en comprar un producto específico disponible, proporciónale siempre su Enlace directo para que concrete su compra fácilmente.
4. TONO: Cercano, comercial, respetuoso y conciso (recuerda que es WhatsApp). Usa emojis con moderación (👋, 🛒, ✨, ✅).
" . ($extra ? "\nINSTRUCCIONES ADICIONALES DEL DUEÑO DEL NEGOCIO:\n{$extra}" : "");
    }

    /**
     * Motor de respuestas de respaldo en caso de que no haya API key de IA
     */
    private function fallbackRuleBasedResponse(string $message, array $catalog): string {
        $msgLower = mb_strtolower($message, 'UTF-8');
        $tiendaUrl = "{$this->frontendUrl}/{$this->negocio['slug']}";

        // Saludos simples
        if (preg_match('/^(hola|buenos|buenas|saludos|que tal|info)/i', $msgLower) && strlen($msgLower) < 25) {
            return "¡Hola! 👋 Bienvenido a *{$this->negocio['nombre']}*. ¿En qué producto estás interesado el día de hoy? Puedes ver todo nuestro catálogo disponible aquí: {$tiendaUrl}";
        }

        // Búsqueda inteligente de productos en el catálogo
        $words = preg_split('/[\s,?.!¿¡]+/', $msgLower, -1, PREG_SPLIT_NO_EMPTY);
        // Filtrar palabras comunes
        $stopwords = ['tienen', 'tiene', 'tienes', 'venden', 'hay', 'precio', 'precios', 'cuanto', 'cuesta', 'cuestan', 'talla', 'modelo', 'quiero', 'buenas', 'hola', 'favor', 'para', 'este', 'esta', 'estos', 'estas', 'del', 'los', 'las', 'una', 'uno', 'un', 'disponible', 'disponibles', 'amigo', 'amiga'];
        $keywords = array_values(array_filter($words, fn($w) => mb_strlen($w) > 2 && !in_array($w, $stopwords)));

        $matches = [];
        foreach ($catalog as $prod) {
            $nameLower = mb_strtolower($prod['nombre'], 'UTF-8');
            $descLower = mb_strtolower($prod['descripcion'] ?? '', 'UTF-8');
            $catLower = mb_strtolower($prod['categoria'] ?? '', 'UTF-8');
            $fullText = "{$nameLower} {$descLower} {$catLower}";

            $score = 0;
            foreach ($keywords as $kw) {
                if (mb_strpos($nameLower, $kw) !== false) {
                    $score += 5; // Coincidencia directa en nombre tiene peso alto
                } elseif (mb_strpos($catLower, $kw) !== false) {
                    $score += 3;
                } elseif (mb_strpos($descLower, $kw) !== false) {
                    $score += 2;
                }
            }
            if ($score > 0) {
                $matches[] = ['product' => $prod, 'score' => $score];
            }
        }


        usort($matches, fn($a, $b) => $b['score'] <=> $a['score']);

        if (!empty($matches)) {
            $top = $matches[0]['product'];
            $precio = number_format((float)$top['precio_venta'], 2);
            $stock = (int)$top['stock'];
            $cartUrl = $this->generateCartUrl((int)$top['id'], 1);

            if ($stock > 0) {
                $reply = "¡Hola! Sí, tenemos disponible *{$top['nombre']}* ✅\n\n";
                $reply .= "💰 *Precio:* \${$precio}\n";
                $reply .= "📦 *Stock disponible:* {$stock} unidad(es)\n";
                if (!empty($top['descripcion'])) {
                    $reply .= "📝 *Detalle:* {$top['descripcion']}\n";
                }
                $reply .= "\n🛒 Puedes agregarlo a tu carrito y pedirlo aquí:\n{$cartUrl}";
                return $reply;
            } else {
                return "¡Hola! Buscamos *{$top['nombre']}*, pero lamentablemente se encuentra actualmente *agotado* 😔.\n\nPuedes revisar otros productos disponibles en nuestra tienda:\n{$tiendaUrl}";
            }
        }

        return "¡Hola! Gracias por comunicarte con *{$this->negocio['nombre']}*. ✨\n\nPuedes consultar todos nuestros productos, precios y realizar tu pedido directamente en nuestra tienda web:\n{$tiendaUrl}\n\nSi buscas un producto en particular, indícame su nombre y te confirmamos disponibilidad.";
    }

    /**
     * Enviar mensaje por WhatsApp saliente según el proveedor configurado
     */
    public function sendWhatsAppMessage(string $recipientPhone, string $message): array {
        $provider = $this->waConfig['provider'] ?? 'meta_official';
        $token = $this->waConfig['api_token'] ?? ($_ENV['WHATSAPP_API_TOKEN'] ?? '');
        $phoneId = $this->waConfig['phone_number_id'] ?? ($_ENV['WHATSAPP_PHONE_NUMBER_ID'] ?? '');

        // Limpieza de teléfono (remover símbolos no numéricos)
        $cleanPhone = preg_replace('/\D+/', '', $recipientPhone);

        if ($provider === 'meta_official') {
            if (empty($token) || empty($phoneId)) {
                return ['success' => false, 'error' => 'Credenciales de Meta WhatsApp no configuradas (Access Token / Phone Number ID).'];
            }
            $url = "https://graph.facebook.com/v19.0/{$phoneId}/messages";
            $payload = [
                'messaging_product' => 'whatsapp',
                'recipient_type' => 'individual',
                'to' => $cleanPhone,
                'type' => 'text',
                'text' => [
                    'preview_url' => true,
                    'body' => $message,
                ],
            ];

            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json',
                "Authorization: Bearer {$token}"
            ]);
            $res = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            return ['success' => $code >= 200 && $code < 300, 'response' => json_decode($res, true) ?: $res];
        }

        if ($provider === 'evolution_api') {
            $apiUrl = rtrim($_ENV['EVOLUTION_API_URL'] ?? 'http://localhost:8080', '/');
            $instance = $phoneId ?: 'pymeweb';
            $url = "{$apiUrl}/message/sendText/{$instance}";

            $payload = [
                'number' => $cleanPhone,
                'text' => $message,
                'options' => [
                    'delay' => 1200,
                    'presence' => 'composing',
                    'linkPreview' => true,
                ]
            ];

            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json',
                "apikey: {$token}"
            ]);
            $res = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            return ['success' => $code >= 200 && $code < 300, 'response' => json_decode($res, true) ?: $res];
        }

        return ['success' => false, 'error' => "Proveedor {$provider} no soportado para envío automático."];
    }

    /**
     * Registro de mensajes en la base de datos
     */
    private function logMessage(string $phone, string $name, string $direction, string $text, ?string $raw = null): void {
        try {
            $stmt = $this->db->prepare("
                INSERT INTO whatsapp_mensajes (negocio_id, cliente_telefono, cliente_nombre, direccion, mensaje, raw_payload)
                VALUES (:nid, :tel, :nom, :dir, :msg, :raw)
            ");
            $stmt->execute([
                'nid' => $this->negocioId,
                'tel' => $phone,
                'nom' => $name ?: null,
                'dir' => $direction,
                'msg' => $text,
                'raw' => $raw,
            ]);
        } catch (Throwable $e) {
            error_log("Failed to log WA message: " . $e->getMessage());
        }
    }

    /**
     * Obtener mensajes recientes
     */
    private function getRecentConversation(string $phone, int $limit = 6): array {
        $stmt = $this->db->prepare("
            SELECT direccion, mensaje 
            FROM whatsapp_mensajes 
            WHERE negocio_id = :nid AND cliente_telefono = :tel 
            ORDER BY id DESC 
            LIMIT {$limit}
        ");
        $stmt->execute(['nid' => $this->negocioId, 'tel' => $phone]);
        $rows = $stmt->fetchAll();
        return array_reverse($rows);
    }
}
