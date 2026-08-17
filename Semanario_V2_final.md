# Semanario Familiar V2 — Documento final del proyecto

> Estado: **terminado y desplegado** (GitHub Pages + Supabase), versión **v22**, ya como **PWA instalable**. Este documento resume todo lo construido, cómo quedó, los problemas encontrados y cómo se resolvieron, para poder retomarlo en frío (incluso en un chat nuevo) si hiciera falta.

---

## 1. Qué es
Planificador semanal familiar (**comidas + eventos**), **multi-familia**. Front **vanilla JS** (módulos ES) en **GitHub Pages** (repo `SemanarioV2`, página de proyecto bajo `/SemanarioV2/`). Backend **Supabase** (Auth sin tokens + Postgres + RLS por `family_id`). Idioma: español (España). El usuario despliega subiendo ficheros a GitHub.

---

## 2. Stack, claves y tema
- **Supabase**: Auth (email+contraseña y enlace mágico; Google preparado sin activar), Postgres, RLS por familia.
- **Project URL**: `https://tqdxgkoyyxprbyjfgmkt.supabase.co`
- **Publishable key** (pública, en `supabase-client.js`): `sb_publishable_nA007BBfZPHWwrjwdYvdyQ_euaVkH8F`. La *secret key* NUNCA se usa/sube.
- **Hosting**: GitHub Pages (HTTPS). Servir por http solo rompería el service worker (SW solo va en HTTPS o localhost).
- **Tema**: verde azulado (teal). En el CSS las variables se llaman `--orange`/`--orange-dark` (no se renombraron) pero valen teal: `#16a596` / `#0e857a`.

---

## 3. Ficheros del proyecto (todos se despliegan)
- **`login.html`** — registro/login + alta/unión de familia (código de invitación). Guarda la familia elegida en `localStorage['semanario.family']` y va a `index.html`. Importa el cliente con versión fija `./supabase-client.js?v=22` (hay que subir ese número a mano cuando cambie el cliente).
- **`supabase-client.js`** — cliente Supabase + capa de datos (módulo ES). Exporta: `auth`, `families`, `profiles`, `recipes`, `week`, `events`, `shopping`, `pantry`, y utilidades `iso/addDays/mondayOf`.
- **`index.html`** — la app. Al cargar valida sesión+familia (si no, va a `login.html`).
- **`version.txt`** — versión publicada (actualmente `v22`); la usa el auto-update.
- **`manifest.webmanifest`** — manifest PWA (nombre, colores teal, iconos `any` + `maskable`).
- **`sw.js`** — service worker (estrategia network-first).
- **Iconos**: `icono_192x192.png`, `icono_512x512.png` (originales, purpose `any`), `icono_maskable_192.png`, `icono_maskable_512.png` (generados, dibujo sobre fondo teal claro `#DFF2EE`, purpose `maskable`; el de 192 es también el `apple-touch-icon` de iOS).
- **Migraciones SQL** (ya ejecutadas en Supabase): `schema.sql`, `migracion_guarniciones.sql`, `migracion_eventos.sql`, `migracion_color_usuario.sql`.

---

## 4. Base de datos (todo aplicado)
Tablas con RLS por familia: `families`, `profiles`, `memberships`, `ingredients` (catálogo global, `is_basic`), `recipes`, `recipe_ingredients`, `plan_days` (flag `include_in_shopping` por día), `dishes`, `events`, `recurring_events`, `recurring_exceptions`, `shopping_items`, `pantry_items`. Funciones: `is_member`, `is_admin`, `shares_family`, `create_family`, `join_family`, trigger `handle_new_user`.

Ampliaciones por migración:
- **Guarniciones**: `recipes.is_side` (bool); `dishes.side_recipe_id` (→recipes) y `dishes.side_text`.
- **Eventos**: `events.member_ids uuid[]`; `recurring_events.member_ids uuid[]` y `recurring_events.weekdays int[]`. La antigua `recurring_events.weekday` (NOT NULL) se **eliminó**.
- **Color por usuario**: `profiles.color text`.

Modelo plato: `dishes` con `slot` ('lunch'/'dinner'), `position`, principal (`recipe_id` o `free_text`) + guarnición opcional (`side_recipe_id`/`side_text`). **weekday: 0=lunes … 6=domingo**.

---

## 5. Funcionalidad final (todo funcionando)
- **Login + familia + guard de sesión**.
- **Cabecera**: avatar con la inicial y el color del usuario (abre el perfil) · nombre del grupo (centro) · Salir (derecha). Segunda línea: ‹ › + rango de fechas (tocar = hoy) · pastilla blanca con 🛒 + número (círculo teal) + 🗑️ (vaciar días marcados, conserva manuales, con confirmación).
- **Vista semana**: una tarjeta por día con **franja de color** a la izquierda (letra + fecha en una línea), **cajas de comida flotando** sobre la franja (☀️ / 🌙 azul, texto del plato con "con guarnición" si aplica), y columna **EVENTOS** a la derecha (cabecera y "+" del color del día, eventos con **rayas de color por miembro** y borde fino). Colores por día L..D. Navegación ‹ › + swipe + tocar rango = hoy. Casilla 🛒 del día en la tarjeta.
- **Editor de día** (hoja anclada arriba, autoguardado): platos con autocompletado sobre el recetario (acentos ok), texto libre = plato suelto. "+ Plato" añade; "−" flotante quita. Guarnición **al lado** del plato con su "−" flotante.
- **Recetas**: crear/ver/editar (nombre, temporada, tiempo, dificultad, preparación, ingredientes, enlace, toggle "Es guarnición"), autoguardado.
- **Eventos**: crear/editar/borrar puntuales y recurrentes multi-día. Modal anclado arriba (no lo tapa el teclado): descripción, hora opcional, chips de miembros, check recurrente → chips L-D. Color por miembro; rayas de color por persona. Se abre desde "+ Evento" o el "+" de la tarjeta. (`recurring_exceptions` existe en BD y `events.recurring.skipOn/unskipOn` en el cliente, **sin UI**.)
- **Perfil**: nombre, **selector de color completo** (área saturación/brillo + barra de tono + hex + accesos rápidos de paleta), email, tus familias con "Usar" para cambiar, y cambiar contraseña.
- **Lista de la compra (global)**: el 🛒 marca días de cualquier semana; junta todo. Toggle **Todo / Por comidas**. Básicos **unificados**: marcado = ya lo tienes (tachado, no se compra), desmarcado = a comprar; estado compartido entre ambas vistas. **WhatsApp** sin formato (solo productos, uno por línea). Manuales globales persistentes.
- **PWA**: instalable en pantalla de inicio, arranque a pantalla completa, icono propio, barra de estado teal.

---

## 6. PWA — detalles
- **`manifest.webmanifest`**: `display:standalone`, `theme_color:#16a596`, `background_color:#f2f2f4`, `start_url:./index.html`, `scope:./`, iconos `any` (originales) + `maskable` (generados, para que en Android se vean a tamaño completo).
- **`sw.js`**: estrategia **network-first** (primero red; la caché solo de respaldo sin conexión). No intercepta peticiones de otro origen (Supabase / esm.sh pasan directas). Se registra con `{updateViaCache:'none'}`. Constante `SW_VERSION` (ahora `v22`): subirla fuerza la actualización del propio SW (limpia cachés viejas en `activate`, `skipWaiting` + `clients.claim`). Se eligió network-first **a propósito** para no reabrir los problemas de caché (ver §8).
- Enlazado en `index.html` y `login.html`: `<link rel="manifest">`, `theme-color`, `apple-touch-icon` (→ maskable 192, opaco, bien en iOS), metas `apple-mobile-web-app-*`, y el `<script>` de registro del SW.

---

## 7. Sistema de versiones / cómo desplegar un cambio
- `index.html` tiene `const APP_VERSION='vNN'`; `version.txt` debe contener `vNN` idéntico.
- Al abrir, la app hace `fetch('version.txt', {cache:'no-store'})` y, si difiere de `APP_VERSION`, recarga con `?reloaded=` (baja `index.html` fresco). Además importa el cliente con `await import('./supabase-client.js?v=' + APP_VERSION)`, así el **cliente también** se refresca.
- **Para publicar un cambio**:
  1. Sube `APP_VERSION` en `index.html` y pon lo mismo en `version.txt`. Sube ambos.
  2. Si cambió `supabase-client.js`, súbelo y actualiza el `?v=NN` del import en `login.html`.
  3. Si cambió `sw.js` (o los iconos/manifest), sube `SW_VERSION` en `sw.js` y súbelo.
- **Versión actual: v22** (index, version.txt, login `?v=22`, SW `v22`).
- En PC, Ctrl+F5. En móvil, el auto-update propaga solo; los móviles con versión pre-mecanismo necesitan una recarga manual la primera vez (incógnito / `?v=NN` / borrar caché).

---

## 8. Problemas encontrados y cómo se resolvieron
1. **Login mostraba un "rol" por cada miembro del grupo.** Causa: `families.mine()` traía todas las membresías de la familia (por RLS se ven las de todos). **Solución**: filtrar `mine()` por `user_id = auth.uid()`.
2. **Guardar receta → "new row violates RLS for recipes".** **Solución**: al editar, UPDATE por id sin tocar `family_id`.
3. **"more than one relationship between dishes and recipes".** Tras la migración de guarniciones `dishes` tiene 2 FK a `recipes`. **Solución**: desambiguar embeds PostgREST con `recipes!recipe_id(...)`.
4. **Insertar recurrente fallaba por `weekday` NOT NULL.** Pasamos a `weekdays int[]`. **Solución**: `alter table recurring_events drop column weekday`.
5. **"Could not find the 'color' column … schema cache".** La columna `profiles.color` no existía / caché de PostgREST stale. **Solución**: ejecutar la migración + `notify pgrst, 'reload schema';`. Además `profiles.me()` se hizo resistente (muestra nombre/email aunque la columna tarde).
6. **La compra solo mostraba ingredientes de la guarnición.** Era dato (la receta principal no tenía ingredientes). El cálculo ya sumaba principal + guarnición.
7. **WhatsApp enviaba todo aunque tacharas / con formato (viñetas, título).** (a) El envío usa la lista sin lo tachado; (b) se quitó el formato: solo productos, uno por línea. **Causa de fondo del "seguía con formato"**: el navegador cacheaba `supabase-client.js` aparte y el auto-update solo refrescaba `index.html`. **Solución**: cargar el cliente con `?v=APP_VERSION` (import dinámico en index; `?v=NN` fijo en login).
8. **La lista de la compra cambiaba con la semana.** **Solución**: compra **global** (agrega todos los días marcados de cualquier semana; manuales globales).
9. **Caché en móvil (el gran quebradero).** Distintos móviles mostraban versiones distintas; en móvil no hay Ctrl+F5. **Solución**: mecanismo de auto-actualización por `version.txt` (fetch no-store + recarga con `?reloaded=`) e import del cliente con `?v=`. Y al montar el PWA, SW en **network-first** para no reintroducir el problema.
10. **Básicos incoherentes entre vistas ("Por comidas" no los tachaba y al desmarcar desaparecían).** **Solución**: unificar — los básicos son un ítem más de la lista con estado de tachado **compartido** por clave `nombre|unidad`; marcado = ya lo tienes (no se compra), desmarcado = a comprar (se queda en su sitio).
11. **Desbordamiento horizontal en móvil en el editor de platos (el más difícil).** La línea plato+guarnición hacía la ficha más ancha que la pantalla en algunos móviles. Se intentó `nowrap` + encoger principal/guarnición + `overflow-x:hidden` en `html` y `.ed-body`. **Causa raíz**: el contenedor del modal (`.backdrop`, grid) hacía crecer su columna al ancho del **contenido**, y `.editor{width:100%}` heredaba ese ancho. **Solución**: `.editor{ max-width:min(440px,100vw); min-width:0; overflow-x:hidden }` y fijar `.backdrop{ grid-template-columns:minmax(0,1fr) }` (columna = ancho de pantalla, no del contenido). Con eso quedó resuelto.
12. **Icono PWA se veía pequeño en el móvil.** Android encoge los iconos "normales" dentro de su forma adaptativa. **Solución**: generar iconos **maskable** (dibujo sobre fondo teal claro que llena el cuadro) y declararlos en el manifest; `apple-touch-icon` apunta a uno opaco para iOS.

---

## 9. Convenciones de código (en `index.html`)
- Script principal `<script type="module">`: primero auto-update + `const APP_VERSION` + import dinámico del cliente.
- Constantes: `MES`, `DOW`, `DOWFULL`, `DAYCOL` (colores L..D), `MOON` (SVG azul), `EV_PALETTE`.
- Semana/tarjeta: `renderWeek`, `getWeek(offset)` (con `cache`), `toUiDay`, `mealRow`, `evRowHtml`/`eventColors`/`evStripe`.
- Editor: `openEditor`, `renderDishes`/`renderDishList`, `openDrop`/`openGarnishDrop`/`setSide`, `commitFree`, `removeDish`.
- Recetas: `openRecipe`, `openRecipeForm`, `commitMeta`, `renderIngRows`.
- Eventos: `openEventForm`, `saveEvent`, `deleteEvent`, `renderEventEdit`, `refreshAfterEvent`.
- Perfil/color: `loadMyProfile`, `applyAvatar`, `openProfile`, `saveProfile`, `changePassword`; selector: `hsvToRgb/hsvToHex/hexToHsv/updatePicker/setupColorPicker` (estado `pfHsv`, `pfColorSel`).
- Compra: `openShop`, `renderShop`, `wireShopChecks`, `renderMealView`, `setShopView`, `updateWa`, `itemKey`, `addManualItem`, `resetShoppingDays`. Estado `shopState = {days, buy (incluye básicos con basic:true), view, byMeal, checked:Set}`; `checked` guarda claves `nombre|unidad` que NO se compran.
- Miembros: `MEMBERS` (con color), `memberColor`, `memberName`, `loadMembers`. Contador de días: `markedTotal` + `setBadge`.
- **Validación antes de entregar**: extraer el `<script type="module">` a `.mjs` y `node --check` (el de index tiene top-level await + import dinámico, valida tal cual). El cliente: stub del import de esm.sh + `node --check`.

---

## 10. Pendiente / ideas futuras (nada bloqueante)
- Verificar con calma que **varias familias funcionan de forma independiente** (el usuario iba a probarlo).
- Lista de próximos eventos (2-3 semanas) en el perfil.
- UI para "esta semana no" (excepciones de recurrentes; la base ya está).
- Auto-relleno de semana por temporada; biblioteca común de recetas + buscador; normalización de ingredientes; roles/permisos y notificaciones.

---

## 11. CONTEXTO MÍNIMO PARA ARRANCAR EN FRÍO
Semanario Familiar V2: app **terminada y desplegada** (GitHub Pages `SemanarioV2` + Supabase), **PWA instalable**, versión **v22**. Ficheros vivos: `login.html`, `supabase-client.js`, `index.html`, `version.txt`, `manifest.webmanifest`, `sw.js`, 4 iconos, + 4 migraciones ya ejecutadas. RLS multi-familia. Tema teal (variables se llaman `--orange` pero valen teal). Funciona todo: login/familia, semana con tarjetas (franja de color + cajas flotantes + columna de eventos), editor con recetas y guarniciones (autoguardado), eventos (puntuales+recurrentes multi-día, miembros, rayas de color), perfil con selector de color y cambio de familia, y compra global con vistas Todo/Por comidas, básicos unificados y WhatsApp sin formato. Anti-caché: auto-update por `version.txt` + cliente con `?v=` + SW network-first. **Método de trabajo**: partir SIEMPRE de los ficheros que suba el usuario (llevan sus ajustes), validar el JS con `node --check` antes de entregar, y al publicar subir la versión (index+version.txt; login `?v=` si cambia el cliente; `SW_VERSION` si cambia el SW/iconos/manifest). El historial de problemas y soluciones está en §8.
