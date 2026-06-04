# Despliegue en Vercel + Turso

Esta app usa **Turso** (libSQL, compatible con SQLite) como base de datos, lo
que la hace compatible con el modelo serverless de Vercel. En local funciona con
un archivo SQLite sin configuración extra.

> **Nota:** tener `@libsql/client` en las dependencias **no** hace que Vercel
> cree la base automáticamente. La provisión se hace con la integración del
> Marketplace (Opción A, recomendada) o con la CLI (Opción B).

## 1. Crear y conectar la base de datos en Turso

### Opción A — Integración nativa de Vercel (recomendada, sin CLI)

1. Importa el repositorio en Vercel (framework detectado: Next.js).
2. En el proyecto, ve a la pestaña **Storage → Marketplace Database Providers →
   Turso** y conéctala.
3. Vercel aprovisiona la base **e inyecta automáticamente** las variables de
   conexión (`TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`) en el proyecto.
4. Verifica en **Settings → Environment Variables** que esos dos nombres
   existan. Si la integración los inyecta con otros nombres, es un cambio de una
   línea en `lib/db.ts`.

### Opción B — CLI de Turso (manual)

```bash
brew install tursodatabase/tap/turso   # instalar CLI (macOS)
turso auth login
turso db create madrugo
turso db show madrugo --url             # -> TURSO_DATABASE_URL
turso db tokens create madrugo          # -> TURSO_AUTH_TOKEN
```

Luego agrega esas dos variables manualmente en
**Settings → Environment Variables**.

No necesitas crear tablas manualmente: la app crea el esquema y la semilla
(usuarios y datos de ejemplo) automáticamente en el primer arranque.

## 2. Variable de sesión (en ambas opciones)

`SESSION_SECRET` es propia de la app (Turso no la provee). Agrégala siempre en
**Settings → Environment Variables**:

| Variable | Valor |
|----------|-------|
| `TURSO_DATABASE_URL` | la inyecta la integración (Opción A) o la CLI (Opción B) |
| `TURSO_AUTH_TOKEN` | la inyecta la integración (Opción A) o la CLI (Opción B) |
| `SESSION_SECRET` | tú la generas: `openssl rand -hex 32` |

**Deploy.** En la primera visita la app crea el esquema y los usuarios semilla.

## 3. Usuarios iniciales

Se crean automáticamente:

| Rol | Usuario | Contraseña |
|-----|---------|-----------|
| Administrador | `admin` | `admin123` |
| Vendedor | `vendedor` | `venta123` |
| Consulta | `consulta` | `ver123` |

> **Seguridad:** estas son credenciales de demostración. Para un uso real,
> cambia `SESSION_SECRET` (ya lo haces arriba) y reemplaza las contraseñas
> semilla editando `lib/db.ts` antes del primer despliegue, o actualizándolas
> directamente en la base con `turso db shell madrugo`.

## Desarrollo local

No requiere Turso. La app usa `file:data/madrugo.db` por defecto:

```bash
npm install
npm run dev
```

Para probar localmente contra Turso, copia `.env.example` a `.env.local` y
rellena las variables.

## Notas

- La base local (`data/`) está en `.gitignore`; no se sube al repositorio.
- El esquema y la semilla son idempotentes: arrancar varias instancias en
  paralelo no duplica datos (se usa `CREATE TABLE IF NOT EXISTS` y
  `ON CONFLICT DO NOTHING`).
