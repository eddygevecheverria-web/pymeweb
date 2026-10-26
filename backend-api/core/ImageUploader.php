<?php
declare(strict_types=1);

class ImageUploader {
    public static function uploadAndOptimize(array $file, string $subFolder, int $maxWidth = 600): string {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw new RuntimeException('Error al recibir el archivo de imagen.');
        }

        if ($file['size'] > 5 * 1024 * 1024) {
            throw new RuntimeException('La imagen no debe superar los 5 MB.');
        }

        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime  = $finfo->file($file['tmp_name']);
        $allowed = ['image/jpeg', 'image/png', 'image/webp'];

        if (!in_array($mime, $allowed, true)) {
            throw new RuntimeException('Formato no permitido. Usa JPG, PNG o WebP.');
        }

        $targetDir = __DIR__ . '/../uploads/' . trim($subFolder, '/');
        if (!is_dir($targetDir)) {
            mkdir($targetDir, 0755, true);
        }

        switch ($mime) {
            case 'image/jpeg':
                $srcImg = @imagecreatefromjpeg($file['tmp_name']);
                break;
            case 'image/png':
                $srcImg = @imagecreatefrompng($file['tmp_name']);
                break;
            case 'image/webp':
                $srcImg = @imagecreatefromwebp($file['tmp_name']);
                break;
            default:
                $srcImg = false;
        }

        if (!$srcImg) {
            throw new RuntimeException('No se pudo procesar la imagen.');
        }

        $width  = imagesx($srcImg);
        $height = imagesy($srcImg);

        if ($width > $maxWidth) {
            $newWidth  = $maxWidth;
            $newHeight = (int)floor($height * ($maxWidth / $width));
        } else {
            $newWidth  = $width;
            $newHeight = $height;
        }

        $dstImg = imagecreatetruecolor($newWidth, $newHeight);
        imagealphablending($dstImg, false);
        imagesavealpha($dstImg, true);
        imagecopyresampled($dstImg, $srcImg, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);

        $fileName = bin2hex(random_bytes(12)) . '.webp';
        $fullPath = $targetDir . '/' . $fileName;

        if (function_exists('imagewebp')) {
            imagewebp($dstImg, $fullPath, 82);
        } else {
            $fileName = bin2hex(random_bytes(12)) . '.jpg';
            $fullPath = $targetDir . '/' . $fileName;
            imagejpeg($dstImg, $fullPath, 85);
        }

        imagedestroy($srcImg);
        imagedestroy($dstImg);

        $baseUrl = rtrim($_ENV['BACKEND_PUBLIC_URL'] ?? 'http://localhost/pymeweb/backend-api', '/');
        return "{$baseUrl}/uploads/" . trim($subFolder, '/') . "/{$fileName}";
    }
}
