<?php
declare(strict_types=1);

class PdfInvoiceGenerator {
    /**
     * Genera un PDF binario nativo (sin librerías externas) formato factura con diseño moderno
     */
    public static function generate(
        array $negocio,
        array $cliente,
        string $numeroComprobante,
        string $fechaEmision,
        float $subtotal,
        float $impuesto,
        float $total,
        string $metodoPago,
        array $detalles
    ): string {
        $pdf = new SimplePdf();
        $pdf->addPage();

        // Encabezado
        $pdf->setFont('Helvetica-Bold', 18);
        $pdf->drawText(40, 770, $negocio['nombre'] ?? 'PymeWeb Store');

        $pdf->setFont('Helvetica', 9);
        $pdf->drawText(40, 755, "RUC/NIT: " . ($negocio['ruc_nit'] ?? '00000000000'));
        $pdf->drawText(40, 742, "Direccion: " . ($negocio['direccion'] ?? 'Principal'));
        $pdf->drawText(40, 729, "Telefono: " . ($negocio['telefono'] ?? 'S/N'));

        // Cuadro Comprobante (Derecha)
        $pdf->drawRect(370, 715, 185, 65, 0.9, 0.9, 0.95);
        $pdf->setFont('Helvetica-Bold', 12);
        $pdf->drawText(380, 760, "FACTURA ELECTRONICA");
        $pdf->setFont('Helvetica-Bold', 11);
        $pdf->drawText(380, 742, "No. " . $numeroComprobante);
        $pdf->setFont('Helvetica', 9);
        $pdf->drawText(380, 727, "Fecha: " . $fechaEmision);

        // Datos del Cliente
        $pdf->drawRect(40, 635, 515, 65, 0.97, 0.97, 0.97);
        $pdf->setFont('Helvetica-Bold', 10);
        $pdf->drawText(50, 685, "DATOS DEL CLIENTE");
        $pdf->setFont('Helvetica', 9);
        $pdf->drawText(50, 670, "Cliente: " . ($cliente['nombre'] ?? 'Consumidor Final'));
        $pdf->drawText(50, 656, "Cedula / RUC: " . ($cliente['documento'] ?? '9999999999'));
        $pdf->drawText(310, 670, "Telefono: " . ($cliente['telefono'] ?? 'S/N'));
        $pdf->drawText(310, 656, "Direccion: " . ($cliente['direccion'] ?? 'Local'));
        $pdf->drawText(50, 642, "Metodo de Pago: " . strtoupper($metodoPago));

        // Encabezado Tabla
        $pdf->drawRect(40, 605, 515, 20, 0.25, 0.3, 0.5);
        $pdf->setTextColor(1, 1, 1);
        $pdf->setFont('Helvetica-Bold', 9);
        $pdf->drawText(50, 612, "Cant.");
        $pdf->drawText(100, 612, "Descripcion del Producto");
        $pdf->drawText(410, 612, "P. Unit.");
        $pdf->drawText(490, 612, "Subtotal");

        // Filas de productos
        $y = 588;
        $pdf->setTextColor(0, 0, 0);
        $pdf->setFont('Helvetica', 9);
        foreach ($detalles as $det) {
            if ($y < 120) break;
            $pdf->drawText(50, $y, (string)$det['cantidad']);
            $pdf->drawText(100, $y, substr($det['nombre_producto'], 0, 48));
            $pdf->drawText(410, $y, "$" . number_format((float)$det['precio_unitario'], 2));
            $pdf->drawText(490, $y, "$" . number_format((float)$det['subtotal'], 2));
            $pdf->drawLine(40, $y - 6, 555, $y - 6);
            $y -= 20;
        }

        // Totales al pie
        $yTotales = max($y - 10, 160);
        $pdf->drawRect(360, $yTotales - 60, 195, 65, 0.95, 0.95, 0.95);
        $pdf->setFont('Helvetica', 10);
        $pdf->drawText(375, $yTotales - 18, "Subtotal:");
        $pdf->drawText(485, $yTotales - 18, "$" . number_format($subtotal, 2));
        $pdf->drawText(375, $yTotales - 34, "IVA (18%):");
        $pdf->drawText(485, $yTotales - 34, "$" . number_format($impuesto, 2));
        $pdf->setFont('Helvetica-Bold', 12);
        $pdf->drawText(375, $yTotales - 52, "TOTAL:");
        $pdf->drawText(480, $yTotales - 52, "$" . number_format($total, 2));

        if ($metodoPago === 'fiado' || $metodoPago === 'credito_directo') {
            $pdf->setFont('Helvetica-Bold', 10);
            $pdf->setTextColor(0.8, 0, 0);
            $pdf->drawText(50, $yTotales - 30, "CONDICION: CREDITO DIRECTO (CUENTA POR COBRAR)");
            $pdf->setTextColor(0, 0, 0);
        }

        $pdf->setFont('Helvetica', 8);
        $pdf->setTextColor(0.5, 0.5, 0.5);
        $pdf->drawText(40, 60, "Documento electronico generado por PymeWeb. Valido como comprobante.");

        return $pdf->output();
    }
}

/**
 * Generador nativo PDF mínimo según especificación PDF 1.4
 */
class SimplePdf {
    private array $pages = [];
    private string $buffer = "";
    private array $offsets = [];
    private string $currentStream = "";
    private float $r = 0, $g = 0, $b = 0;

    public function addPage(): void {
        if ($this->currentStream !== "") {
            $this->pages[] = $this->currentStream;
        }
        $this->currentStream = "";
    }

    public function setTextColor(float $r, float $g, float $b): void {
        $this->r = $r; $this->g = $g; $this->b = $b;
        $this->currentStream .= sprintf("%.3f %.3f %.3f rg\n", $r, $g, $b);
    }

    public function setDrawColor(float $r, float $g, float $b): void {
        $this->currentStream .= sprintf("%.3f %.3f %.3f RG\n", $r, $g, $b);
    }

    public function setFont(string $name, int|float $size): void {
        $fontCode = ($name === 'Helvetica-Bold') ? '/F2' : '/F1';
        $sizeStr = is_int($size) ? (string)$size : sprintf("%.1f", $size);
        $this->currentStream .= "{$fontCode} {$sizeStr} Tf\n";
    }

    public function drawText(float $x, float $y, string $text): void {
        $sanitized = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], iconv('UTF-8', 'windows-1252//TRANSLIT', $text));
        $this->currentStream .= sprintf("BT %.2f %.2f Td (%s) Tj ET\n", $x, $y, $sanitized);
    }

    public function drawRect(float $x, float $y, float $w, float $h, float $r, float $g, float $b): void {
        $this->currentStream .= sprintf("q %.3f %.3f %.3f rg %.2f %.2f %.2f %.2f re f Q\n", $r, $g, $b, $x, $y, $w, $h);
    }

    public function drawLine(float $x1, float $y1, float $x2, float $y2): void {
        $this->currentStream .= sprintf("q 0.8 G 0.5 w %.2f %.2f m %.2f %.2f l S Q\n", $x1, $y1, $x2, $y2);
    }

    public function output(): string {
        if ($this->currentStream !== "") {
            $this->pages[] = $this->currentStream;
            $this->currentStream = "";
        }

        $out = "%PDF-1.4\n";
        $objects = [];

        // 1: Catalog
        $objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
        // 2: Pages
        $kids = [];
        $pageStartObj = 5;
        for ($i = 0; $i < count($this->pages); $i++) {
            $kids[] = ($pageStartObj + ($i * 2)) . " 0 R";
        }
        $objects[2] = "<< /Type /Pages /Kids [" . implode(' ', $kids) . "] /Count " . count($this->pages) . " >>";

        // 3 & 4: Fonts
        $objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
        $objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

        // Pages & Content streams
        $curr = $pageStartObj;
        foreach ($this->pages as $pageContent) {
            $contentObj = $curr + 1;
            $objects[$curr] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {$contentObj} 0 R >>";
            $objects[$contentObj] = "<< /Length " . strlen($pageContent) . " >>\nstream\n" . $pageContent . "\nendstream";
            $curr += 2;
        }

        $xrefOffset = 0;
        $offsets = [];
        for ($i = 1; $i < $curr; $i++) {
            $offsets[$i] = strlen($out);
            $out .= "{$i} 0 obj\n" . $objects[$i] . "\nendobj\n";
        }

        $xrefOffset = strlen($out);
        $out .= "xref\n0 {$curr}\n0000000000 65535 f \n";
        for ($i = 1; $i < $curr; $i++) {
            $out .= sprintf("%010d 00000 n \n", $offsets[$i]);
        }

        $out .= "trailer\n<< /Size {$curr} /Root 1 0 R >>\nstartxref\n{$xrefOffset}\n%%EOF";
        return $out;
    }
}
