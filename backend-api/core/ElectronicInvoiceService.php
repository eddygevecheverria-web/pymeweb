<?php
declare(strict_types=1);

class ElectronicInvoiceService {
    public static function buildXmlAndJson(array $negocio, array $cliente, array $venta, array $detalles, string $serie, int $correlativo): array {
        $numeroComprobante = sprintf('%s-%08d', $serie, $correlativo);
        $fechaEmision      = date('Y-m-d');
        $horaEmision       = date('H:i:s');

        $cadenaOriginal = implode('|', [
            $negocio['ruc_nit'] ?? '00000000000',
            $numeroComprobante,
            $fechaEmision,
            number_format((float)$venta['subtotal'], 2, '.', ''),
            number_format((float)$venta['impuesto'], 2, '.', ''),
            number_format((float)$venta['total'], 2, '.', ''),
            $cliente['documento'] ?? '00000000'
        ]);
        $cufeHash = hash('sha256', $cadenaOriginal);

        $jsonPayload = [
            'ubl_version'        => '2.1',
            'tipo_comprobante'   => '01',
            'numero_comprobante' => $numeroComprobante,
            'fecha_emision'      => $fechaEmision,
            'hora_emision'       => $horaEmision,
            'moneda'             => 'USD',
            'cufe_hash'          => $cufeHash,
            'emisor'             => [
                'ruc_nit'      => $negocio['ruc_nit'] ?? 'SIN-RUC',
                'razon_social' => $negocio['nombre'],
                'direccion'    => $negocio['direccion'] ?? '',
                'telefono'     => $negocio['telefono'] ?? '',
                'logo_url'     => $negocio['logo_url'] ?? null,
            ],
            'adquirente'         => [
                'documento' => $cliente['documento'] ?? '99999999',
                'nombre'    => $cliente['nombre'] ?? 'Consumidor Final',
                'email'     => $cliente['email'] ?? '',
                'direccion' => $cliente['direccion'] ?? '',
            ],
            'totales'            => [
                'gravado'  => (float)$venta['subtotal'],
                'igv_iva'  => (float)$venta['impuesto'],
                'total'    => (float)$venta['total'],
            ],
            'items'              => array_map(static function (array $d): array {
                return [
                    'producto_id'     => (int)$d['producto_id'],
                    'descripcion'     => $d['nombre_producto'],
                    'cantidad'        => (int)$d['cantidad'],
                    'precio_unitario' => (float)$d['precio_unitario'],
                    'subtotal_item'   => (float)$d['subtotal'],
                ];
            }, $detalles),
        ];

        $jsonString = json_encode($jsonPayload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        $dom = new DOMDocument('1.0', 'UTF-8');
        $dom->formatOutput = true;

        $invoice = $dom->createElementNS('urn:oasis:names:specification:ubl:schema:xsd:Invoice-2', 'Invoice');
        $invoice->setAttribute('xmlns:cac', 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2');
        $invoice->setAttribute('xmlns:cbc', 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2');
        $dom->appendChild($invoice);

        $invoice->appendChild($dom->createElement('cbc:UBLVersionID', '2.1'));
        $invoice->appendChild($dom->createElement('cbc:ID', $numeroComprobante));
        $invoice->appendChild($dom->createElement('cbc:IssueDate', $fechaEmision));
        $invoice->appendChild($dom->createElement('cbc:IssueTime', $horaEmision));
        $invoice->appendChild($dom->createElement('cbc:UUID', $cufeHash));
        $invoice->appendChild($dom->createElement('cbc:DocumentCurrencyCode', 'USD'));

        $supplier = $dom->createElement('cac:AccountingSupplierParty');
        $supplier->appendChild($dom->createElement('cbc:CustomerAssignedAccountID', htmlspecialchars($negocio['ruc_nit'] ?? '00000000000')));
        $supplier->appendChild($dom->createElement('cbc:RegistrationName', htmlspecialchars($negocio['nombre'])));
        $invoice->appendChild($supplier);

        $customer = $dom->createElement('cac:AccountingCustomerParty');
        $customer->appendChild($dom->createElement('cbc:CustomerAssignedAccountID', htmlspecialchars($cliente['documento'] ?? '99999999')));
        $customer->appendChild($dom->createElement('cbc:RegistrationName', htmlspecialchars($cliente['nombre'] ?? 'Consumidor Final')));
        $invoice->appendChild($customer);

        $taxTotal = $dom->createElement('cac:TaxTotal');
        $taxTotal->appendChild($dom->createElement('cbc:TaxAmount', number_format((float)$venta['impuesto'], 2, '.', '')));
        $invoice->appendChild($taxTotal);

        $legalMonetary = $dom->createElement('cac:LegalMonetaryTotal');
        $legalMonetary->appendChild($dom->createElement('cbc:LineExtensionAmount', number_format((float)$venta['subtotal'], 2, '.', '')));
        $legalMonetary->appendChild($legalMonetary->ownerDocument->createElement('cbc:PayableAmount', number_format((float)$venta['total'], 2, '.', '')));
        $invoice->appendChild($legalMonetary);

        foreach ($detalles as $idx => $det) {
            $line = $dom->createElement('cac:InvoiceLine');
            $line->appendChild($dom->createElement('cbc:ID', (string)($idx + 1)));
            $line->appendChild($dom->createElement('cbc:InvoicedQuantity', (string)$det['cantidad']));
            $line->appendChild($dom->createElement('cbc:LineExtensionAmount', number_format((float)$det['subtotal'], 2, '.', '')));

            $itemNode = $dom->createElement('cac:Item');
            $itemNode->appendChild($dom->createElement('cbc:Description', htmlspecialchars($det['nombre_producto'])));
            $line->appendChild($itemNode);

            $priceNode = $dom->createElement('cac:Price');
            $priceNode->appendChild($dom->createElement('cbc:PriceAmount', number_format((float)$det['precio_unitario'], 2, '.', '')));
            $line->appendChild($priceNode);

            $invoice->appendChild($line);
        }

        return [
            'numero_comprobante' => $numeroComprobante,
            'cufe_hash'          => $cufeHash,
            'xml'                => $dom->saveXML(),
            'json'               => $jsonString
        ];
    }
}
