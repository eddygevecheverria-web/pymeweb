<?php
declare(strict_types=1);

require_once __DIR__ . '/DocumentoElectronicoSRI.php';

class FacturaSRI implements DocumentoElectronicoSRI {
    private array $emisor;
    private array $cliente;
    private array $venta;
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
        array $venta,
        array $detalles,
        string $serie = '001001',
        int $secuencial = 1,
        int $ambiente = 1,
        int $tipoEmision = 1
    ) {
        $this->emisor      = $emisor;
        $this->cliente     = $cliente;
        $this->venta       = $venta;
        $this->detalles    = $detalles;
        $this->serie       = str_pad(preg_replace('/\D/', '', $serie) ?: '001001', 6, '0', STR_PAD_LEFT);
        $this->secuencial  = $secuencial;
        $this->ambiente    = $ambiente;
        $this->tipoEmision = $tipoEmision;
        $this->codigoNumerico = sprintf('%08d', mt_rand(10000000, 99999999));

        $this->claveAcceso = $this->generarClaveAcceso();
    }

    public function getTipoDocumento(): string {
        return '01'; // 01 = Factura
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

    /**
     * Genera la Clave de Acceso de 49 dígitos con Módulo 11
     */
    private function generarClaveAcceso(): string {
        // Formato: ddmmaaaa + tipoComprobante(2) + ruc(13) + ambiente(1) + serie(6) + secuencial(9) + codigoNumerico(8) + tipoEmision(1) = 48 dígitos
        $fecha = date('dmY', strtotime($this->venta['created_at'] ?? 'now'));
        $tipoDoc = $this->getTipoDocumento(); // 01
        $ruc = str_pad(preg_replace('/\D/', '', $this->emisor['ruc'] ?? '1790011122001'), 13, '0', STR_PAD_RIGHT);
        $amb = (string)$this->ambiente;
        $serie = $this->serie;
        $sec = sprintf('%09d', $this->secuencial);
        $codNum = $this->codigoNumerico;
        $emision = (string)$this->tipoEmision;

        $cadena48 = "{$fecha}{$tipoDoc}{$ruc}{$amb}{$serie}{$sec}{$codNum}{$emision}";
        $digitoVerificador = $this->calcularModulo11($cadena48);

        return $cadena48 . $digitoVerificador;
    }

    /**
     * Algoritmo Módulo 11 con ponderación 7..2 según ficha técnica SRI
     */
    private function calcularModulo11(string $cadena): int {
        $multiplicador = 2;
        $suma = 0;
        for ($i = strlen($cadena) - 1; $i >= 0; $i--) {
            $suma += (int)$cadena[$i] * $multiplicador;
            $multiplicador++;
            if ($multiplicador > 7) {
                $multiplicador = 2;
            }
        }
        $residuo = $suma % 11;
        $resultado = 11 - $residuo;

        if ($resultado === 11) return 0;
        if ($resultado === 10) return 1;
        return $resultado;
    }

    /**
     * Genera el XML oficial de la Factura según el esquema del SRI (v1.1.0)
     */
    public function generarXml(): string {
        $dom = new DOMDocument('1.0', 'UTF-8');
        $dom->formatOutput = true;

        $factura = $dom->createElement('factura');
        $factura->setAttribute('id', 'comprobante');
        $factura->setAttribute('version', '1.1.0');
        $dom->appendChild($factura);

        // 1. infoTributaria
        $infoTrib = $dom->createElement('infoTributaria');
        $infoTrib->appendChild($dom->createElement('ambiente', (string)$this->ambiente));
        $infoTrib->appendChild($dom->createElement('tipoEmision', (string)$this->tipoEmision));
        $infoTrib->appendChild($dom->createElement('razonSocial', htmlspecialchars($this->emisor['razon_social'])));
        if (!empty($this->emisor['nombre_comercial'])) {
            $infoTrib->appendChild($dom->createElement('nombreComercial', htmlspecialchars($this->emisor['nombre_comercial'])));
        }
        $infoTrib->appendChild($dom->createElement('ruc', $this->emisor['ruc']));
        $infoTrib->appendChild($dom->createElement('claveAcceso', $this->claveAcceso));
        $infoTrib->appendChild($dom->createElement('codDoc', $this->getTipoDocumento()));
        $infoTrib->appendChild($dom->createElement('estab', substr($this->serie, 0, 3)));
        $infoTrib->appendChild($dom->createElement('ptoEmi', substr($this->serie, 3, 3)));
        $infoTrib->appendChild($dom->createElement('secuencial', sprintf('%09d', $this->secuencial)));
        $infoTrib->appendChild($dom->createElement('dirMatriz', htmlspecialchars($this->emisor['dir_matriz'] ?? 'Ecuador')));

        // Régimen RIMPE si aplica
        $tipoContr = $this->emisor['tipo_contribuyente'] ?? 'REGIMEN_GENERAL';
        if ($tipoContr === 'RIMPE_EMPRENDEDOR') {
            $infoTrib->appendChild($dom->createElement('regimenMicroempresas', 'CONTRIBUYENTE RÉGIMEN RIMPE'));
        } elseif ($tipoContr === 'RIMPE_NEGOCIO_POPULAR') {
            $infoTrib->appendChild($dom->createElement('contribuyenteRimpe', 'CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE'));
        }
        $factura->appendChild($infoTrib);

        // 2. infoFactura
        $infoFac = $dom->createElement('infoFactura');
        $fechaEmisionStr = date('d/m/Y', strtotime($this->venta['created_at'] ?? 'now'));
        $infoFac->appendChild($dom->createElement('fechaEmision', $fechaEmisionStr));
        $infoFac->appendChild($dom->createElement('dirEstablecimiento', htmlspecialchars($this->emisor['dir_establecimiento'] ?? $this->emisor['dir_matriz'] ?? 'Ecuador')));
        
        $obligado = $this->emisor['obligado_contabilidad'] ?? 'NO';
        $infoFac->appendChild($dom->createElement('obligadoContabilidad', $obligado));

        // Tipo identificación comprador:
        // 04 = RUC (13 dígitos)
        // 05 = Cédula (10 dígitos)
        // 06 = Pasaporte
        // 07 = Consumidor Final (9999999999999)
        $docComprador = preg_replace('/\D/', '', $this->cliente['documento'] ?? '');
        $tipoId = '07';
        $idComprador = '9999999999999';

        if (strlen($docComprador) === 13 && $docComprador !== '9999999999999') {
            $tipoId = '04';
            $idComprador = $docComprador;
        } elseif (strlen($docComprador) === 10) {
            $tipoId = '05';
            $idComprador = $docComprador;
        }

        $infoFac->appendChild($dom->createElement('tipoIdentificacionComprador', $tipoId));
        $infoFac->appendChild($dom->createElement('razonSocialComprador', htmlspecialchars($this->cliente['nombre'] ?? 'CONSUMIDOR FINAL')));
        $infoFac->appendChild($dom->createElement('identificacionComprador', $idComprador));
        if (!empty($this->cliente['direccion'])) {
            $infoFac->appendChild($dom->createElement('direccionComprador', htmlspecialchars($this->cliente['direccion'])));
        }

        // Agrupación dinámica de impuestos (totalConImpuestos)
        $impuestosGroup = [];
        $totalSinImpuestos = 0.0;
        $totalDescuento = 0.0;

        foreach ($this->detalles as $det) {
            $codImpuesto = (string)($det['sri_codigo_impuesto'] ?? '4'); // 4 = 15%, 2=12%, 0=0%
            $tarifa = (float)($det['sri_tarifa_iva'] ?? 15.00);
            $cant = (float)$det['cantidad'];
            $pu = (float)$det['precio_unitario'];

            $baseImponible = round($cant * $pu, 2);
            $valorIva = ($tarifa > 0) ? round($baseImponible * ($tarifa / 100), 2) : 0.0;

            $totalSinImpuestos += $baseImponible;

            if (!isset($impuestosGroup[$codImpuesto])) {
                $impuestosGroup[$codImpuesto] = [
                    'codigo'        => '2', // 2 = IVA
                    'codigoPorcentaje' => $codImpuesto,
                    'tarifa'        => $tarifa,
                    'baseImponible' => 0.0,
                    'valor'         => 0.0,
                ];
            }
            $impuestosGroup[$codImpuesto]['baseImponible'] += $baseImponible;
            $impuestosGroup[$codImpuesto]['valor'] += $valorIva;
        }

        $infoFac->appendChild($dom->createElement('totalSinImpuestos', number_format($totalSinImpuestos, 2, '.', '')));
        $infoFac->appendChild($dom->createElement('totalDescuento', '0.00'));

        $totalConImp = $dom->createElement('totalConImpuestos');
        $importeTotal = $totalSinImpuestos;

        foreach ($impuestosGroup as $imp) {
            $totalImpNode = $dom->createElement('totalImpuesto');
            $totalImpNode->appendChild($dom->createElement('codigo', $imp['codigo']));
            $totalImpNode->appendChild($dom->createElement('codigoPorcentaje', $imp['codigoPorcentaje']));
            $totalImpNode->appendChild($dom->createElement('baseImponible', number_format($imp['baseImponible'], 2, '.', '')));
            $totalImpNode->appendChild($dom->createElement('tarifa', number_format($imp['tarifa'], 2, '.', '')));
            $totalImpNode->appendChild($dom->createElement('valor', number_format($imp['valor'], 2, '.', '')));
            $totalConImp->appendChild($totalImpNode);

            $importeTotal += $imp['valor'];
        }
        $infoFac->appendChild($totalConImp);

        $infoFac->appendChild($dom->createElement('propina', '0.00'));
        $infoFac->appendChild($dom->createElement('importeTotal', number_format($importeTotal, 2, '.', '')));
        $infoFac->appendChild($dom->createElement('moneda', 'DOLAR'));

        // Formas de Pago según catálogo SRI
        // 01 = Sin utilización del sistema financiero (Efectivo)
        // 19 = Tarjeta de Crédito
        // 20 = Otros con utilización del sistema financiero (Transferencias / Crédito Directo)
        $codFormaPago = '01';
        $metodo = $this->venta['metodo_pago'] ?? 'efectivo';
        if ($metodo === 'transferencia' || $metodo === 'fiado' || $metodo === 'credito_directo') {
            $codFormaPago = '20';
        }

        $pagosNode = $dom->createElement('pagos');
        $pagoNode = $dom->createElement('pago');
        $pagoNode->appendChild($dom->createElement('formaPago', $codFormaPago));
        $pagoNode->appendChild($dom->createElement('total', number_format($importeTotal, 2, '.', '')));
        $pagosNode->appendChild($pagoNode);
        $infoFac->appendChild($pagosNode);

        $factura->appendChild($infoFac);

        // 3. detalles
        $detallesNode = $dom->createElement('detalles');
        foreach ($this->detalles as $idx => $det) {
            $tarifa = (float)($det['sri_tarifa_iva'] ?? 15.00);
            $codImpuesto = (string)($det['sri_codigo_impuesto'] ?? '4');
            $cant = (float)$det['cantidad'];
            $puNeto = (float)$det['precio_unitario'];
            $baseImponible = round($cant * $puNeto, 2);
            $valorIva = ($tarifa > 0) ? round($baseImponible * ($tarifa / 100), 2) : 0.0;

            $detNode = $dom->createElement('detalle');
            $detNode->appendChild($dom->createElement('codigoPrincipal', (string)($det['producto_id'] ?? ($idx + 1))));
            $detNode->appendChild($dom->createElement('descripcion', htmlspecialchars(substr($det['nombre_producto'], 0, 300))));
            $detNode->appendChild($dom->createElement('cantidad', number_format($cant, 2, '.', '')));
            $detNode->appendChild($dom->createElement('precioUnitario', number_format($puNeto, 4, '.', '')));
            $detNode->appendChild($dom->createElement('descuento', '0.00'));
            $detNode->appendChild($dom->createElement('precioTotalSinImpuesto', number_format($baseImponible, 2, '.', '')));

            $impuestosItem = $dom->createElement('impuestos');
            $impItem = $dom->createElement('impuesto');
            $impItem->appendChild($dom->createElement('codigo', '2')); // 2 = IVA
            $impItem->appendChild($dom->createElement('codigoPorcentaje', $codImpuesto));
            $impItem->appendChild($dom->createElement('tarifa', number_format($tarifa, 2, '.', '')));
            $impItem->appendChild($dom->createElement('baseImponible', number_format($baseImponible, 2, '.', '')));
            $impItem->appendChild($dom->createElement('valor', number_format($valorIva, 2, '.', '')));
            $impuestosItem->appendChild($impItem);
            $detNode->appendChild($impuestosItem);

            $detallesNode->appendChild($detNode);
        }
        $factura->appendChild($detallesNode);

        // 4. infoAdicional (Email, Teléfono, Sistema)
        $infoAdic = $dom->createElement('infoAdicional');
        $hasAdic = false;

        if (!empty($this->cliente['email'])) {
            $c1 = $dom->createElement('campoAdicional', htmlspecialchars($this->cliente['email']));
            $c1->setAttribute('nombre', 'Email');
            $infoAdic->appendChild($c1);
            $hasAdic = true;
        }
        if (!empty($this->cliente['telefono'])) {
            $c2 = $dom->createElement('campoAdicional', htmlspecialchars($this->cliente['telefono']));
            $c2->setAttribute('nombre', 'Telefono');
            $infoAdic->appendChild($c2);
            $hasAdic = true;
        }

        $c3 = $dom->createElement('campoAdicional', 'PymeWeb SaaS');
        $c3->setAttribute('nombre', 'Software');
        $infoAdic->appendChild($c3);
        $hasAdic = true;

        if ($hasAdic) {
            $factura->appendChild($infoAdic);
        }

        return $dom->saveXML();
    }
}
