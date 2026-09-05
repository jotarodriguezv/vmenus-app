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
  - `menu.js`, `carrito.js`, `filtros.js`, `carrusel.js`, `horarios.js`,
    `planes.js`, `preview.js`, `analytics.js`, `aviso.js`, `html.js`,
    `reproduccion.js`.
- `temas/` — variantes de navegación: `sidebar`, `topnav`, `explorar`,
  `vertical`, `carrito`, `video`. Cuál se usa lo decide la configuración del
  restaurante.

Un restaurante se identifica por su slug, y se aceptan **las dos formas a la
vez**: `menu.vmenus.co/bonzas` y `bonzas.vmenus.co`. Que ambas respondan es lo
que permite cambiar la forma oficial en el panel sin invalidar los QR ya
repartidos. No romper ninguna de las dos.

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
