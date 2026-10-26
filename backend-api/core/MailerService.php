<?php
declare(strict_types=1);

class MailerService {
    public static function sendInvoiceEmail(
        string $toEmail,
        string $toName,
        array $negocio,
        string $numeroComprobante,
        float $total,
        string $xmlContent,
        string $jsonContent,
        ?string $pdfContent = null
    ): bool {
        $subject = "Factura Electrónica {$numeroComprobante} - {$negocio['nombre']}";
        $logoHtml = !empty($negocio['logo_url'])
            ? "<img src=\"{$negocio['logo_url']}\" alt=\"Logo\" style=\"max-height:70px;border-radius:10px;margin-bottom:12px;\" />"
            : "";

        $htmlBody = "
        <div style=\"font-family:Arial,sans-serif;max-width:580px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px;\">
            {$logoHtml}
            <h2 style=\"margin:0 0 8px;color:#1e293b;\">{$negocio['nombre']}</h2>
            <p style=\"margin:0 0 16px;color:#64748b;font-size:14px;\">
                Hola <strong>{$toName}</strong>, adjuntamos tu Factura Electrónica <strong>{$numeroComprobante}</strong> en formato PDF y XML normativo.
            </p>
            <div style=\"background:#f8fafc;padding:16px;border-radius:12px;margin-bottom:16px;\">
                <p style=\"margin:4px 0;font-size:14px;\"><strong>Comprobante:</strong> {$numeroComprobante}</p>
                <p style=\"margin:4px 0;font-size:14px;\"><strong>Total Facturado:</strong> $" . number_format($total, 2) . "</p>
                <p style=\"margin:4px 0;font-size:12px;color:#64748b;\">Se adjuntan los archivos Factura.pdf y el archivo normativo UBL 2.1 XML.</p>
            </div>
            <p style=\"font-size:12px;color:#94a3b8;\">Emitido a través de PymeWeb SaaS.</p>
        </div>";

        if (class_exists('\PHPMailer\PHPMailer\PHPMailer')) {
            $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
            try {
                $mail->isSMTP();
                $mail->Host       = $_ENV['SMTP_HOST'] ?? 'smtp.gmail.com';
                $mail->SMTPAuth   = true;
                $mail->Username   = $_ENV['SMTP_USER'] ?? '';
                $mail->Password   = $_ENV['SMTP_PASS'] ?? '';
                $mail->SMTPSecure = $_ENV['SMTP_SECURE'] ?? 'tls';
                $mail->Port       = (int)($_ENV['SMTP_PORT'] ?? 587);
                $mail->CharSet    = 'UTF-8';

                $mail->setFrom($_ENV['SMTP_FROM'] ?? 'facturacion@pymeweb.com', $negocio['nombre']);
                $mail->addAddress($toEmail, $toName);
                $mail->isHTML(true);
                $mail->Subject = $subject;
                $mail->Body    = $htmlBody;

                $mail->addStringAttachment($xmlContent, "{$numeroComprobante}.xml", 'base64', 'application/xml');
                if ($pdfContent) {
                    $mail->addStringAttachment($pdfContent, "{$numeroComprobante}.pdf", 'base64', 'application/pdf');
                }

                return $mail->send();
            } catch (Throwable $e) {
                return false;
            }
        }

        $boundary = md5((string)time());
        $headers  = "From: {$negocio['nombre']} <no-reply@pymeweb.com>\r\n";
        $headers .= "MIME-Version: 1.0\r\n";
        $headers .= "Content-Type: multipart/mixed; boundary=\"{$boundary}\"\r\n";

        $body  = "--{$boundary}\r\n";
        $body .= "Content-Type: text/html; charset=UTF-8\r\n\r\n{$htmlBody}\r\n";

        $body .= "--{$boundary}\r\n";
        $body .= "Content-Type: application/xml; name=\"{$numeroComprobante}.xml\"\r\n";
        $body .= "Content-Disposition: attachment; filename=\"{$numeroComprobante}.xml\"\r\n";
        $body .= "Content-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($xmlContent)) . "\r\n";

        if ($pdfContent) {
            $body .= "--{$boundary}\r\n";
            $body .= "Content-Type: application/pdf; name=\"{$numeroComprobante}.pdf\"\r\n";
            $body .= "Content-Disposition: attachment; filename=\"{$numeroComprobante}.pdf\"\r\n";
            $body .= "Content-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($pdfContent)) . "\r\n";
        }

        $body .= "--{$boundary}--";

        return @mail($toEmail, $subject, $body, $headers);
    }

    public static function sendCredentialsEmail(
        string $toEmail,
        string $toName,
        string $businessName,
        string $loginUrl,
        string $storeUrl,
        string $password,
        int $trialDays,
        string $expirationDate
    ): bool {
        $subject = "Bienvenido a PymeWeb ERP - Credenciales de Acceso para {$businessName}";
        
        $htmlBody = "
        <div style=\"font-family:Arial,sans-serif;max-width:580px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px;background:#ffffff;color:#1e293b;\">
            <div style=\"text-align:center;margin-bottom:24px;\">
                <h1 style=\"color:#4f46e5;margin:0 0 8px;font-size:24px;\">PymeWeb ERP Cloud</h1>
                <p style=\"color:#64748b;margin:0;font-size:14px;\">Facturación Electrónica SRI • Punto de Venta • Tienda Virtual</p>
            </div>
            
            <p style=\"font-size:15px;line-height:1.5;\">
                ¡Hola <strong>{$toName}</strong>! Te damos una cordial bienvenida a PymeWeb ERP. Tu cuenta para el negocio <strong>{$businessName}</strong> ha sido configurada exitosamente.
            </p>
            
            <div style=\"background:#f8fafc;border:1px solid #cbd5e1;border-radius:12px;padding:20px;margin:20px 0;\">
                <h3 style=\"margin:0 0 12px;color:#334155;font-size:16px;border-bottom:1px solid #e2e8f0;padding-bottom:8px;\">Tus Credenciales de Acceso</h3>
                <p style=\"margin:6px 0;font-size:14px;\"><strong>🌐 Plataforma de Gestión:</strong> <a href=\"{$loginUrl}\" style=\"color:#4f46e5;font-weight:bold;\">{$loginUrl}</a></p>
                <p style=\"margin:6px 0;font-size:14px;\"><strong>👤 Usuario / Email:</strong> <span style=\"font-family:monospace;background:#e2e8f0;padding:2px 6px;border-radius:4px;\">{$toEmail}</span></p>
                <p style=\"margin:6px 0;font-size:14px;\"><strong>🔑 Contraseña:</strong> <span style=\"font-family:monospace;background:#e2e8f0;padding:2px 6px;border-radius:4px;font-weight:bold;\">{$password}</span></p>
                <p style=\"margin:6px 0;font-size:14px;\"><strong>🏪 Tu Tienda Virtual:</strong> <a href=\"{$storeUrl}\" style=\"color:#0284c7;\">{$storeUrl}</a></p>
                <p style=\"margin:6px 0;font-size:14px;\"><strong>⏳ Período de Acceso / Prueba:</strong> {$trialDays} días (Hasta {$expirationDate})</p>
            </div>
            
            <div style=\"text-align:center;margin:24px 0;\">
                <a href=\"{$loginUrl}\" style=\"background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;display:inline-block;font-size:15px;\">Ingresar a Mi Plataforma</a>
            </div>
            
            <p style=\"font-size:13px;color:#64748b;line-height:1.5;\">
                Podrás cambiar tu contraseña en cualquier momento desde la sección <em>Mi Perfil / Configuración</em> dentro de tu panel de administración.
            </p>
            
            <hr style=\"border:none;border-top:1px solid #e2e8f0;margin:24px 0;\" />
            <p style=\"font-size:12px;color:#94a3b8;text-align:center;margin:0;\">
                PymeWeb ERP - Ecuador • Todos los derechos reservados
            </p>
        </div>";

        if (class_exists('\PHPMailer\PHPMailer\PHPMailer')) {
            $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
            try {
                $mail->isSMTP();
                $mail->Host       = $_ENV['SMTP_HOST'] ?? 'smtp.gmail.com';
                $mail->SMTPAuth   = true;
                $mail->Username   = $_ENV['SMTP_USER'] ?? '';
                $mail->Password   = $_ENV['SMTP_PASS'] ?? '';
                $mail->SMTPSecure = $_ENV['SMTP_SECURE'] ?? 'tls';
                $mail->Port       = (int)($_ENV['SMTP_PORT'] ?? 587);
                $mail->CharSet    = 'UTF-8';

                $mail->setFrom($_ENV['SMTP_FROM'] ?? 'soporte@pymeweb.com', 'PymeWeb ERP');
                $mail->addAddress($toEmail, $toName);
                $mail->isHTML(true);
                $mail->Subject = $subject;
                $mail->Body    = $htmlBody;

                return $mail->send();
            } catch (Throwable $e) {
                // Fallback to mail()
            }
        }

        $headers  = "From: PymeWeb ERP <soporte@pymeweb.com>\r\n";
        $headers .= "MIME-Version: 1.0\r\n";
        $headers .= "Content-Type: text/html; charset=UTF-8\r\n";

        return @mail($toEmail, $subject, $htmlBody, $headers);
    }
}
