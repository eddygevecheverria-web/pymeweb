# GUÍA DEFINITIVA DE DESPLIEGUE EN PRODUCCIÓN — PYMEWEB ERP ECUADOR

Esta guía contiene las directrices de arquitectura, configuración de servidores web (Nginx / Apache), bases de datos MySQL, variables de entorno, seguridad CORS, gestión de procesos para Next.js y programación de **Cron Jobs automáticos** para PymeWeb ERP.

---

## 1. REQUISITOS DEL SERVIDOR DE PRODUCCIÓN

- **Sistema Operativo:** Ubuntu 22.04 LTS / 24.04 LTS (o Debian 12 / AlmaLinux 9).
- **PHP:** Versión 8.2 o 8.3 con módulos requeridos:
  - `php8.2-fpm` o `mod_php`
  - `php8.2-mysql` (PDO MySQL)
  - `php8.2-soap` (Vital para el Web Service del SRI de Ecuador)
  - `php8.2-curl` (Para webhooks y peticiones HTTP)
  - `php8.2-openssl` (Firma digital XAdES-BES y certificados `.p12`)
  - `php8.2-xml` / `php8.2-dom` / `php8.2-simplexml` (Generación de XML del SRI y ATS)
  - `php8.2-mbstring`, `php8.2-zip`, `php8.2-gd`
- **Node.js:** Versión 20.x LTS o 22.x LTS y gestor de procesos `pm2`.
- **Base de Datos:** MySQL 8.0+ o MariaDB 10.6+ con soporte `utf8mb4_unicode_ci`.
- **Servidor Web Reverso:** Nginx (Recomendado) o Apache 2.4 con módulos `mod_rewrite`, `mod_headers`, `mod_proxy`.

---

## 2. CONFIGURACIÓN DE VARIABLES DE ENTORNO

### A. Backend (`backend-api/.env`)
Crear el archivo `backend-api/.env` a partir de `backend-api/.env.example`:

```env
APP_ENV=production
FRONTEND_URL=https://app.pymeweb.ec
BACKEND_PUBLIC_URL=https://api.pymeweb.ec
ALLOWED_ORIGINS=https://app.pymeweb.ec,https://pymeweb.ec,https://admin.pymeweb.ec

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=pymeweb_prod
DB_USER=pymeweb_user
DB_PASS=TuPasswordSeguroMySQL2026!#

JWT_SECRET=genera_un_hash_aleatorio_sha256_de_64_caracteres_hex
CRON_SECRET=clave_secreta_para_ejecutar_cron_jobs_via_http
SRI_CRYPTO_KEY=clave_maestra_aes256_para_desencriptar_passwords_p12

SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=tls
SMTP_USER=apikey
SMTP_PASS=SG.TuClaveSendGridAqui
SMTP_FROM=facturacion@pymeweb.ec
SMTP_FROM_NAME="PymeWeb ERP - Facturación SRI"
```

### B. Frontend (`frontend/.env.production`)
Crear el archivo `frontend/.env.production` a partir de `frontend/.env.production.example`:

```env
NEXT_PUBLIC_API_URL=https://api.pymeweb.ec/api
NEXT_PUBLIC_APP_URL=https://app.pymeweb.ec
```

---

## 3. CONFIGURACIÓN DEL SERVIDOR WEB (NGINX)

Recomendamos estructurar la arquitectura en dos subdominios o dos bloques:
1. `api.pymeweb.ec` -> Apunta al directorio `backend-api/`
2. `app.pymeweb.ec` -> Proxy inverso hacia Next.js en puerto 3000

### Configuración Nginx para Backend API (`/etc/nginx/sites-available/api.pymeweb.ec`):
```nginx
server {
    listen 80;
    server_name api.pymeweb.ec;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.pymeweb.ec;

    root /var/www/pymeweb/backend-api;
    index index.php;

    ssl_certificate /etc/letsencrypt/live/api.pymeweb.ec/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.pymeweb.ec/privkey.pem;

    client_max_body_size 15M;

    # Bloquear acceso a archivos sensibles (.env, .git, etc.)
    location ~ /\.(env|git|htaccess) {
        deny all;
        return 404;
    }

    # Bloquear ejecución de PHP en la carpeta de uploads
    location ^~ /uploads/ {
        location ~ \.php$ {
            deny all;
        }
    }

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
```

### Configuración Nginx para Frontend Next.js (`/etc/nginx/sites-available/app.pymeweb.ec`):
```nginx
server {
    listen 80;
    server_name app.pymeweb.ec;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.pymeweb.ec;

    ssl_certificate /etc/letsencrypt/live/app.pymeweb.ec/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.pymeweb.ec/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 4. DESPLIEGUE DEL FRONTEND (NEXT.JS CON PM2)

En el servidor, ejecutar:

```bash
cd /var/www/pymeweb/frontend
npm install --production=false
npm run build

# Iniciar proceso con PM2 en background
pm2 start npm --name "pymeweb-frontend" -- start -- -p 3000
pm2 save
pm2 startup
```

---

## 5. PROGRAMACIÓN DE TAREAS AUTOMÁTICAS (CRON JOBS EN PHP)

PymeWeb ERP incluye dos tareas programadas esenciales en `backend-api/cron/`:

### A. Cron 1: Suspensión de Cuentas SaaS Caducadas
- **Archivo:** `backend-api/cron/suspender_cuentas_expiradas.php`
- **Frecuencia:** Todos los días a las 00:00 (Medianoche).
- **Acción:** Revisa negocios con `fecha_expiracion < NOW()`, cambia su estado a `inactivo`, activa el Muro de Pago B2C y bloquea el acceso HTTP 403 al ERP.

### B. Cron 2: Reintento Automático de Comprobantes SRI
- **Archivo:** `backend-api/cron/reintentar_comprobantes_sri.php`
- **Frecuencia:** Cada 15 minutos.
- **Acción:** Inspecciona comprobantes que quedaron en estado `PENDIENTE` o `RECIBIDA` por fallas intermitentes de los servidores SOAP del SRI, consulta su autorización, actualiza el estado a `AUTORIZADO`, genera el RIDE PDF y remite el correo al cliente.

---

### Configuración en Linux (`crontab -e`):

Abrir el programador de tareas del sistema:
```bash
crontab -e
```

Añadir las dos líneas siguientes:
```cron
# 1. Suspender cuentas SaaS expiradas a la medianoche
0 0 * * * /usr/bin/php /var/www/pymeweb/backend-api/cron/suspender_cuentas_expiradas.php >> /var/www/pymeweb/backend-api/cron/cron.log 2>&1

# 2. Reintentar facturas electrónicas SRI pendientes cada 15 minutos
*/15 * * * * /usr/bin/php /var/www/pymeweb/backend-api/cron/reintentar_comprobantes_sri.php >> /var/www/pymeweb/backend-api/cron/cron.log 2>&1
```

---

### Configuración en Windows (Programador de Tareas / Task Scheduler):

1. Abrir **Programador de Tareas** (`taskschd.msc`).
2. Crear Tarea Básica -> Nombre: `PymeWeb - Suspender Cuentas SaaS`.
   - Desencadenador: Diariamente a las `00:00`.
   - Acción: Iniciar un programa.
   - Programa/script: `C:\xampp\php\php.exe`
   - Agregar argumentos: `-f "D:\WEBCOMP\APP EMPRENDE\backend-api\cron\suspender_cuentas_expiradas.php"`
3. Crear Tarea Básica -> Nombre: `PymeWeb - Reintentar Facturas SRI`.
   - Desencadenador: Diariamente, repetir cada `15 minutos`.
   - Acción: Iniciar un programa.
   - Programa/script: `C:\xampp\php\php.exe`
   - Agregar argumentos: `-f "D:\WEBCOMP\APP EMPRENDE\backend-api\cron\reintentar_comprobantes_sri.php"`

---

## 6. CHECKLIST DE SEGURIDAD EN PRODUCCIÓN

- [x] **CORS:** La API rechaza cualquier petición cuyo `Origin` no coincida con `ALLOWED_ORIGINS` cuando `APP_ENV=production`.
- [x] **Inmutabilidad Contable:** Se prohíben sentencias `DELETE` sobre asientos mayorizados y comprobantes fiscales.
- [x] **Firma Digital SRI:** Certificados `.p12` resguardados y claves encriptadas con AES-256 en base de datos.
- [x] **Subida de Archivos:** La carpeta `uploads/` tiene desactivada la ejecución de scripts `.php`.
- [x] **Base de Datos:** Respaldos automáticos diarios programados con `mysqldump`:
  ```bash
  mysqldump -u pymeweb_user -p pymeweb_prod | gzip > /backups/pymeweb_$(date +%F).sql.gz
  ```
