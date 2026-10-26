<?php
declare(strict_types=1);

require_once __DIR__ . '/../PdfInvoiceGenerator.php';

class SriRideGenerator {
    /**
     * Genera la Representación Impresa de un Documento Electrónico (RIDE - Factura)
     */
    public static function generate(
        array $emisor,
        array $cliente,
        string $numeroComprobante,
        string $claveAcceso,
        string $fechaAutorizacion,
        string $numeroAutorizacion,
        int $ambiente,
        float $subtotal,
        float $impuesto,
        float $total,
        string $metodoPago,
        array $detalles,
        string $estadoSri = 'AUTORIZADO'
    ): string {
        $pdf = new SimplePdf();
        $pdf->addPage();

        // 1. Encabezado Emisor (Izquierda)
        $pdf->setFont('Helvetica-Bold', 15);
        $pdf->drawText(40, 770, substr($emisor['razon_social'] ?? 'EMPRESA SA', 0, 36));

        $pdf->setFont('Helvetica', 8.5);
        if (!empty($emisor['nombre_comercial'])) {
            $pdf->drawText(40, 756, "Nombre Comercial: " . substr($emisor['nombre_comercial'], 0, 40));
        }
        $pdf->drawText(40, 743, "Matriz: " . substr($emisor['dir_matriz'] ?? 'Ecuador', 0, 48));
        $pdf->drawText(40, 730, "Sucursal: " . substr($emisor['dir_establecimiento'] ?? $emisor['dir_matriz'] ?? 'Ecuador', 0, 48));
        $pdf->drawText(40, 717, "Obligado a Llevar Contabilidad: " . ($emisor['obligado_contabilidad'] ?? 'NO'));

        $tipoContr = $emisor['tipo_contribuyente'] ?? 'REGIMEN_GENERAL';
        if ($tipoContr === 'RIMPE_EMPRENDEDOR') {
            $pdf->setFont('Helvetica-Bold', 8);
            $pdf->drawText(40, 704, "CONTRIBUYENTE RÉGIMEN RIMPE");
        } elseif ($tipoContr === 'RIMPE_NEGOCIO_POPULAR') {
            $pdf->setFont('Helvetica-Bold', 8);
            $pdf->drawText(40, 704, "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE");
        }

        // 2. Cuadro Tributario SRI (Derecha)
        $pdf->drawRect(330, 640, 225, 145, 0.98, 0.98, 0.98);
        $pdf->setFont('Helvetica-Bold', 11);
        $pdf->drawText(340, 770, "R.U.C.: " . ($emisor['ruc'] ?? '1790011122001'));
        $pdf->drawText(340, 755, "FACTURA");
        $pdf->setFont('Helvetica', 9);
        $pdf->drawText(340, 742, "No. " . $numeroComprobante);
        $pdf->drawText(340, 729, "NÚMERO DE AUTORIZACIÓN:");
        $pdf->setFont('Helvetica-Bold', 7);
        $pdf->drawText(340, 718, $numeroAutorizacion ?: $claveAcceso);

        $pdf->setFont('Helvetica', 8);
        $pdf->drawText(340, 705, "FECHA AUTORIZACIÓN: " . $fechaAutorizacion);
        $pdf->drawText(340, 692, "AMBIENTE: " . ($ambiente === 2 ? 'PRODUCCIÓN' : 'PRUEBAS'));
        $pdf->drawText(340, 679, "EMISIÓN: NORMAL");
        $pdf->drawText(340, 666, "CLAVE DE ACCESO:");
        $pdf->setFont('Helvetica-Bold', 7);
        $pdf->drawText(340, 654, $claveAcceso);

        // Barra de código representativa
        $pdf->drawRect(340, 642, 205, 7, 0.2, 0.2, 0.2);

        // 3. Datos del Adquirente / Cliente
        $pdf->drawRect(40, 580, 515, 50, 0.96, 0.96, 0.96);
        $pdf->setFont('Helvetica-Bold', 8.5);
        $pdf->drawText(50, 618, "Razón Social / Nombres: " . substr($cliente['nombre'] ?? 'CONSUMIDOR FINAL', 0, 45));
        $pdf->drawText(50, 604, "Identificación: " . ($cliente['documento'] ?? '9999999999999'));
        $pdf->setFont('Helvetica', 8.5);
        $pdf->drawText(50, 590, "Dirección: " . substr($cliente['direccion'] ?? 'S/N', 0, 50));
        $pdf->drawText(350, 604, "Fecha Emisión: " . date('d/m/Y'));

        // 4. Tabla de Ítems
        $pdf->drawRect(40, 550, 515, 20, 0.15, 0.25, 0.45);
        $pdf->setTextColor(1, 1, 1);
        $pdf->setFont('Helvetica-Bold', 8.5);
        $pdf->drawText(45, 556, "Cod.");
        $pdf->drawText(100, 556, "Descripción");
        $pdf->drawText(330, 556, "Cant.");
        $pdf->drawText(380, 556, "Precio Unit.");
        $pdf->drawText(450, 556, "Tarifa IVA");
        $pdf->drawText(510, 556, "Subtotal");

        $pdf->setTextColor(0, 0, 0);
        $pdf->setFont('Helvetica', 8);

        $y = 530;
        foreach ($detalles as $det) {
            if ($y < 180) break; // Límite de página única
            $pdf->drawText(45, $y, substr((string)($det['producto_id'] ?? '-'), 0, 8));
            $pdf->drawText(100, $y, substr($det['nombre_producto'] ?? 'Item', 0, 36));
            $pdf->drawText(335, $y, number_format((float)$det['cantidad'], 2));
            $pdf->drawText(385, $y, "$" . number_format((float)$det['precio_unitario'], 2));
            $tarifa = (float)($det['sri_tarifa_iva'] ?? $det['tarifa_iva'] ?? 15.0);
            $pdf->drawText(455, $y, number_format($tarifa, 0) . "%");
            $pdf->drawText(515, $y, "$" . number_format((float)$det['subtotal'], 2));

            $pdf->setDrawColor(0.85, 0.85, 0.85);
            $pdf->drawLine(40, $y - 4, 555, $y - 4);
            $y -= 18;
        }

        // 5. Totales y Formas de Pago
        $yTotales = max($y - 10, 190);

        // Cuadro Información Adicional (Izquierda)
        $pdf->drawRect(40, $yTotales - 100, 280, 105, 0.97, 0.97, 0.97);
        $pdf->setFont('Helvetica-Bold', 8.5);
        $pdf->drawText(50, $yTotales - 12, "INFORMACIÓN ADICIONAL");
        $pdf->setFont('Helvetica', 8);
        $pdf->drawText(50, $yTotales - 28, "Email: " . ($cliente['email'] ?? 'N/A'));
        $pdf->drawText(50, $yTotales - 42, "Teléfono: " . ($cliente['telefono'] ?? 'N/A'));
        $pdf->drawText(50, $yTotales - 56, "Forma de Pago: " . strtoupper($metodoPago));
        $pdf->drawText(50, $yTotales - 70, "Estado SRI: " . $estadoSri);
        $pdf->drawText(50, $yTotales - 84, "Generado por: PymeWeb ERP SaaS");

        // Cuadro Liquidación Tributaria (Derecha)
        $pdf->drawRect(330, $yTotales - 100, 225, 105, 0.95, 0.95, 0.95);
        $pdf->setFont('Helvetica', 8.5);
        $pdf->drawText(340, $yTotales - 15, "SUBTOTAL SIN IMPUESTOS:");
        $pdf->drawText(485, $yTotales - 15, "$" . number_format($subtotal, 2));

        $pdf->drawText(340, $yTotales - 32, "DESCUENTO:");
        $pdf->drawText(485, $yTotales - 32, "$0.00");

        $pdf->drawText(340, $yTotales - 49, "IVA VIGENTE:");
        $pdf->drawText(485, $yTotales - 49, "$" . number_format($impuesto, 2));

        $pdf->drawText(340, $yTotales - 66, "PROPINA:");
        $pdf->drawText(485, $yTotales - 66, "$0.00");

        $pdf->setFont('Helvetica-Bold', 11);
        $pdf->drawText(340, $yTotales - 88, "VALOR TOTAL:");
        $pdf->drawText(480, $yTotales - 88, "$" . number_format($total, 2));

        // Pie de página
        $pdf->setFont('Helvetica', 7.5);
        $pdf->setTextColor(0.5, 0.5, 0.5);
        $pdf->drawText(40, 50, "Representación Impresa de Factura Electrónica (RIDE) conforme a normativa del SRI Ecuador.");

        return $pdf->output();
    }

    /**
     * Genera la Representación Impresa de un Documento Electrónico (RIDE - Nota de Crédito)
     */
    public static function generateNotaCredito(
        array $emisor,
        array $cliente,
        string $numeroComprobante,
        string $claveAcceso,
        string $fechaAutorizacion,
        string $numeroAutorizacion,
        int $ambiente,
        string $numeroFacturaModificada,
        string $motivo,
        float $subtotal,
        float $iva,
        float $total,
        array $detalles,
        string $estadoSri = 'AUTORIZADO'
    ): string {
        $pdf = new SimplePdf();
        $pdf->addPage();

        // 1. Encabezado Emisor
        $pdf->setFont('Helvetica-Bold', 15);
        $pdf->drawText(40, 770, substr($emisor['razon_social'] ?? 'EMPRESA SA', 0, 36));

        $pdf->setFont('Helvetica', 8.5);
        if (!empty($emisor['nombre_comercial'])) {
            $pdf->drawText(40, 756, "Nombre Comercial: " . substr($emisor['nombre_comercial'], 0, 40));
        }
        $pdf->drawText(40, 743, "Matriz: " . substr($emisor['dir_matriz'] ?? 'Ecuador', 0, 48));
        $pdf->drawText(40, 730, "Obligado a Llevar Contabilidad: " . ($emisor['obligado_contabilidad'] ?? 'NO'));

        // 2. Cuadro Tributario SRI
        $pdf->drawRect(330, 640, 225, 145, 0.98, 0.98, 0.98);
        $pdf->setFont('Helvetica-Bold', 11);
        $pdf->drawText(340, 770, "R.U.C.: " . ($emisor['ruc'] ?? '1790011122001'));
        $pdf->drawText(340, 755, "NOTA DE CRÉDITO");
        $pdf->setFont('Helvetica', 9);
        $pdf->drawText(340, 742, "No. " . $numeroComprobante);
        $pdf->drawText(340, 729, "NÚMERO DE AUTORIZACIÓN:");
        $pdf->setFont('Helvetica-Bold', 7);
        $pdf->drawText(340, 718, $numeroAutorizacion ?: $claveAcceso);

        $pdf->setFont('Helvetica', 8);
        $pdf->drawText(340, 705, "FECHA AUTORIZACIÓN: " . $fechaAutorizacion);
        $pdf->drawText(340, 692, "AMBIENTE: " . ($ambiente === 2 ? 'PRODUCCIÓN' : 'PRUEBAS'));
        $pdf->drawText(340, 679, "EMISIÓN: NORMAL");
        $pdf->drawText(340, 666, "CLAVE DE ACCESO:");
        $pdf->setFont('Helvetica-Bold', 7);
        $pdf->drawText(340, 654, $claveAcceso);

        $pdf->drawRect(340, 642, 205, 7, 0.2, 0.2, 0.2);

        // 3. Datos del Adquirente y Documento Modificado
        $pdf->drawRect(40, 570, 515, 60, 0.96, 0.96, 0.96);
        $pdf->setFont('Helvetica-Bold', 8.5);
        $pdf->drawText(50, 618, "Razón Social / Nombres: " . substr($cliente['nombre'] ?? 'CONSUMIDOR FINAL', 0, 45));
        $pdf->drawText(50, 604, "Identificación: " . ($cliente['documento'] ?? '9999999999999'));
        $pdf->setFont('Helvetica', 8.5);
        $pdf->drawText(50, 590, "Comprobante que Modifica: FACTURA No. " . $numeroFacturaModificada);
        $pdf->drawText(50, 576, "Motivo de Modificación: " . substr($motivo, 0, 60));
        $pdf->drawText(350, 604, "Fecha Emisión: " . date('d/m/Y'));

        // 4. Tabla de Ítems
        $pdf->drawRect(40, 540, 515, 20, 0.5, 0.15, 0.15);
        $pdf->setTextColor(1, 1, 1);
        $pdf->setFont('Helvetica-Bold', 8.5);
        $pdf->drawText(45, 546, "Cod.");
        $pdf->drawText(100, 546, "Descripción");
        $pdf->drawText(330, 546, "Cant.");
        $pdf->drawText(380, 546, "Precio Unit.");
        $pdf->drawText(450, 546, "IVA");
        $pdf->drawText(510, 546, "Subtotal");

        $pdf->setTextColor(0, 0, 0);
        $pdf->setFont('Helvetica', 8);

        $y = 520;
        foreach ($detalles as $det) {
            if ($y < 180) break;
            $pdf->drawText(45, $y, substr((string)($det['producto_id'] ?? '-'), 0, 8));
            $pdf->drawText(100, $y, substr($det['nombre_producto'] ?? 'Item', 0, 36));
            $pdf->drawText(335, $y, number_format((float)$det['cantidad'], 2));
            $pdf->drawText(385, $y, "$" . number_format((float)$det['precio_unitario'], 2));
            $tarifa = (float)($det['sri_tarifa_iva'] ?? $det['tarifa_iva'] ?? 15.0);
            $pdf->drawText(455, $y, number_format($tarifa, 0) . "%");
            $pdf->drawText(515, $y, "$" . number_format((float)$det['subtotal'], 2));

            $pdf->setDrawColor(0.85, 0.85, 0.85);
            $pdf->drawLine(40, $y - 4, 555, $y - 4);
            $y -= 18;
        }

        // 5. Totales
        $yTotales = max($y - 10, 190);
        $pdf->drawRect(40, $yTotales - 75, 280, 80, 0.97, 0.97, 0.97);
        $pdf->setFont('Helvetica-Bold', 8.5);
        $pdf->drawText(50, $yTotales - 12, "INFORMACIÓN ADICIONAL");
        $pdf->setFont('Helvetica', 8);
        $pdf->drawText(50, $yTotales - 28, "Email: " . ($cliente['email'] ?? 'N/A'));
        $pdf->drawText(50, $yTotales - 42, "Estado SRI: " . $estadoSri);
        $pdf->drawText(50, $yTotales - 56, "Generado por: PymeWeb ERP SaaS");

        $pdf->drawRect(330, $yTotales - 75, 225, 80, 0.95, 0.95, 0.95);
        $pdf->setFont('Helvetica', 8.5);
        $pdf->drawText(340, $yTotales - 15, "SUBTOTAL SIN IMPUESTOS:");
        $pdf->drawText(485, $yTotales - 15, "$" . number_format($subtotal, 2));

        $pdf->drawText(340, $yTotales - 32, "IVA MODIFICADO:");
        $pdf->drawText(485, $yTotales - 32, "$" . number_format($iva, 2));

        $pdf->setFont('Helvetica-Bold', 11);
        $pdf->drawText(340, $yTotales - 58, "TOTAL MODIFICADO:");
        $pdf->drawText(480, $yTotales - 58, "$" . number_format($total, 2));

        $pdf->setFont('Helvetica', 7.5);
        $pdf->setTextColor(0.5, 0.5, 0.5);
        $pdf->drawText(40, 50, "Representación Impresa de Nota de Crédito Electrónica (RIDE) conforme a normativa SRI Ecuador.");

        return $pdf->output();
    }

    /**
     * Genera la Representación Impresa de un Documento Electrónico (RIDE - Comprobante de Retención)
     */
    public static function generateRetencion(
        array $emisor,
        array $sujeto,
        string $numeroComprobante,
        string $claveAcceso,
        string $fechaAutorizacion,
        string $numeroAutorizacion,
        int $ambiente,
        string $numeroFacturaSustento,
        string $fechaSustento,
        array $impuestos,
        float $totalRetenido,
        string $estadoSri = 'AUTORIZADO'
    ): string {
        $pdf = new SimplePdf();
        $pdf->addPage();

        // 1. Encabezado Emisor
        $pdf->setFont('Helvetica-Bold', 15);
        $pdf->drawText(40, 770, substr($emisor['razon_social'] ?? 'EMPRESA SA', 0, 36));

        $pdf->setFont('Helvetica', 8.5);
        if (!empty($emisor['nombre_comercial'])) {
            $pdf->drawText(40, 756, "Nombre Comercial: " . substr($emisor['nombre_comercial'], 0, 40));
        }
        $pdf->drawText(40, 743, "Matriz: " . substr($emisor['dir_matriz'] ?? 'Ecuador', 0, 48));
        $pdf->drawText(40, 730, "Obligado a Llevar Contabilidad: " . ($emisor['obligado_contabilidad'] ?? 'NO'));

        // 2. Cuadro Tributario SRI
        $pdf->drawRect(330, 640, 225, 145, 0.98, 0.98, 0.98);
        $pdf->setFont('Helvetica-Bold', 11);
        $pdf->drawText(340, 770, "R.U.C.: " . ($emisor['ruc'] ?? '1790011122001'));
        $pdf->drawText(340, 755, "COMPROBANTE DE RETENCIÓN");
        $pdf->setFont('Helvetica', 9);
        $pdf->drawText(340, 742, "No. " . $numeroComprobante);
        $pdf->drawText(340, 729, "NÚMERO DE AUTORIZACIÓN:");
        $pdf->setFont('Helvetica-Bold', 7);
        $pdf->drawText(340, 718, $numeroAutorizacion ?: $claveAcceso);

        $pdf->setFont('Helvetica', 8);
        $pdf->drawText(340, 705, "FECHA AUTORIZACIÓN: " . $fechaAutorizacion);
        $pdf->drawText(340, 692, "AMBIENTE: " . ($ambiente === 2 ? 'PRODUCCIÓN' : 'PRUEBAS'));
        $pdf->drawText(340, 679, "EMISIÓN: NORMAL");
        $pdf->drawText(340, 666, "CLAVE DE ACCESO:");
        $pdf->setFont('Helvetica-Bold', 7);
        $pdf->drawText(340, 654, $claveAcceso);

        $pdf->drawRect(340, 642, 205, 7, 0.2, 0.2, 0.2);

        // 3. Sujeto Retenido (Proveedor)
        $pdf->drawRect(40, 570, 515, 60, 0.96, 0.96, 0.96);
        $pdf->setFont('Helvetica-Bold', 8.5);
        $pdf->drawText(50, 618, "Sujeto Retenido: " . substr($sujeto['razon_social'] ?? $sujeto['nombre'] ?? 'PROVEEDOR', 0, 45));
        $pdf->drawText(50, 604, "RUC / Cédula: " . ($sujeto['ruc'] ?? $sujeto['documento'] ?? '1790011122001'));
        $pdf->setFont('Helvetica', 8.5);
        $pdf->drawText(50, 590, "Comprobante Sustento: FACTURA No. " . $numeroFacturaSustento);
        $pdf->drawText(350, 604, "Fecha Emisión Sustento: " . $fechaSustento);
        $pdf->drawText(350, 590, "Periodo Fiscal: " . date('m/Y'));

        // 4. Tabla de Impuestos Retenidos
        $pdf->drawRect(40, 540, 515, 20, 0.15, 0.35, 0.25);
        $pdf->setTextColor(1, 1, 1);
        $pdf->setFont('Helvetica-Bold', 8.5);
        $pdf->drawText(45, 546, "Impuesto");
        $pdf->drawText(120, 546, "Cód. SRI");
        $pdf->drawText(200, 546, "Base Imponible");
        $pdf->drawText(320, 546, "% Retención");
        $pdf->drawText(440, 546, "Valor Retenido");

        $pdf->setTextColor(0, 0, 0);
        $pdf->setFont('Helvetica', 8);

        $y = 520;
        foreach ($impuestos as $imp) {
            if ($y < 180) break;
            $tipoNombre = ($imp['codigo_impuesto'] == 1 || ($imp['tipo_impuesto'] ?? '') === 'RENTA') ? 'RENTA' : 'IVA';
            $pdf->drawText(45, $y, $tipoNombre);
            $pdf->drawText(120, $y, (string)($imp['codigo_retencion'] ?? '312'));
            $pdf->drawText(200, $y, "$" . number_format((float)($imp['base_imponible'] ?? 0), 2));
            $pdf->drawText(320, $y, number_format((float)($imp['porcentaje'] ?? 0), 2) . "%");
            $pdf->drawText(440, $y, "$" . number_format((float)($imp['valor_retenido'] ?? 0), 2));

            $pdf->setDrawColor(0.85, 0.85, 0.85);
            $pdf->drawLine(40, $y - 4, 555, $y - 4);
            $y -= 18;
        }

        // 5. Total Retenido
        $yTotales = max($y - 10, 190);
        $pdf->drawRect(40, $yTotales - 60, 280, 65, 0.97, 0.97, 0.97);
        $pdf->setFont('Helvetica-Bold', 8.5);
        $pdf->drawText(50, $yTotales - 12, "INFORMACIÓN ADICIONAL");
        $pdf->setFont('Helvetica', 8);
        $pdf->drawText(50, $yTotales - 28, "Estado SRI: " . $estadoSri);
        $pdf->drawText(50, $yTotales - 42, "Generado por: PymeWeb ERP SaaS");

        $pdf->drawRect(330, $yTotales - 60, 225, 65, 0.95, 0.95, 0.95);
        $pdf->setFont('Helvetica-Bold', 11);
        $pdf->drawText(340, $yTotales - 35, "TOTAL RETENIDO:");
        $pdf->drawText(480, $yTotales - 35, "$" . number_format($totalRetenido, 2));

        $pdf->setFont('Helvetica', 7.5);
        $pdf->setTextColor(0.5, 0.5, 0.5);
        $pdf->drawText(40, 50, "Representación Impresa de Comprobante de Retención (RIDE) conforme a normativa SRI Ecuador.");

        return $pdf->output();
    }
}
