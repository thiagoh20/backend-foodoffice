# backend-foodoffice

Backend para FoodOffice construido con Node.js, TypeScript, Express, tRPC y AWS Lambda.

## 🚀 Despliegue con GitHub Actions

El proyecto incluye un workflow de GitHub Actions que automatiza el despliegue a AWS cuando se hace push a las ramas `main` o `master`.

### Configuración de Secrets

Para que el workflow funcione correctamente, necesitas configurar los siguientes secrets en tu repositorio de GitHub:

**Configuración → Secrets and variables → Actions → New repository secret**

#### Secrets de AWS:
- `AWS_ACCESS_KEY_ID`: Tu Access Key ID de AWS
- `AWS_SECRET_ACCESS_KEY`: Tu Secret Access Key de AWS

#### Secrets de la aplicación:
- `DATABASE_HOST`: Endpoint de tu base de datos RDS (ej: `foodoffice-db.xxxxx.us-east-1.rds.amazonaws.com`)
- `DATABASE_NAME`: Nombre de la base de datos (ej: `foodoffice`)
- `DATABASE_USER`: Usuario de la base de datos (ej: `foodoffice`)
- `DATABASE_PASSWORD`: Contraseña de la base de datos
- `JWT_SECRET`: Secret para firmar los tokens JWT
- `SUBNET_IDS`: IDs de las subnets separadas por comas (ej: `subnet-xxxxx,subnet-yyyyy`)
- `SECURITY_GROUP_ID`: ID del Security Group para Lambda (ej: `sg-xxxxx`)
- `RDS_SECURITY_GROUP_ID`: ID del Security Group para RDS (ej: `sg-xxxxx`) - **Opcional**: Si no se configura, se saltará la verificación de Security Groups
- `ALLOWED_ORIGINS`: Orígenes permitidos para CORS separados por comas (ej: `https://tu-dominio.com,http://localhost:5173`)
- `OAUTH_SERVER_URL`: URL del servidor OAuth (ej: `https://tu-dominio.auth0.com`)
- `VITE_APP_ID`: ID de la aplicación OAuth
- `OAUTH_CLIENT_SECRET`: Secret del cliente OAuth
- `OWNER_OPEN_ID`: OpenID del propietario/administrador (ej: `auth0|xxxxx`)

### Cómo funciona el workflow

1. **Job de Test**: Se ejecuta en cada push y pull request
   - Instala dependencias
   - Ejecuta tests
   - Verifica tipos TypeScript
   - Construye el proyecto

2. **Job de Deploy**: Se ejecuta solo en push a `main`/`master`
   - Construye el proyecto
   - Instala AWS SAM CLI
   - Despliega a AWS usando SAM
   - **Verifica Security Groups**: Valida que Lambda y RDS tengan las reglas correctas configuradas
   - **Verifica conexión a BD**: Prueba la conexión usando el endpoint `/api/db-check`
   - Ejecuta migraciones de base de datos
   - Verifica nuevamente la conexión después de las migraciones
   - Muestra la URL de la API desplegada
   
   ⚠️ **Importante**: El pipeline fallará si:
   - Los Security Groups no están configurados correctamente
   - La conexión a la base de datos no funciona
   - Las migraciones fallan

### Despliegue manual

Si prefieres desplegar manualmente, puedes usar el script incluido:

```bash
./scripts/deploy.sh sam
```

O seguir los pasos manualmente:

```bash
npm run build
sam build
sam deploy --parameter-overrides-file sam-parameters.json
```