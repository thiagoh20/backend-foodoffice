# FoodOffice Backend

Backend API para el sistema de gestión de pedidos de oficina.

## Requisitos

- Node.js 20.x
- npm (incluido con Node.js)
- Docker y Docker Compose (para la base de datos)

## Instalación

```bash
npm install
```

## Configuración

### 1. Iniciar la base de datos con Docker

Primero, inicia el contenedor de PostgreSQL:

```bash
docker-compose up -d
```

Esto iniciará PostgreSQL en el puerto 5432 con las siguientes credenciales por defecto:
- Usuario: `foodoffice`
- Contraseña: `foodoffice123`
- Base de datos: `foodoffice`




Puedes personalizar estas credenciales creando un archivo `.env` con las variables:
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `POSTGRES_PORT`

### 2. Configurar el backend

Crea un archivo `.env` en la raíz del proyecto backend con las siguientes variables:

```env
# Base de datos (conecta a PostgreSQL en Docker)
DATABASE_URL=postgresql://foodoffice:foodoffice123@localhost:5432/foodoffice

# JWT Secret para cookies de sesión
JWT_SECRET=tu-secret-jwt-aqui

# OAuth (opcional)
OAUTH_SERVER_URL=https://tu-servidor-oauth.com
VITE_APP_ID=tu-app-id

# CORS (opcional, separado por comas)
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Puerto del servidor (opcional, por defecto 3000)
PORT=3000
```

### 3. Ejecutar migraciones

Una vez que la base de datos esté corriendo, ejecuta las migraciones:

```bash
npm run db:push
```

O si prefieres usar migraciones:

```bash
npm run db:migrate
```

## Scripts

- `npm run dev` - Inicia el servidor en modo desarrollo con hot-reload
- `npm run build` - Construye el proyecto para producción
- `npm start` - Inicia el servidor en modo producción
- `npm run build:start` - Construye e inicia el servidor
- `npm run check` - Verifica tipos TypeScript
- `npm test` - Ejecuta tests
- `npm run db:push` - Aplica cambios del schema a la base de datos
- `npm run db:generate` - Genera migraciones de Drizzle
- `npm run db:migrate` - Ejecuta migraciones

## Desarrollo

```bash
npm run dev
```

El servidor se iniciará en `http://localhost:3000` (o el puerto disponible más cercano).

## API

El backend expone una API tRPC en `/api/trpc`.

### Endpoints adicionales:

- `POST /api/dev/login` - Login de desarrollo (solo cuando OAuth no está configurado)
- `GET /api/oauth/callback` - Callback de OAuth

## Despliegue

### Vercel

El proyecto está configurado para desplegarse en Vercel. El archivo `api/index.ts` es el punto de entrada para las funciones serverless.

### Base de datos con Docker Compose

El proyecto incluye un `docker-compose.yml` para ejecutar PostgreSQL localmente:

```bash
# Iniciar PostgreSQL
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener PostgreSQL
docker-compose down

# Detener y eliminar volúmenes (¡cuidado! esto borra los datos)
docker-compose down -v
```

### Docker para el backend

```bash
docker build -t foodoffice-backend .
docker run -p 3000:3000 foodoffice-backend
```
