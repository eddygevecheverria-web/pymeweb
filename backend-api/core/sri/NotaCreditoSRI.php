<?php
declare(strict_types=1);

require_once __DIR__ . '/DocumentoElectronicoSRI.php';

class NotaCreditoSRI implements DocumentoElectronicoSRI {
    private array $emisor;
    private array $cliente;
    private array $notaCredito;
    private array $detalles;
    private string $serie;
    private int $secuencial;
    private int $ambiente;
    private int $tipoEmision;
    private string $claveAcceso;
    private string $codigoNumerico;

    public function __construct(
        array $emisor,
        array $cliente,
        array $notaCredito,
        array $detalles,
        string $serie = '001001',
        int $secuencial = 1,
        int $ambiente = 1,
        int $tipoEmision = 1
    ) {
        $this->emisor        = $emisor;
        $this->cliente       = $cliente;
        $this->notaCredito   = $notaCredito;
        $this->detalles      = $detalles;
        $this->serie         = str_pad(preg_replace('/\D/', '', $serie) ?: '001001', 6, '0', STR_PAD_LEFT);
        $this->secuencial    = $secuencial;
        $this->ambiente      = $ambiente;
        $this->tipoEmision   = $tipoEmision;
        $this->codigoNumerico= sprintf('%08d', mt_rand(10000000, 99999999));

        $this->claveAcceso   = $this->generarClaveAcceso();
    }

    public function getTipoDocumento(): string {
        return '04'; // 04 = Nota de Crédito
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
        $fecha   = date('dmY', strtotime($this->notaCredito['created_at'] ?? 'now'));
        $tipoDoc = $this->getTipoDocumento(); // 04
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
        $fechaEmision = date('d/m/Y', strtotime($this->notaCredito['created_at'] ?? 'now'));

        $subtotal15 = 0.0;
        $subtotal0  = 0.0;
        $iva15      = 0.0;

        foreach ($this->detalles as $d) {
            $tarifa = (float)($d['tarifa_iva'] ?? 15.0);
            $sub    = (float)$d['subtotal'];
            if ($tarifa > 0) {
                $base = round($sub / (1 + ($tarifa / 100)), 2);
                $subtotal15 += $base;
                $iva15 += round($sub - $base, 2);
            } else {
                $subtotal0 += $sub;
            }
        }

        $subtotal15 = round($subtotal15, 2);
        $subtotal0  = round($subtotal0, 2);
        $iva15      = round($iva15, 2);
        $totalSinImpuestos = round($subtotal15 + $subtotal0, 2);
        $valorModificado   = round($totalSinImpuestos + $iva15, 2);

        $docCliente = trim((string)($this->cliente['documento'] ?? '9999999999999'));
        $tipoIdComprador = '07'; // Consumidor final
        if (strlen($docCliente) === 13 && substr($docCliente, -3) === '001') {
            $tipoIdComprador = '04'; // RUC
        } elseif (strlen($docCliente) === 10) {
            $tipoIdComprador = '05'; // Cédula
        } elseif ($docCliente === '9999999999999' || $docCliente === '9999999999') {
            $tipoIdComprador = '07';
        }

        $numDocModificado = trim((string)($this->notaCredito['numero_factura_modificada'] ?? '001-001-000000001'));
        $fechaDocModificado = !empty($this->notaCredito['fecha_emision_factura_modificada'])
            ? date('d/m/Y', strtotime($this->notaCredito['fecha_emision_factura_modificada']))
            : $fechaEmision;
        $motivo = htmlspecialchars(trim((string)($this->notaCredito['motivo'] ?? 'Devolución de mercadería')), ENT_XML1, 'UTF-8');

        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<notaCredito id="comprobante" version="1.1.0">' . "\n";

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
        $xml .= '    <codDoc>04</codDoc>' . "\n";
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

        // 2. infoNotaCredito
        $xml .= '  <infoNotaCredito>' . "\n";
        $xml .= '    <fechaEmision>' . $fechaEmision . '</fechaEmision>' . "\n";
        $xml .= '    <dirEstablecimiento>' . htmlspecialchars($this->emisor['dir_establecimiento'] ?? $this->emisor['dir_matriz'] ?? 'Ecuador', ENT_XML1, 'UTF-8') . '</dirEstablecimiento>' . "\n";
        $xml .= '    <tipoIdentificacionComprador>' . $tipoIdComprador . '</tipoIdentificacionComprador>' . "\n";
        $xml .= '    <razonSocialComprador>' . htmlspecialchars($this->cliente['nombre'] ?? 'CONSUMIDOR FINAL', ENT_XML1, 'UTF-8') . '</razonSocialComprador>' . "\n";
        $xml .= '    <identificacionComprador>' . htmlspecialchars($docCliente, ENT_XML1, 'UTF-8') . '</identificacionComprador>' . "\n";
        if (!empty($this->emisor['contribuyente_especial'])) {
            $xml .= '    <contribuyenteEspecial>' . htmlspecialchars($this->emisor['contribuyente_especial'], ENT_XML1, 'UTF-8') . '</contribuyenteEspecial>' . "\n";
        }
        $xml .= '    <obligadoContabilidad>' . ($this->emisor['obligado_contabilidad'] ?? 'NO') . '</obligadoContabilidad>' . "\n";
        $xml .= '    <codDocModificado>01</codDocModificado>' . "\n";
        $xml .= '    <numDocModificado>' . htmlspecialchars($numDocModificado, ENT_XML1, 'UTF-8') . '</numDocModificado>' . "\n";
        $xml .= '    <fechaEmisionDocSustento>' . $fechaDocModificado . '</fechaEmisionDocSustento>' . "\n";
        $xml .= '    <totalSinImpuestos>' . number_format($totalSinImpuestos, 2, '.', '') . '</totalSinImpuestos>' . "\n";
        $xml .= '    <modificacion>' . number_format($valorModificado, 2, '.', '') . '</modificacion>' . "\n";
        $xml .= '    <moneda>DOLAR</moneda>' . "\n";

        // totalConImpuestos
        $xml .= '    <totalConImpuestos>' . "\n";
        if ($subtotal15 > 0) {
            $xml .= '      <totalImpuesto>' . "\n";
            $xml .= '        <codigo>2</codigo>' . "\n";
            $xml .= '        <codigoPorcentaje>4</codigoPorcentaje>' . "\n";
            $xml .= '        <baseImponible>' . number_format($subtotal15, 2, '.', '') . '</baseImponible>' . "\n";
            $xml .= '        <valor>' . number_format($iva15, 2, '.', '') . '</valor>' . "\n";
            $xml .= '      </totalImpuesto>' . "\n";
        }
        if ($subtotal0 > 0) {
            $xml .= '      <totalImpuesto>' . "\n";
            $xml .= '        <codigo>2</codigo>' . "\n";
            $xml .= '        <codigoPorcentaje>0</codigoPorcentaje>' . "\n";
            $xml .= '        <baseImponible>' . number_format($subtotal0, 2, '.', '') . '</baseImponible>' . "\n";
            $xml .= '        <valor>0.00</valor>' . "\n";
            $xml .= '      </totalImpuesto>' . "\n";
        }
        $xml .= '    </totalConImpuestos>' . "\n";
        $xml .= '    <motivo>' . $motivo . '</motivo>' . "\n";
        $xml .= '  </infoNotaCredito>' . "\n";

        // 3. detalles
        $xml .= '  <detalles>' . "\n";
        foreach ($this->detalles as $d) {
            $cant   = (int)($d['cantidad'] ?? 1);
            $tarifa = (float)($d['tarifa_iva'] ?? 15.0);
            $sub    = (float)$d['subtotal'];
            $base   = ($tarifa > 0) ? round($sub / (1 + ($tarifa / 100)), 2) : $sub;
            $pUnit  = round($base / max(1, $cant), 4);
            $vIva   = round($sub - $base, 2);

            $xml .= '    <detalle>' . "\n";
            $xml .= '      <codigoInterno>' . htmlspecialchars((string)($d['producto_id'] ?? 'ITEM'), ENT_XML1, 'UTF-8') . '</codigoInterno>' . "\n";
            $xml .= '      <descripcion>' . htmlspecialchars((string)($d['nombre_producto'] ?? 'Producto'), ENT_XML1, 'UTF-8') . '</descripcion>' . "\n";
            $xml .= '      <cantidad>' . number_format($cant, 2, '.', '') . '</cantidad>' . "\n";
            $xml .= '      <precioUnitario>' . number_format($pUnit, 4, '.', '') . '</precioUnitario>' . "\n";
            $xml .= '      <descuento>0.00</descuento>' . "\n";
            $xml .= '      <precioTotalSinImpuesto>' . number_format($base, 2, '.', '') . '</precioTotalSinImpuesto>' . "\n";
            $xml .= '      <impuestos>' . "\n";
            $xml .= '        <impuesto>' . "\n";
            $xml .= '          <codigo>2</codigo>' . "\n";
            $xml .= '          <codigoPorcentaje>' . ($tarifa > 0 ? '4' : '0') . '</codigoPorcentaje>' . "\n";
            $xml .= '          <tarifa>' . number_format($tarifa, 2, '.', '') . '</tarifa>' . "\n";
            $xml .= '          <baseImponible>' . number_format($base, 2, '.', '') . '</baseImponible>' . "\n";
            $xml .= '          <valor>' . number_format($vIva, 2, '.', '') . '</valor>' . "\n";
            $xml .= '        </impuesto>' . "\n";
            $xml .= '      </impuestos>' . "\n";
            $xml .= '    </detalle>' . "\n";
        }
        $xml .= '  </detalles>' . "\n";

        $xml .= '</notaCredito>';
        return $xml;
    }
}
