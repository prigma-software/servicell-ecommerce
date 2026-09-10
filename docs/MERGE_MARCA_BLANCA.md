# Informe de Sincronización y Merge con Marca Blanca
**Proyecto:** `servicell-ecommerce` (Hijo)  
**Origen:** `E-commerce` (Marca Blanca / Padre)  
**Fecha:** 10 de Septiembre de 2026  
**Rama:** `master`  
**Estado:** ✅ Sincronizado, migrado y validado con éxito

---

## 1. Contexto y Objetivos

El modelo de desarrollo de la plataforma opera bajo la regla de **Marca Blanca Unidireccional**: las nuevas funcionalidades, correcciones de arquitectura y blindajes de seguridad se construyen y prueban en el repositorio base (`E-commerce`) y luego se heredan a los proyectos hijos (`servicell-ecommerce`, `VitaminasPaTi-E-commerce`).

### Objetivos Clave de esta Sincronización:
1. Incorporar el nuevo paquete integral de **remediación de seguridad RLS**, blindaje de inventario y saneamiento de órdenes.
2. Incorporar el soporte multicanal modular de **WhatsApp Cloud API / Resend** y la navegación bidireccional entre `/admin` y `/profile`.
3. Restringir la verificación del sistema de licencias PRIGMA a las rutas de `/admin`, impidiendo que un retraso o fallo de red bloquee la tienda pública al cliente final.
4. **Preservar al 100% la identidad de marca de Servicell** (colores verdes, logotipo corporativo, datos de contacto, textos y dominio de Cloudflare).
5. Aplicar la migración de base de datos correspondiente en el proyecto Supabase de Servicell (`ckawadlcahgbtsyszcgi`).
6. Dejar todo listo para el despliegue a producción en Cloudflare Workers / OpenNext.

---

## 2. Resumen de Cambios Funcionales Heredados

A continuación se detalla qué se incorporó desde Marca Blanca y cuál es su justificación técnica:

| Módulo / Archivo | Cambio Realizado | Justificación y Beneficio |
| :--- | :--- | :--- |
| **Licenciamiento PRIGMA**<br>`app/layout.tsx`<br>`app/admin/layout.tsx` | Se extrajo el `LicenseProvider` del layout raíz global y se reubicó exclusivamente dentro del layout de `/admin`. | El storefront de cara al cliente ya no sufrirá bloqueos ni pantallas de carga por verificación de licencia. El bloqueo de licencia solo se hace efectivo al ingresar al panel administrativo. |
| **Navegación Admin / Perfil**<br>`src/shared/components/Navbar.tsx`<br>`admin-sidebar.tsx` | Se añadió navegación cruzada entre `/profile` ("Mi Cuenta") y `/admin`, con validación estricta de roles (`administrador`, `vendedor`, `tecnico`). | Permite al administrador moverse fluidamente entre la experiencia de cliente y el panel de control sin perder la sesión. |
| **WhatsApp Cloud API**<br>`src/config/notifications.config.ts`<br>`whatsapp.service.ts` | Integración de `WHATSAPP_ENV` (`test` vs `production`) y soporte multicanal desacoplado para órdenes y taller. | Facilita cambiar entre el número de sandbox (+1 555...) y la línea oficial (+57...) sin alterar código. Las plantillas y notificaciones quedan configuradas en `false` por defecto para Servicell. |
| **Seguridad y Pentesting**<br>`docs/security_audit_report.md`<br>`scripts/functional-test-runner.mjs` | Baterías de pruebas funcionales para 7 dominios de seguridad, sanitización contra XSS en datos de seguimiento de taller y reportes automáticos con Strix. | Previene inyecciones maliciosas y garantiza que los datos sensibles como claves o contraseñas no se expongan en la API pública de seguimiento. |
| **Checkout y Wompi**<br>`src/features/orders/actions/wompiActions.ts` | Corrección en la generación de la firma de integridad SHA-256 de Wompi y normalización del prefijo telefónico `+57`. | Evita rechazos en el webhook de Wompi y previene alteración de montos en transacciones en línea. |

---

## 3. Auditoría de Identidad Visual y Configuración Estética (Garantía de Intactitud)

De acuerdo con las reglas de personalización multi-marca, se verificó de forma estricta que **ningún archivo de personalización estética de Servicell fue modificado ni sobrescrito**:

- ✅ **`lib/constants/branding-store.ts`:** Se conservó intacta la razón social ("Servicell Sogamoso"), teléfonos de atención, redes sociales, NIT, dirección y textos corporativos.
- ✅ **`public/images/brandClient/`:** Se conservaron íntegros todos los recursos gráficos (logos de Servicell en formatos claro, oscuro, isotipo y assets de redes sociales).
- ✅ **`lib/theme/` y `app/globals.css`:** Se ejecutó `npm run generate:theme` verificando que los 30 tokens del esquema de color verde esmeralda y fondos oscuros de Servicell se generaran al 100% sin alteraciones.
- ✅ **`wrangler.jsonc`:** Se mantuvieron intactos el nombre del worker `servicell-e-commerce` y la ruta del dominio personalizado `servicell-sogamoso.com`.
- ✅ **`public/site.webmanifest`:** Se mantuvo el nombre y color de tema `#247758` propio de Servicell.

---

## 4. Incidencias Técnicas en las Migraciones y sus Soluciones

Durante el proceso de despliegue de base de datos se detectaron y resolvieron dos contingencias técnicas críticas:

### Incidencia A: Conflicto de Doble Ejecución por Script de Rollback
* **Causa:** En el commit de seguridad de Marca Blanca se había incluido un script de reversión de emergencia llamado `20260907120000_security_hardening_rollback.sql` ubicado dentro de `supabase/migrations/`.
* **Problema Detectado:** Al ejecutar `supabase db push --dry-run`, el CLI de Supabase listó **ambos** archivos para ejecución secuencial. En Supabase CLI, cualquier archivo `.sql` en `migrations/` se procesa como una migración hacia adelante, por lo que el script de rollback habría anulado de inmediato las políticas de seguridad recién creadas.
* **Solución Aplicada:**
  1. Se creó el directorio dedicado [`supabase/rollbacks/`](file:///Users/christian/Documents/Empresa/E-commerce/servicell-ecommerce/supabase/rollbacks).
  2. Se movió el archivo de reversión fuera de `migrations/` hacia `supabase/rollbacks/20260907120000_security_hardening_rollback.sql`.
  3. Esto garantizó que el script de emergencia permanezca respaldado en el repositorio sin ser ejecutado accidentalmente por el CLI.

---

### Incidencia B: Error SQLSTATE 42P13 en Función `get_work_order_public`
* **Error:** 
  ```text
  ERROR: return type mismatch in function declared to return work_orders (SQLSTATE 42P13)
  Final statement returns too few columns.
  ```
* **Causa:** La función `public.get_work_order_public(p_tracking_id TEXT, p_phone TEXT)` está declarada con retorno `SETOF public.work_orders`. La tabla `work_orders` tiene 12 columnas (incluyendo `resolution_note`, añadida previamente para la facturación de servicios en el módulo POS). En la nueva migración, la consulta `SELECT` solo proyectaba 11 columnas, omitiendo `resolution_note`.
* **Solución Aplicada:**
  Se modificó la migración `20260907120000_security_hardening.sql` para proyectar las 12 columnas correspondientes en el orden exacto del esquema de la tabla:
  ```sql
  CREATE OR REPLACE FUNCTION public.get_work_order_public(p_tracking_id TEXT, p_phone TEXT)
  RETURNS SETOF public.work_orders
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
  AS $$
    SELECT 
      id,
      tracking_id,
      customer_name,
      customer_phone,
      status,
      estimated_cost,
      notes,
      created_at,
      updated_at,
      (custom_metadata - 'password' - 'contraseña' - 'pin' - 'clave') AS custom_metadata,
      customer_email,
      resolution_note
    FROM public.work_orders 
    WHERE tracking_id = p_tracking_id 
      AND customer_phone = p_phone;
  $$;
  ```
* **Resultado:** La migración se aplicó exitosamente a la base de datos de producción de Servicell (`ckawadlcahgbtsyszcgi`), logrando paridad total entre el esquema local y el remoto.

---

## 5. Configuración de Variables de Entorno (`.env`)

El archivo `.env` local de `servicell-ecommerce` quedó actualizado con las siguientes directivas:

1. **Licencia PRIGMA Oficial:**
   ```env
   PRIGMA_URL=https://prigma.net
   LICENSE_KEY=lk_8c5f...[CONFIGURADO_LOCALMENTE]
   ```
2. **Notificaciones y Plantillas (Desactivadas por defecto):**
   ```env
   ENABLE_EMAIL_NOTIFICATIONS=true
   ENABLE_WHATSAPP_NOTIFICATIONS=false
   WHATSAPP_USE_TEMPLATES=false
   WHATSAPP_TEMPLATE_LANGUAGE=es_CO
   WHATSAPP_DEFAULT_COUNTRY_CODE=57
   ```
3. **Mantenimiento y Automatización:**
   ```env
   CRON_SECRET=cron_secret_...[CONFIGURADO_LOCALMENTE]
   SUPABASE_ACCESS_TOKEN=sbp_fc06...[CONFIGURADO_LOCALMENTE]
   ```

---

## 6. Estado en Control de Versiones (Git)

- **Repositorio Remoto:** `prigma-software/servicell-ecommerce.git`
- **Rama:** `master`
- **Últimos Commits Clave:**
  - `1a07bb7`: *Merge remote-tracking branch 'upstream/master'* (integración del fix de resolución de columnas).
  - `4e1c1a5`: *Merge remote-tracking branch 'upstream/master'* (sincronización de seguridad y módulos).
- **Estado Local:** `working tree clean`, 100% sincronizado con `origin/master`.

---

## 7. Próximos Pasos: Despliegue en Cloudflare

Una vez completadas las pruebas y validaciones locales, el flujo de despliegue a Cloudflare comprende:

1. **Pre-construcción:**
   ```bash
   npm run generate:theme
   ```
2. **Construcción para OpenNext / Cloudflare Workers:**
   ```bash
   npm run build:worker
   ```
   *(o `npx open-next-cloudflare build` según el script de package.json).*
3. **Publicación con Wrangler:**
   ```bash
   npx wrangler deploy
   ```
   *(Wrangler tomará automáticamente la configuración de `wrangler.jsonc` con el dominio `servicell-sogamoso.com`).*
