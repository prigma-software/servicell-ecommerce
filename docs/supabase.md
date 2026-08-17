# Migraciones y Replicabilidad en Supabase

Este proyecto depende 100% de que la base de datos sea replicable para nuevos clientes o entornos de desarrollo. **NO EXISTE la modificación manual de la base de datos.** Si tocás la base de datos en producción por la UI sin una migración, estás arruinando la replicabilidad del proyecto.

## Reglas de la Base de Datos

### 1. Migraciones como Única Fuente de Verdad
Cualquier cambio en el esquema (crear tablas, alterar columnas, policies de RLS, funciones RPC, triggers) DEBE estar documentado en un archivo SQL dentro de `supabase/migrations/`.

⚠️ **REGLA ESTRICTA DE DESPLIEGUE:** TODAS las migraciones se ejecutan **exclusivamente desde la terminal** mediante el CLI de Supabase (`npx supabase db push`). **Está prohibido ejecutar scripts manualmente en el SQL Editor web** para garantizar la consistencia y el historial de versiones del CLI.

- **Para crear una migración nueva:**
  ```bash
  npx supabase migration new nombre_descriptivo_de_la_migracion
  ```
- **Escribir SQL:** Escribí tu código SQL en el archivo generado (ej. `2026..._nombre.sql`).
- **Aplicar en local:**
  ```bash
  npx supabase db reset
  ```
  Esto borra y recrea la BD local desde cero ejecutando todas las migraciones en orden. Si falla, tu migración está mal.

### 2. Tipos Fuertemente Tipados
La base de datos genera los tipos de TypeScript. Si agregas una columna, **DEBES** regenerar los tipos.
```bash
npx supabase gen types typescript --local > types/supabase.ts
```
*(Nota: ajustá el comando según si usas local o link a proyecto dev)*

### 3. Replicabilidad Total
La gracia de esta arquitectura es que si mañana llega un cliente nuevo, simplemente instanciamos un nuevo proyecto en Supabase, ejecutamos el CLI para pushear las migraciones (`npx supabase db push`) y tenemos una base de datos productiva lista. 
Si hacés cambios clickeando botones en el panel de Supabase y te olvidás de hacer un `supabase db pull` o de crear la migración equivalente, rompés esta cadena.

### 4. Row Level Security (RLS)
- **TODAS** las tablas deben tener RLS habilitado.
- Las políticas de seguridad (Policies) se definen en las migraciones SQL, no en la UI.
- Todo acceso desde la web usa el cliente de Supabase asumiendo el rol `authenticated` (si el usuario hizo login) o `anon` (si no). El backend (`lib/actions/*`) muchas veces usa el `service_role` client para saltarse RLS cuando es **absolutamente necesario y seguro** hacerlo.
