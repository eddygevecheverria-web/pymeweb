<?php
declare(strict_types=1);

/**
 * Interfaz base para cualquier documento electrónico del SRI Ecuador
 * (Factura, Nota de Crédito, Guía de Remisión, Comprobante de Retención, etc.)
 */
interface DocumentoElectronicoSRI {
    public function getTipoDocumento(): string; // Ej: '01' Factura, '04' Nota Crédito, '06' Guía Remisión
    public function generarXml(): string;
    public function getClaveAcceso(): string;
    public function getNumeroComprobante(): string;
}
