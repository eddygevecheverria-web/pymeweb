<?php
declare(strict_types=1);

/**
 * Cliente SOAP para los Web Services del SRI Ecuador
 * - WSDL Recepción: https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl (Pruebas)
 * - WSDL Autorización: https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl (Pruebas)
 */
class SriSoapClient {
    private int $ambiente; // 1 = Pruebas (celcer), 2 = Producción (cel)

    const URL_RECEPCION_PRUEBAS    = 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl';
    const URL_AUTORIZACION_PRUEBAS = 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl';

    const URL_RECEPCION_PROD       = 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl';
    const URL_AUTORIZACION_PROD    = 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl';

    public function __construct(int $ambiente = 1) {
        $this->ambiente = $ambiente;
    }

    private function getUrlRecepcion(): string {
        return ($this->ambiente === 2) ? self::URL_RECEPCION_PROD : self::URL_RECEPCION_PRUEBAS;
    }

    private function getUrlAutorizacion(): string {
        return ($this->ambiente === 2) ? self::URL_AUTORIZACION_PROD : self::URL_AUTORIZACION_PRUEBAS;
    }

    /**
     * Envía el XML firmado al Web Service de Recepción del SRI mediante cURL SOAP Envelope
     */
    public function enviarComprobante(string $xmlFirmado): array {
        $xmlBase64 = base64_encode($xmlFirmado);

        $soapEnvelope = '<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.recepcion">
   <soapenv:Header/>
   <soapenv:Body>
      <ec:validarComprobante>
         <xml>' . $xmlBase64 . '</xml>
      </ec:validarComprobante>
   </soapenv:Body>
</soapenv:Envelope>';

        $url = str_replace('?wsdl', '', $this->getUrlRecepcion());
        $response = $this->callCurlSoap($url, $soapEnvelope, 'validarComprobante');

        if (!$response['success']) {
            return [
                'success' => false,
                'estado'  => 'ERROR_CONEXION',
                'mensaje' => $response['error'] ?? 'No se pudo conectar al servidor de Recepción del SRI.',
            ];
        }

        // Parsear respuesta XML
        $xmlResp = @simplexml_load_string($response['data']);
        if ($xmlResp === false) {
            return [
                'success' => false,
                'estado'  => 'ERROR_PARSING',
                'mensaje' => 'Respuesta no válida del SRI: ' . substr($response['data'], 0, 300),
            ];
        }

        $xmlResp->registerXPathNamespace('ns2', 'http://ec.gob.sri.ws.recepcion');
        $estadoNodes = $xmlResp->xpath('//estado');
        $estado = isset($estadoNodes[0]) ? (string)$estadoNodes[0] : 'DEVUELTA';

        if ($estado === 'RECIBIDA') {
            return [
                'success' => true,
                'estado'  => 'RECIBIDA',
                'raw'     => $response['data'],
            ];
        }

        // En caso de DEVUELTA, extraer mensajes de error
        $mensajes = [];
        $msgNodes = $xmlResp->xpath('//comprobante/mensajes/mensaje');
        foreach ($msgNodes as $m) {
            $id = (string)($m->identificador ?? '');
            $texto = (string)($m->mensaje ?? '');
            $info = (string)($m->informacionAdicional ?? '');
            $tipo = (string)($m->tipo ?? 'ERROR');
            $mensajes[] = "[{$id}] {$texto}" . ($info ? " - {$info}" : "");
        }

        return [
            'success'  => false,
            'estado'   => 'DEVUELTA',
            'mensajes' => $mensajes,
            'mensaje'  => implode(' | ', $mensajes) ?: 'Comprobante DEVUELTO por el SRI.',
            'raw'      => $response['data'],
        ];
    }

    /**
     * Consulta la autorización de un comprobante mediante su Clave de Acceso (49 dígitos)
     */
    public function consultarAutorizacion(string $claveAcceso): array {
        $soapEnvelope = '<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">
   <soapenv:Header/>
   <soapenv:Body>
      <ec:autorizacionComprobante>
         <claveAccesoComprobante>' . $claveAcceso . '</claveAccesoComprobante>
      </ec:autorizacionComprobante>
   </soapenv:Body>
</soapenv:Envelope>';

        $url = str_replace('?wsdl', '', $this->getUrlAutorizacion());
        $response = $this->callCurlSoap($url, $soapEnvelope, 'autorizacionComprobante');

        if (!$response['success']) {
            return [
                'success' => false,
                'estado'  => 'ERROR_CONEXION',
                'mensaje' => $response['error'] ?? 'No se pudo conectar al servidor de Autorización del SRI.',
            ];
        }

        $xmlResp = @simplexml_load_string($response['data']);
        if ($xmlResp === false) {
            return [
                'success' => false,
                'estado'  => 'ERROR_PARSING',
                'mensaje' => 'Respuesta no válida del SRI: ' . substr($response['data'], 0, 300),
            ];
        }

        $xmlResp->registerXPathNamespace('ns2', 'http://ec.gob.sri.ws.autorizacion');
        $autorizaciones = $xmlResp->xpath('//autorizacion');

        if (empty($autorizaciones)) {
            return [
                'success' => false,
                'estado'  => 'NO_AUTORIZADO',
                'mensaje' => 'No se encontró registro de autorización para la clave de acceso.',
            ];
        }

        $aut = $autorizaciones[0];
        $estado = (string)($aut->estado ?? 'NO_AUTORIZADO');
        $numeroAutorizacion = (string)($aut->numeroAutorizacion ?? $claveAcceso);
        $fechaAutorizacion = (string)($aut->fechaAutorizacion ?? date('Y-m-d H:i:s'));
        $comprobanteXml = (string)($aut->comprobante ?? '');

        if ($estado === 'AUTORIZADO') {
            return [
                'success'              => true,
                'estado'               => 'AUTORIZADO',
                'numero_autorizacion'  => $numeroAutorizacion,
                'fecha_autorizacion'   => $fechaAutorizacion,
                'comprobante_xml'      => $comprobanteXml,
            ];
        }

        $mensajes = [];
        if (isset($aut->mensajes->mensaje)) {
            foreach ($aut->mensajes->mensaje as $m) {
                $mensajes[] = "[{$m->identificador}] {$m->mensaje}" . (!empty($m->informacionAdicional) ? " - {$m->informacionAdicional}" : "");
            }
        }

        return [
            'success'  => false,
            'estado'   => $estado,
            'mensaje'  => implode(' | ', $mensajes) ?: "Comprobante en estado: {$estado}",
            'mensajes' => $mensajes,
        ];
    }

    /**
     * Ejecuta la llamada HTTP SOAP utilizando cURL con timeout configurado
     */
    private function callCurlSoap(string $url, string $soapBody, string $action): array {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $soapBody);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: text/xml; charset=utf-8',
            'SOAPAction: ""',
            'Content-Length: ' . strlen($soapBody),
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 8);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($err || $httpCode < 200 || $httpCode >= 400) {
            return [
                'success' => false,
                'error'   => "Error de conexión SOAP (HTTP {$httpCode}): " . ($err ?: substr($result ?: '', 0, 200)),
            ];
        }

        return [
            'success' => true,
            'data'    => $result,
        ];
    }
}
