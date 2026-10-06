# vmenus-app

El menú digital que ve el comensal. **Sitio estático servido por nginx**: no
hay build, ni bundler, ni framework — módulos ES nativos cargados por el
navegador. El panel de administración es otro repositorio,
`adminmenus_restaurantes`; los dos comparten la misma base de datos Supabase
(`menu-restaurantes`, `tllpmdhkdlqoqpnqmuwn`).

El `package.json` existe **solo para las pruebas**. No hay dependencias que
instalar: no ejecutar `npm install` esperando que haga algo.

## Reglas de trabajo

- **Nunca commitear sobre `main`.** Una rama por tarea, salida de `main`, y el
  merge lo hace el usuario por pull request.
- **Commitear y abrir el pull request al terminar cada tarea, sin preguntar.**
  Acordado el 05/09/2026; antes había que esperar el visto bueno antes de cada
  commit. La revisión pasó a ocurrir **en el pull request**: el usuario entra,
  lee el diff y mergea. Preguntar al final de cada tarea era un paso de más que
  no añadía revisión, porque la revisión de verdad la hace igualmente en GitHub.
- **El merge lo sigue haciendo el usuario.** Un pull request abierto no es un
  cambio aplicado, y `main` no se toca nunca directamente.
- **Correr las pruebas antes de commitear**, no después: ya no hay una pausa en
  la que alguien las mire por ti.
- Código, comentarios y documentación en español. Los mensajes de commit son la
  excepción: van en inglés e imperativos ("Add…", "Enhance…", "Refactor…"),
  siguiendo el historial existente.
- Sin dependencias nuevas y sin paso de compilación. Lo que se escriba tiene
  que funcionar tal cual lo sirve nginx.

## Estructura

- `index.html` — el menú. `tv.html` — la cartelera para el televisor del local,
  independiente y escrita en JavaScript más conservador a propósito, porque
  corre en navegadores de televisores viejos.
- `core/` — la lógica compartida:
  - `loader.js` orquesta el arranque completo (slug de la URL → configuración
    del restaurante → estilos → tema → menú → extras). Es el mejor sitio por
    donde empezar a leer.
  - `supabase.js` — el **único** lugar donde viven la URL y la clave
    publicable. No repetirlas en ninguna página.
  - `menu.js`, `carrito.js`, `filtros.js`, `buscador.js`, `carrusel.js`,
    `horarios.js`, `planes.js`, `preview.js`, `analytics.js`, `aviso.js`,
    `html.js`, `reproduccion.js`.

  `ofertas.js` es la **oferta de precio** de un plato: un precio menor, con
  fechas opcionales (`oferta_*` en `productos`, `sql/35` del panel). La carta
  enseña el de siempre tachado y el nuevo al lado —lo pinta `htmlPrecio()` de
  `html.js`, que usan los cinco temas y la ficha— y el carrito cobra el nuevo
  (`precioVigente()`). **No es la «promoción»** (`promociones.js`): esa es una
  imagen y no toca ningún precio. La regla vive en TRES sitios —aquí, `tv.html`
  y `public/oferta.js` del panel— y los tres corren contra
  `test/casos-oferta.json`, **duplicado a propósito en los dos repositorios**.
  Se calcula en la zona del restaurante y al pintar, nunca guardada. Ver
  `docs/ofertas.md` del panel.

  `negocio.js` son los **datos del negocio** que el restaurante dice una vez en
  Ajustes (hoy el WhatsApp y si se enseña su botón): `whatsappDelNegocio()` para
  recibir pedidos y `whatsappParaMostrar()` para los botones; y, desde el paso 2,
  `direccionDelNegocio()`, `mapaDelNegocio()` y `resenaDelNegocio()` para la
  bienvenida (las claves son `direccion`, `mapa_url` y `resena_url`, y la
  ubicación solo sale con `intro_mapa_activo` encendido); y, desde el paso 4,
  `textoHorarioAtencion()` y `correoDelNegocio()`: la bienvenida enseña una línea
  de horario y un enlace de correo, cada una con su interruptor
  (`intro_horario_activo`, `intro_correo_activo`; ausente es encendido). Las claves viejas
  (`whatsapp_pedidos`, `social_whatsapp`) solo se leen si la nueva no existe, y
  `''` es «no hay número». La regla está también en el panel y en su servidor, y
  las tres corren contra `test/casos-negocio.json`, **duplicado a propósito**.
  Ver `docs/datos-del-negocio.md` del panel.

  `intro.js` pinta la bienvenida; con `atributos.intro_estilo_carta === true` («Usar los colores y la
  tipografía de la carta», opt-in) toma de la carta el fondo —copiado del `<body>`—, la tarjeta, el borde,
  el texto y las fuentes, y los campos de color manuales dejan de aplicarse sin borrarse
  (`aplicarEstiloDeLaCarta`, CSS `.intro-vmenus--carta`); las **reservas de mesa** (botón y formulario dentro de
  su tarjeta) viven aparte en `reservas-intro.js`, con el `fetch` por parámetro
  para probarlas. La carta no escribe en la base: manda la reserva al panel
  (`POST /api/reservas`), que valida de verdad. Ver `docs/reservas.md` del panel.

  `filtros.js` y `buscador.js` acotan la misma carta y esconden por el mismo
  sitio (`ocultarNoCoinciden`): con un filtro puesto y una palabra escrita se
  cumplen las dos cosas. Los dos nacieron dentro de `temas/explorar.js`, que
  era el único modelo que podía filtrar y buscar aunque los datos estuvieran
  ahí para todos; el buscador salió el 17/09/2026. Explorar conserva su lupa
  —es suya— y comparte qué coincide.

  **El buscador se puede apagar por restaurante** con `atributos.buscador`
  (ausente es encendido, como los filtros), y no se ofrece en cartas de menos
  de `MINIMO_PLATOS_BUSCADOR` platos: una carta corta se lee de un vistazo. El
  panel todavía no tiene el interruptor; el día que lo ponga, la carta ya lo
  respeta.
- `temas/` — variantes de navegación. De fotos: `topnav`, `sidebar` y
  `explorar`; de video: `video` y `vertical`. Cuál se usa lo decide la
  configuración del restaurante, y qué modelos se ofrecen, su plan
  (`core/planes.js`). El modelo `carrito` se retiró el 17/09/2026: el carrito
  es un interruptor en los cinco.

Un restaurante se identifica por su slug, y el código acepta **las dos formas**
(`leerRuta` en `core/sedes.js`): el slug en la ruta —`menu.vmenus.co/bonzas`—
y el slug en el subdominio —`bonzas.vmenus.co`—. No romper ninguna de las dos:
es lo que permitiría cambiar la forma oficial sin invalidar un QR repartido.

**Pero hoy en producción solo responde la de la ruta**, comprobado el
17/09/2026. No hay DNS comodín para `*.vmenus.co`, así que `bonzas.vmenus.co`
devuelve el 404 de Traefik; el código está listo para el día que se configure,
no antes. Esto no deja a nadie sin carta: **ningún QR impreso usa esa forma.**

Los dos restaurantes que tienen su carta en un subdominio son los dos primeros
clientes, y ese subdominio es de **otro dominio**, `verificame.click`, de antes
de que existiera el panel: `bonzaburgergrill.verificame.click` y
`malparados.verificame.click`. No sirven esta aplicación — son dos páginas de
nueve líneas que redirigen a `menu.vmenus.co/<slug>`, y siguen vivas porque sus
QR ya estaban impresos. La historia completa está en
`adminmenus_restaurantes/docs/servidor.md` §1.

## Presentaciones de un plato

Un mismo plato puede venir en versiones (1X $12.000 / 2X $20.000; 500 ml / 750 ml). Siguen siendo UN plato: su foto,
su descripción y su categoría, con una lista en `producto.atributos.presentaciones` (`{ id, nombre, precio_numerico }`).
`core/presentaciones.js` es la regla: `htmlPrecio()` pinta «1X $ 12.000 · 2X $ 20.000» (o «Desde» con más de tres) en
los cinco temas y la ficha; el botón «+» abre el modal para **elegir presentación**, y cada una es una línea distinta del
carrito (`<id>~<presId>__…`, nombre «Plato · 2X»; sin presentación, la clave de siempre). `revalidarCarrito` recalcula
contra LA presentación de hoy y retira la línea si ya no existe. El precio base del plato es el de la más barata (lo
sincroniza el servidor). **Todavía no distinguen presentaciones**: el precio por sede (`productosDeLaSede` las conserva)
y la oferta de precio (se ignora). `tv.html` tiene su copia en dialecto viejo, contra `test/casos-presentaciones.json`.
Ver `docs/presentaciones.md` del panel.

## Sedes

Un restaurante con varios locales que comparten carta pero **no precios**
(Piedecuesta y Bucaramanga: casi todo cuesta más en una). La carta no se entera:
`core/sedes.js` son funciones puras que, al entrar por
`menu.vmenus.co/<restaurante>/<sede>`, devuelven el restaurante con los datos del
negocio de esa sede por encima y los platos con su precio y disponibilidad —el
resto del código sigue leyendo los mismos campos—. Sin la sede en la URL sale
`core/selector-sedes.js`; **con la bienvenida encendida, las sedes son una tarjeta dentro de ella** (`htmlSedesIntro` en `intro.js`: sin «Ver carta», sin Escape, sin reservas, sin dirección/horario/mapa del restaurante) y el selector propio queda solo para los que no tienen bienvenida. Quien elige sede deja una nota en `sessionStorage` y la carta de esa sede se salta la bienvenida UNA vez (`vieneDelSelector`). Las tablas son `sedes` y `productos_sedes` (`sql/37` del
panel) y **solo se piden si `atributos.con_sedes` es `true`**: un restaurante sin
sedes no paga una petición de más ni depende de que existan. Ver
`docs/sedes.md` del panel.

**La cartelera (`tv.html`) también es por sede**: cada pantalla pertenece a una sede
(`atributos.tv.sede` / `tv_pantallas[n].sede`, el slug) y enseña SUS precios y platos.
Es una **segunda copia** de la regla de precios (`productosDeLaSede`, en dialecto viejo)
y las dos corren contra `test/casos-sede.json`. Una pantalla de un restaurante con
sedes **sin sede asignada no enseña nada**: se queda en reposo diciendo que falta (los
precios base serían los de otro local). La caché de la pantalla es por número de
pantalla, no solo por restaurante. **Los destacados** (`promociones`) pueden ser de una sede
(`sede_id`, `sql/39` del panel; vacío = todas): `deLaSede()` en `core/promociones.js` y su
copia en `promocionesDeAhora()` de `tv.html`, contra `test/casos-promo-sede.json`. El filtro
de sede va **antes** de los niveles (fondo/programada), y uno atado a una sede **no sale**
donde no hay sede (apagar «Varias sedes» los esconde, no los borra).

**El carrito es por sede**: se guarda como `<restaurante>_<sede>_cart` (sin sede, la clave de siempre) y el
pedido que se registra lleva `sede_id`; el WhatsApp al que sale ya era el de la sede, porque `negocio.js` lee los
datos del negocio que `restauranteDeLaSede()` puso por encima.

Dos detalles que se pagan caros: `index.html` importa sus módulos con ruta
**absoluta** (`/core/loader.js`) porque con la sede la URL tiene dos trozos y una
ruta relativa buscaría `/enchulados/core/…`; y si falla la lectura de
`productos_sedes` la carta **no** sigue con precios base, se cae a propósito: un
precio de otra sede cobrado en silencio es peor que un error visible.

## Seguridad

La clave de `core/supabase.js` es la **publicable**: es pública por diseño y no
pasa nada porque se vea. Lo que protege los datos son las políticas RLS de
Supabase, no el secreto de esa clave. La clave de servicio no entra jamás en
este repositorio.

Todo lo que se sirva desde aquí es público: cualquier archivo del repositorio
acaba accesible por URL. Por eso el `Dockerfile` borra `nginx.conf` de la raíz
web después de copiarlo — leer el comentario de ahí antes de tocar esa parte.

Al construir HTML a partir de datos del restaurante, escapar con el ayudante de
`core/html.js`. Está en una función compartida, y no copiado en cada plantilla,
justamente para que nadie tenga que acordarse.

## Comandos

```bash
npm test        # node --test sobre test/*.test.js
```

Las pruebas corren en GitHub Actions en cada push a `main` y en cada PR, con
Node 22. El workflow incluye `push` a `main` a propósito: a veces se suben
archivos directamente desde la web de GitHub, sin pasar por ningún pull
request, y son justo los que menos revisión llevan.

Correrlas antes de dar una tarea por terminada.
