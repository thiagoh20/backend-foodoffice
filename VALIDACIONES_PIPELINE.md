# ✅ Validaciones en el Pipeline

El pipeline de GitHub Actions ahora incluye validaciones automáticas para asegurar que la conexión a la base de datos funcione correctamente.

## 🔍 Validaciones Incluidas

### 1. Verificación de Security Groups

El pipeline verifica que:
- ✅ Lambda Security Group permita tráfico **saliente** al puerto 5432 hacia RDS
- ✅ RDS Security Group permita tráfico **entrante** desde Lambda en puerto 5432

**Si falla**: El pipeline mostrará los comandos exactos para configurar los Security Groups.

### 2. Verificación de Conexión a Base de Datos

El pipeline:
- ✅ Prueba la conexión usando el endpoint `/api/db-check`
- ✅ Verifica que la conexión sea exitosa
- ✅ Comprueba si las tablas existen
- ✅ Reintenta hasta 5 veces con esperas de 10 segundos entre intentos

**Si falla**: El pipeline mostrará el error y los pasos de troubleshooting.

### 3. Verificación Post-Migraciones

Después de ejecutar las migraciones:
- ✅ Verifica nuevamente la conexión
- ✅ Confirma que las tablas existen

## 📋 Configuración Requerida

### Secret: `RDS_SECURITY_GROUP_ID`

Para que la verificación de Security Groups funcione, necesitas agregar este secret en GitHub:

1. Ve a tu repositorio en GitHub
2. **Settings** → **Secrets and variables** → **Actions**
3. Haz clic en **New repository secret**
4. Nombre: `RDS_SECURITY_GROUP_ID`
5. Valor: El ID del Security Group de RDS (ej: `sg-05ab21fca371a7df5`)

**Nota**: Si no configuras este secret, el pipeline saltará la verificación de Security Groups pero seguirá verificando la conexión a la base de datos.

## 🔧 Qué Hacer si las Validaciones Fallan

### Error: Security Groups no configurados

Si el pipeline falla en la verificación de Security Groups, verás un mensaje como:

```
❌ Lambda Security Group NO permite tráfico saliente al puerto 5432
   Configura la regla:
   aws ec2 authorize-security-group-egress \
     --group-id sg-xxxxx \
     --ip-permissions IpProtocol=tcp,FromPort=5432,ToPort=5432,UserIdGroupPairs=[{GroupId=sg-yyyyy}]
```

**Solución**: Ejecuta los comandos que muestra el pipeline en tu terminal con AWS CLI configurado.

### Error: Conexión a base de datos falla

Si el pipeline falla en la verificación de conexión, verás:

```
❌ Error en la conexión: [mensaje de error]
💡 Troubleshooting:
   - [paso 1]
   - [paso 2]
```

**Solución**: 
1. Revisa los pasos de troubleshooting mostrados
2. Verifica que los Security Groups estén configurados
3. Verifica que `DATABASE_URL` esté correcto en los secrets
4. Revisa los logs de CloudWatch para más detalles

### Error: Tablas no existen después de migraciones

Si las migraciones se ejecutan pero las tablas no aparecen:

1. Revisa los logs de la función `MigrateFunction` en CloudWatch
2. Verifica que `DATABASE_URL` tenga las credenciales correctas
3. Ejecuta las migraciones manualmente si es necesario

## 📊 Flujo del Pipeline

```
1. Build del proyecto
   ↓
2. Despliegue con SAM
   ↓
3. Verificación de Security Groups ⚠️ (si RDS_SECURITY_GROUP_ID está configurado)
   ↓
4. Espera 15 segundos (propagación)
   ↓
5. Verificación de conexión a BD (5 reintentos)
   ↓
6. Ejecución de migraciones
   ↓
7. Verificación post-migraciones
   ↓
8. ✅ Pipeline exitoso
```

## 🚨 Comportamiento del Pipeline

- **Si Security Groups fallan**: El pipeline **falla** y muestra cómo corregirlo
- **Si la conexión falla**: El pipeline **falla** después de 5 intentos
- **Si las migraciones fallan**: El pipeline **falla** y muestra el error

Esto asegura que solo se despliegue código que pueda conectarse correctamente a la base de datos.

## 💡 Tips

1. **Primera vez**: Configura `RDS_SECURITY_GROUP_ID` antes del primer despliegue
2. **Debugging**: Si las validaciones fallan, revisa los logs completos del workflow en GitHub Actions
3. **Reintentos**: El pipeline espera automáticamente entre reintentos, no necesitas hacer nada
4. **Propagación**: Los cambios en Security Groups pueden tardar unos segundos, el pipeline espera automáticamente

## 🔗 Ver Logs del Pipeline

Para ver los logs detallados:

1. Ve a tu repositorio en GitHub
2. **Actions** → Selecciona el workflow que falló
3. **Deploy** → Expande el paso que falló
4. Revisa los mensajes de error y troubleshooting
