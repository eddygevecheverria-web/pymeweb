<?php
declare(strict_types=1);

require_once __DIR__ . '/DocumentoElectronicoSRI.php';

class ComprobanteRetencionSRI implements DocumentoElectronicoSRI {
    private array $emisor;
    private array $sujeto;
    private array $transaccion;
    private array $impuestos;
    private string $serie;
    private int $secuencial;
    private int $ambiente;
    private int $tipoEmision;
    private string $claveAcceso;
    private string $codigoNumerico;

    public function __construct(
        array $emisor,
        array $sujeto,
        array $transaccion,
        array $impuestos,
        string $serie = '001001',
        int $secuencial = 1,
        int $ambiente = 1,
        int $tipoEmision = 1
    ) {
        $this->emisor        = $emisor;
        $this->sujeto        = $sujeto;
        $this->transaccion   = $transaccion;
        $this->impuestos     = $impuestos;
        $this->serie         = str_pad(preg_replace('/\D/', '', $serie) ?: '001001', 6, '0', STR_PAD_LEFT);
        $this->secuencial    = $secuencial;
        $this->ambiente      = $ambiente;
        $this->tipoEmision   = $tipoEmision;
        $this->codigoNumerico= sprintf('%08d', mt_rand(10000000, 99999999));

        $this->claveAcceso   = $this->generarClaveAcceso();
    }

    public function getTipoDocumento(): string {
        return '07'; // 07 = Comprobante de Retención
    }

    public function getClaveAcceso(): string {
        return $this->claveAcceso;
    }

    public function getNumeroComprobante(): string {
        $estab = substr($this->serie, 0, 3);
        $pto   = substr($this->serie, 3, 3);
        $sec   = sprintf('%09d', $this->secuencial);
        return "{$estab}-{$pto}-{$sec}";
    }

    private function generarClaveAcceso(): string {
        $fecha   = date('dmY', strtotime($this->transaccion['created_at'] ?? 'now'));
        $tipoDoc = $this->getTipoDocumento(); // 07
        $ruc     = str_pad(preg_replace('/\D/', '', $this->emisor['ruc'] ?? '1790011122001'), 13, '0', STR_PAD_RIGHT);
        $amb     = (string)$this->ambiente;
        $serie   = $this->serie;
        $sec     = sprintf('%09d', $this->secuencial);
        $codNum  = $this->codigoNumerico;
        $emision = (string)$this->tipoEmision;

        $cadena48 = "{$fecha}{$tipoDoc}{$ruc}{$amb}{$serie}{$sec}{$codNum}{$emision}";
        $dv = $this->calcularModulo11($cadena48);

        return $cadena48 . $dv;
    }

    private function calcularModulo11(string $cadena): int {
        $multiplicador = 2;
        $suma = 0;
        for ($i = strlen($cadena) - 1; $i >= 0; $i--) {
            $suma += (int)$cadena[$i] * $multiplicador;
            $multiplicador++;
            if ($multiplicador > 7) $multiplicador = 2;
        }
        $residuo = $suma % 11;
        $resultado = 11 - $residuo;
        if ($resultado === 11) return 0;
        if ($resultado === 10) return 1;
        return $resultado;
    }

    public function generarXml(): string {
        $estab = substr($this->serie, 0, 3);
        $pto   = substr($this->serie, 3, 3);
        $sec   = sprintf('%09d', $this->secuencial);
        $fechaEmision = date('d/m/Y', strtotime($this->transaccion['created_at'] ?? 'now'));
        $periodoFiscal = date('m/Y', strtotime($this->transaccion['created_at'] ?? 'now'));

        $docSujeto = trim((string)($this->sujeto['ruc'] ?? $this->sujeto['documento'] ?? '1790011122001'));
        $tipoIdSujeto = '04'; // RUC
        if (strlen($docSujeto) === 10) {
            $tipoIdSujeto = '05'; // Cédula
        }

        $numDocSustento = trim((string)($this->transaccion['numero_factura'] ?? '001-001-000000001'));
        $fechaEmisionSustento = !empty($this->transaccion['fecha_emision'])
            ? date('d/m/Y', strtotime($this->transaccion['fecha_emision']))
            : $fechaEmision;

        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<comprobanteRetencion id="comprobante" version="1.0.0">' . "\n";

        // 1. infoTributaria
        $xml .= '  <infoTributaria>' . "\n";
        $xml .= '    <ambiente>' . $this->ambiente . '</ambiente>' . "\n";
        $xml .= '    <tipoEmision>' . $this->tipoEmision . '</tipoEmision>' . "\n";
        $xml .= '    <razonSocial>' . htmlspecialchars($this->emisor['razon_social'] ?? '', ENT_XML1, 'UTF-8') . '</razonSocial>' . "\n";
        if (!empty($this->emisor['nombre_comercial'])) {
            $xml .= '    <nombreComercial>' . htmlspecialchars($this->emisor['nombre_comercial'], ENT_XML1, 'UTF-8') . '</nombreComercial>' . "\n";
        }
        $xml .= '    <ruc>' . htmlspecialchars($this->emisor['ruc'] ?? '', ENT_XML1, 'UTF-8') . '</ruc>' . "\n";
        $xml .= '    <claveAcceso>' . $this->claveAcceso . '</claveAcceso>' . "\n";
        $xml .= '    <codDoc>07</codDoc>' . "\n";
        $xml .= '    <estab>' . $estab . '</estab>' . "\n";
        $xml .= '    <ptoEmi>' . $pto . '</ptoEmi>' . "\n";
        $xml .= '    <secuencial>' . $sec . '</secuencial>' . "\n";
        $xml .= '    <dirMatriz>' . htmlspecialchars($this->emisor['dir_matriz'] ?? 'Ecuador', ENT_XML1, 'UTF-8') . '</dirMatriz>' . "\n";
        
        $tipoContr = $this->emisor['tipo_contribuyente'] ?? 'REGIMEN_GENERAL';
        if ($tipoContr === 'RIMPE_EMPRENDEDOR') {
            $xml .= '    <regimenMicroempresas>CONTRIBUYENTE RÉGIMEN RIMPE</regimenMicroempresas>' . "\n";
        } elseif ($tipoContr === 'RIMPE_NEGOCIO_POPULAR') {
            $xml .= '    <regimenMicroempresas>CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE</regimenMicroempresas>' . "\n";
        }
        $xml .= '  </infoTributaria>' . "\n";

        // 2. infoCompRetencion
        $xml .= '  <infoCompRetencion>' . "\n";
        $xml .= '    <fechaEmision>' . $fechaEmision . '</fechaEmision>' . "\n";
        $xml .= '    <dirEstablecimiento>' . htmlspecialchars($this->emisor['dir_establecimiento'] ?? $this->emisor['dir_matriz'] ?? 'Ecuador', ENT_XML1, 'UTF-8') . '</dirEstablecimiento>' . "\n";
        if (!empty($this->emisor['contribuyente_especial'])) {
            $xml .= '    <contribuyenteEspecial>' . htmlspecialchars($this->emisor['contribuyente_especial'], ENT_XML1, 'UTF-8') . '</contribuyenteEspecial>' . "\n";
        }
        $xml .= '    <obligadoContabilidad>' . ($this->emisor['obligado_contabilidad'] ?? 'NO') . '</obligadoContabilidad>' . "\n";
        $xml .= '    <tipoIdentificacionSujetoRetenido>' . $tipoIdSujeto . '</tipoIdentificacionSujetoRetenido>' . "\n";
        $xml .= '    <razonSocialSujetoRetenido>' . htmlspecialchars($this->sujeto['razon_social'] ?? 'PROVEEDOR', ENT_XML1, 'UTF-8') . '</razonSocialSujetoRetenido>' . "\n";
        $xml .= '    <identificacionSujetoRetenido>' . htmlspecialchars($docSujeto, ENT_XML1, 'UTF-8') . '</identificacionSujetoRetenido>' . "\n";
        $xml .= '    <periodoFiscal>' . $periodoFiscal . '</periodoFiscal>' . "\n";
        $xml .= '  </infoCompRetencion>' . "\n";

        // 3. impuestos (Retenciones aplicadas)
        $xml .= '  <impuestos>' . "\n";
        foreach ($this->impuestos as $imp) {
            $cod       = (int)($imp['codigo'] ?? 1); // 1 = Renta, 2 = IVA
            $codRet    = htmlspecialchars((string)($imp['codigo_retencion'] ?? ($cod === 1 ? '312' : '721')), ENT_XML1, 'UTF-8');
            $base      = (float)($imp['base_imponible'] ?? 0.0);
            $porc      = (float)($imp['porcentaje'] ?? ($cod === 1 ? 1.75 : 30.0));
            $valRet    = (float)($imp['valor_retenido'] ?? round(($base * $porc) / 100, 2));

            $xml .= '    <impuesto>' . "\n";
            $xml .= '      <codigo>' . $cod . '</codigo>' . "\n";
            $xml .= '      <codigoRetencion>' . $codRet . '</codigoRetencion>' . "\n";
            $xml .= '      <baseImponible>' . number_format($base, 2, '.', '') . '</baseImponible>' . "\n";
            $xml .= '      <porcentajeRetener>' . number_format($porc, 2, '.', '') . '</porcentajeRetener>' . "\n";
            $xml .= '      <valorRetenido>' . number_format($valRet, 2, '.', '') . '</valorRetenido>' . "\n";
            $xml .= '      <codDocSustento>01</codDocSustento>' . "\n"; // 01 = Factura de compra
            $xml .= '      <numDocSustento>' . htmlspecialchars(preg_replace('/\D/', '', $numDocSustento), ENT_XML1, 'UTF-8') . '</numDocSustento>' . "\n";
            $xml .= '      <fechaEmisionDocSustento>' . $fechaEmisionSustento . '</fechaEmisionDocSustento>' . "\n";
            $xml .= '    </impuesto>' . "\n";
        }
        $xml .= '  </impuestos>' . "\n";

        $xml .= '</comprobanteRetencion>';
        return $xml;
    }
}
