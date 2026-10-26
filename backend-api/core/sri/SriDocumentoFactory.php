<?php
declare(strict_types=1);

require_once __DIR__ . '/DocumentoElectronicoSRI.php';
require_once __DIR__ . '/FacturaSRI.php';
require_once __DIR__ . '/NotaCreditoSRI.php';
require_once __DIR__ . '/ComprobanteRetencionSRI.php';

/**
 * Patrón Factory para instanciación desacoplada y escalable de comprobantes electrónicos del SRI Ecuador
 */
class SriDocumentoFactory {
    public static function crearFactura(
        array $emisor,
        array $cliente,
        array $venta,
        array $detalles,
        string $serie = '001001',
        int $secuencial = 1,
        int $ambiente = 1,
        int $tipoEmision = 1
    ): FacturaSRI {
        return new FacturaSRI($emisor, $cliente, $venta, $detalles, $serie, $secuencial, $ambiente, $tipoEmision);
    }

    public static function crearNotaCredito(
        array $emisor,
        array $cliente,
        array $notaCredito,
        array $detalles,
        string $serie = '001001',
        int $secuencial = 1,
        int $ambiente = 1,
        int $tipoEmision = 1
    ): NotaCreditoSRI {
        return new NotaCreditoSRI($emisor, $cliente, $notaCredito, $detalles, $serie, $secuencial, $ambiente, $tipoEmision);
    }

    public static function crearRetencion(
        array $emisor,
        array $sujeto,
        array $transaccion,
        array $impuestos,
        string $serie = '001001',
        int $secuencial = 1,
        int $ambiente = 1,
        int $tipoEmision = 1
    ): ComprobanteRetencionSRI {
        return new ComprobanteRetencionSRI($emisor, $sujeto, $transaccion, $impuestos, $serie, $secuencial, $ambiente, $tipoEmision);
    }

    public static function crear(
        string $tipo,
        array $emisor,
        array $tercero,
        array $transaccion,
        array $detallesOImpuestos,
        string $serie = '001001',
        int $secuencial = 1,
        int $ambiente = 1,
        int $tipoEmision = 1
    ): DocumentoElectronicoSRI {
        switch ($tipo) {
            case '01':
            case 'factura':
                return self::crearFactura($emisor, $tercero, $transaccion, $detallesOImpuestos, $serie, $secuencial, $ambiente, $tipoEmision);
            case '04':
            case 'nota_credito':
                return self::crearNotaCredito($emisor, $tercero, $transaccion, $detallesOImpuestos, $serie, $secuencial, $ambiente, $tipoEmision);
            case '07':
            case 'retencion':
                return self::crearRetencion($emisor, $tercero, $transaccion, $detallesOImpuestos, $serie, $secuencial, $ambiente, $tipoEmision);
            default:
                throw new InvalidArgumentException("Tipo de documento electrónico SRI no reconocido: '{$tipo}'. Soportados: 01 (Factura), 04 (Nota de Crédito), 07 (Retención).");
        }
    }
}
