<?php
declare(strict_types=1);

/**
 * Firmador Digital de comprobantes XML para el SRI Ecuador utilizando el estándar XAdES-BES
 * Lee certificados digitales en formato PKCS#12 (.p12) usando la extensión nativa openssl de PHP
 */
class SriSigner {
    /**
     * Firma un documento XML con XAdES-BES
     */
    public static function signXml(string $xmlContent, string $p12Path, string $password): string {
        if (!file_exists($p12Path)) {
            throw new Exception("El archivo de firma .p12 no existe en el servidor: {$p12Path}");
        }

        $p12Content = file_get_contents($p12Path);
        if (!$p12Content) {
            throw new Exception("No se pudo leer el archivo .p12.");
        }

        $certs = [];
        if (!openssl_pkcs12_read($p12Content, $certs, $password)) {
            $err = openssl_error_string() ?: 'Clave incorrecta o formato .p12 corrupto.';
            throw new Exception("Error al abrir certificado digital: {$err}");
        }

        $privateKey = $certs['pkey'];
        $certificate = $certs['cert'];
        $extraCerts = $certs['extracerts'] ?? [];

        // Limpiar el certificado (remover cabeceras PEM y saltos de línea)
        $cleanCert = str_replace(
            ['-----BEGIN CERTIFICATE-----', '-----END CERTIFICATE-----', "\r", "\n", ' '],
            '',
            $certificate
        );

        // Obtener detalles del certificado para el X509IssuerSerial y Digest
        $certData = openssl_x509_parse($certificate);
        if (!$certData) {
            throw new Exception("No se pudo analizar el certificado X509.");
        }

        $serialNumber = $certData['serialNumber'];
        $issuerParts = [];
        foreach ($certData['issuer'] as $k => $v) {
            if (is_array($v)) {
                foreach ($v as $subV) {
                    $issuerParts[] = "{$k}={$subV}";
                }
            } else {
                $issuerParts[] = "{$k}={$v}";
            }
        }
        $issuerName = implode(',', array_reverse($issuerParts));

        // Calcular Digest del Certificado (SHA-1 base64 según estándar SRI XAdES)
        $certDer = base64_decode($cleanCert);
        $certDigest = base64_encode(openssl_digest($certDer, 'sha1', true));

        // Cargar XML en DOMDocument
        $dom = new DOMDocument('1.0', 'UTF-8');
        $dom->preserveWhiteSpace = false;
        $dom->formatOutput = false;
        $dom->loadXML($xmlContent);

        // Identificadores únicos para nodos de firma
        $randomId = sprintf('%06d', mt_rand(100000, 999999));
        $signatureId = "Signature{$randomId}";
        $signatureValueId = "SignatureValue{$randomId}";
        $signedPropertiesId = "SignedProperties{$randomId}";
        $keyInfoId = "Certificate{$randomId}";
        $referenceSignedPropertiesId = "SignedPropertiesID{$randomId}";
        $referenceDocumentId = "comprobante";

        // Canonizar y calcular Digest del documento (<factura id="comprobante">)
        $docElement = $dom->documentElement;
        $docCanonical = $docElement->C14N(false, false);
        $docDigest = base64_encode(openssl_digest($docCanonical, 'sha1', true));

        // Crear bloque SignedProperties
        $isoDate = date('Y-m-d\TH:i:sP');
        $signedPropertiesXml = '<etsi:SignedProperties xmlns:etsi="http://uri.etsi.org/01903/v1.3.2#" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="' . $signedPropertiesId . '">' .
            '<etsi:SignedSignatureProperties>' .
                '<etsi:SigningTime>' . $isoDate . '</etsi:SigningTime>' .
                '<etsi:SigningCertificate>' .
                    '<etsi:Cert>' .
                        '<etsi:CertDigest>' .
                            '<ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>' .
                            '<ds:DigestValue>' . $certDigest . '</ds:DigestValue>' .
                        '</etsi:CertDigest>' .
                        '<etsi:IssuerSerial>' .
                            '<ds:X509IssuerName>' . htmlspecialchars($issuerName) . '</ds:X509IssuerName>' .
                            '<ds:X509SerialNumber>' . $serialNumber . '</ds:X509SerialNumber>' .
                        '</etsi:IssuerSerial>' .
                    '</etsi:Cert>' .
                '</etsi:SigningCertificate>' .
            '</etsi:SignedSignatureProperties>' .
            '<etsi:SignedDataObjectProperties>' .
                '<etsi:DataObjectFormat ObjectReference="#' . $referenceDocumentId . '">' .
                    '<etsi:Description>COMPROBANTE ELECTRONICO</etsi:Description>' .
                    '<etsi:MimeType>text/xml</etsi:MimeType>' .
                '</etsi:DataObjectFormat>' .
            '</etsi:SignedDataObjectProperties>' .
        '</etsi:SignedProperties>';

        // Canonizar SignedProperties para calcular su Digest
        $domProps = new DOMDocument();
        $domProps->loadXML($signedPropertiesXml);
        $signedPropertiesCanonical = $domProps->documentElement->C14N(false, false);
        $signedPropertiesDigest = base64_encode(openssl_digest($signedPropertiesCanonical, 'sha1', true));

        // Crear bloque SignedInfo
        $signedInfoXml = '<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:etsi="http://uri.etsi.org/01903/v1.3.2#">' .
            '<ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>' .
            '<ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>' .
            '<ds:Reference Id="' . $referenceSignedPropertiesId . '" Type="http://uri.etsi.org/01903#SignedProperties" URI="#' . $signedPropertiesId . '">' .
                '<ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>' .
                '<ds:DigestValue>' . $signedPropertiesDigest . '</ds:DigestValue>' .
            '</ds:Reference>' .
            '<ds:Reference URI="#' . $referenceDocumentId . '">' .
                '<ds:Transforms>' .
                    '<ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>' .
                '</ds:Transforms>' .
                '<ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>' .
                '<ds:DigestValue>' . $docDigest . '</ds:DigestValue>' .
            '</ds:Reference>' .
        '</ds:SignedInfo>';

        $domSignedInfo = new DOMDocument();
        $domSignedInfo->loadXML($signedInfoXml);
        $signedInfoCanonical = $domSignedInfo->documentElement->C14N(false, false);

        // Firmar con la clave privada (RSA-SHA1)
        $signatureBinary = '';
        if (!openssl_sign($signedInfoCanonical, $signatureBinary, $privateKey, OPENSSL_ALGO_SHA1)) {
            throw new Exception("Error al firmar documento con la clave privada: " . openssl_error_string());
        }
        $signatureValue = base64_encode($signatureBinary);

        // Formar nodo completo de Signature XAdES-BES
        $signatureXml = '<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:etsi="http://uri.etsi.org/01903/v1.3.2#" Id="' . $signatureId . '">' .
            $signedInfoXml .
            '<ds:SignatureValue Id="' . $signatureValueId . '">' . "\n" . chunk_split($signatureValue, 76, "\n") . '</ds:SignatureValue>' .
            '<ds:KeyInfo Id="' . $keyInfoId . '">' .
                '<ds:X509Data>' .
                    '<ds:X509Certificate>' . "\n" . chunk_split($cleanCert, 76, "\n") . '</ds:X509Certificate>' .
                '</ds:X509Data>' .
                '<ds:KeyValue>' .
                    self::extractRsaKeyValue($certificate) .
                '</ds:KeyValue>' .
            '</ds:KeyInfo>' .
            '<ds:Object>' .
                $signedPropertiesXml .
            '</ds:Object>' .
        '</ds:Signature>';

        $domSig = new DOMDocument();
        $domSig->loadXML($signatureXml);
        $nodeToImport = $dom->importNode($domSig->documentElement, true);
        $dom->documentElement->appendChild($nodeToImport);

        return $dom->saveXML();
    }

    /**
     * Extrae RSA KeyValue (Modulus y Exponent) del certificado X509
     */
    private static function extractRsaKeyValue(string $certPem): string {
        $res = openssl_pkey_get_public($certPem);
        $details = openssl_pkey_get_details($res);
        $modulus = base64_encode($details['rsa']['n']);
        $exponent = base64_encode($details['rsa']['e']);

        return '<ds:RSAKeyValue>' .
            '<ds:Modulus>' . "\n" . chunk_split($modulus, 76, "\n") . '</ds:Modulus>' .
            '<ds:Exponent>' . $exponent . '</ds:Exponent>' .
        '</ds:RSAKeyValue>';
    }
}
