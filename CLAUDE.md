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
(`leerSlug` en `core/loader.js`): el slug en la ruta —`menu.vmenus.co/bonzas`—
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
