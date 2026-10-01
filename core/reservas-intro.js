// Reservas de mesa desde la pantalla de bienvenida (01/10/2026). El restaurante
// las enciende en el panel (Apariencia → bienvenida); aquí está lo que ve el
// comensal: un botón y un formulario DENTRO de la tarjeta de la bienvenida —no
// una ventana encima de otra— que se guarda llamando al panel
// (POST /api/reservas). La carta no escribe en la base.
//
// Va en su propio módulo, y no dentro de intro.js, para poder probarlo sin el
// DOM de la bienvenida: lo que decide qué se manda y cómo se valida son
// funciones puras, y el envío recibe el `fetch` por parámetro.
//
// Las reglas de verdad las pone el servidor (reservas.js del panel); lo de aquí
// es para avisar antes de enviar, no para proteger nada.
import { esc } from './html.js';

export const RESERVA_TEXTO_POR_DEFECTO = 'Reservar mesa';
export const RESERVA_TITULO = 'Aparta tu mesa con anticipación';
const TEXTO_MAX = 40;
const PERSONAS_MAX = 50;
const DIAS_ADELANTE_MAX = 90;
const ZONA_POR_DEFECTO = 'America/Bogota';

// Solo con `true` de verdad, igual que el servidor: un "true" de texto no cuenta.
export function reservasActivas(at) { return !!at && at.intro_reservas_activo === true; }

export function textoBotonReserva(at) {
  return String(at?.intro_reservas_texto || '').replace(/\s+/g, ' ').trim().slice(0, TEXTO_MAX) || RESERVA_TEXTO_POR_DEFECTO;
}

export function botonReservaIntro(at) {
  if (!reservasActivas(at)) return '';
  return `<button class="intro-vmenus__reserva" type="button" data-reservar>${esc(textoBotonReserva(at))}</button>`;
}

// 'YYYY-MM-DD' de hoy en el reloj del restaurante, no en el del aparato: un
// comensal de viaje, o con el reloj mal, vería un «hoy» distinto.
export function hoyEn(zona, ahora = new Date()) {
  const dia = z => ahora.toLocaleDateString('en-CA', { timeZone: z });
  try { return dia(zona || ZONA_POR_DEFECTO); } catch { return dia(ZONA_POR_DEFECTO); }
}

export function sumarDias(fecha, dias) {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// Valida lo que escribió el comensal. Devuelve el primer error en palabras
// suyas, o null si todo está bien.
export function errorDeReserva(d, hoy) {
  if (!String(d.nombre || '').trim()) return 'Escribe tu nombre';
  const digitos = String(d.celular || '').replace(/\D/g, '');
  if (digitos.length < 7 || digitos.length > 15) return 'Escribe un celular válido';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha || '')) return 'Elige la fecha';
  if (d.fecha < hoy) return 'Esa fecha ya pasó';
  if (d.fecha > sumarDias(hoy, DIAS_ADELANTE_MAX)) return `Solo se reserva con hasta ${DIAS_ADELANTE_MAX} días de anticipación`;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(d.hora || '')) return 'Elige la hora';
  const p = Number(d.personas);
  if (!Number.isInteger(p) || p < 1) return 'Indica para cuántas personas';
  if (p > PERSONAS_MAX) return `Para grupos de más de ${PERSONAS_MAX} personas, escríbenos directamente`;
  return null;
}

// Lo que viaja al panel. `sitio_web` es el campo trampa: está en el formulario
// pero escondido, así que una persona lo deja vacío y un robot que rellena todo
// no. `abierto_en` es cuándo se abrió el formulario: enviarlo en menos de unos
// segundos tampoco lo hace una persona.
export function cuerpoDeReserva(restauranteId, d, { trampa = '', abiertoEn = Date.now() } = {}) {
  return {
    restaurante_id: restauranteId,
    nombre: String(d.nombre).trim(), celular: String(d.celular).trim(),
    fecha: d.fecha, hora: d.hora, personas: Number(d.personas),
    sitio_web: trampa, abierto_en: abiertoEn,
  };
}

// Envía la reserva. Nunca lanza: devuelve { ok: true } o { ok: false, error }
// con un texto que se puede enseñar tal cual.
export async function enviarReserva(apiUrl, cuerpo, fetchFn = globalThis.fetch) {
  try {
    const res = await fetchFn(`${apiUrl}/api/reservas`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
    });
    if (res.ok) return { ok: true };
    // El servidor habla en palabras del comensal (fecha pasada, demasiadas pendientes…).
    const datos = await res.json().catch(() => null);
    return { ok: false, error: (datos && typeof datos.error === 'string' && datos.error) || 'No pudimos registrar tu reserva. Inténtalo de nuevo en un momento.' };
  } catch {
    return { ok: false, error: 'No pudimos conectar. Revisa tu internet e inténtalo de nuevo.' };
  }
}

// El formulario, listo para colgarlo dentro de la tarjeta. Escondido hasta que
// se pulsa el botón (ver los estilos). Los `id` llevan el prefijo introRes para
// no chocar con nada de la carta.
export function formularioReservaIntro(at, hoy) {
  if (!reservasActivas(at)) return '';
  const max = sumarDias(hoy, DIAS_ADELANTE_MAX);
  return `<form class="intro-vmenus__reserva-form" novalidate aria-labelledby="introResTitulo">`
    + `<h2 id="introResTitulo">${esc(RESERVA_TITULO)}</h2>`
    + `<p class="intro-vmenus__reserva-nota">Déjanos tus datos y te escribimos por WhatsApp para confirmarla.</p>`
    + `<label for="introResNombre">Tu nombre</label><input id="introResNombre" name="nombre" type="text" autocomplete="name" maxlength="80" required>`
    + `<label for="introResCelular">Tu celular</label><input id="introResCelular" name="celular" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="300 123 4567" required>`
    + `<div class="intro-vmenus__reserva-fila">`
    + `<div><label for="introResFecha">Fecha</label><input id="introResFecha" name="fecha" type="date" min="${esc(hoy)}" max="${esc(max)}" required></div>`
    + `<div><label for="introResHora">Hora</label><input id="introResHora" name="hora" type="time" required></div>`
    + `</div>`
    + `<label for="introResPersonas">Para cuántas personas</label><input id="introResPersonas" name="personas" type="number" inputmode="numeric" min="1" max="${PERSONAS_MAX}" value="2" required>`
    // El campo trampa: fuera de la vista y del teclado, y sin que el navegador lo autocomplete.
    + `<div class="intro-vmenus__reserva-trampa" aria-hidden="true"><label>Sitio web<input name="sitio_web" type="text" tabindex="-1" autocomplete="off"></label></div>`
    + `<p class="intro-vmenus__reserva-error" role="alert" hidden></p>`
    + `<p class="intro-vmenus__reserva-ok" role="status" hidden></p>`
    + `<button class="intro-vmenus__cta intro-vmenus__reserva-enviar" type="submit">Enviar reserva</button>`
    + `<button class="intro-vmenus__reserva-volver" type="button" data-volver>Volver</button>`
    + `</form>`;
}

// Estilos del botón y del formulario. Se añaden a los de la bienvenida. El
// formulario vive dentro de la tarjeta: al pulsar «Reservar», la tarjeta pasa a
// data-vista="reserva" y se esconde todo salvo el logo, el nombre y el
// formulario; «Volver» lo deshace.
export const ESTILOS_RESERVA = `
.intro-vmenus__reserva{display:flex;width:fit-content;max-width:100%;margin:10px auto 0;min-height:48px;align-items:center;justify-content:center;padding:12px 21px;border:1px solid rgba(255,255,255,.75);border-radius:999px;background:rgba(12,12,16,.78);color:#fff;font:800 14px Montserrat,system-ui,sans-serif;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease}
.intro-vmenus__reserva:hover{transform:translateY(-2px);box-shadow:0 10px 20px rgba(0,0,0,.2)}
.intro-vmenus__reserva-form{display:none;text-align:left;margin-top:6px}
.intro-vmenus__card[data-vista="reserva"]>:not(.intro-vmenus__logo):not(h1):not(.intro-vmenus__reserva-form){display:none}
.intro-vmenus__card[data-vista="reserva"]>.intro-vmenus__reserva-form{display:block}
.intro-vmenus__reserva-form h2{margin:8px 0 6px;font:800 19px Montserrat,system-ui,sans-serif;text-align:center}
.intro-vmenus__reserva-nota{margin:0 0 14px;font-size:13px;opacity:.88;text-align:center}
.intro-vmenus__reserva-form label{display:block;margin:12px 0 5px;font:700 13px Montserrat,system-ui,sans-serif}
.intro-vmenus__reserva-form input{box-sizing:border-box;width:100%;min-height:48px;padding:11px 14px;border:1px solid rgba(255,255,255,.55);border-radius:12px;background:rgba(255,255,255,.14);color:#fff;font:600 16px Montserrat,system-ui,sans-serif;color-scheme:dark}
.intro-vmenus__reserva-form input:focus-visible,.intro-vmenus__reserva-form button:focus-visible{outline:3px solid #ffd521;outline-offset:2px}
.intro-vmenus__reserva-form input::placeholder{color:rgba(255,255,255,.55)}
.intro-vmenus__reserva-fila{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}
.intro-vmenus__reserva-trampa{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.intro-vmenus .intro-vmenus__reserva-error{margin:14px 0 0;padding:10px 12px;border-radius:10px;background:rgba(190,30,45,.85);font-size:13px;font-weight:700;text-align:center}
.intro-vmenus .intro-vmenus__reserva-ok{margin:14px 0 0;padding:12px;border-radius:10px;background:rgba(25,135,84,.9);font-size:14px;font-weight:700;text-align:center}
.intro-vmenus .intro-vmenus__reserva-error[hidden],.intro-vmenus .intro-vmenus__reserva-ok[hidden],.intro-vmenus__reserva-enviar[hidden]{display:none}
.intro-vmenus__reserva-enviar{display:flex;width:100%;margin-top:18px;background:#fff;color:#17120b;border-color:#fff}
.intro-vmenus__reserva-volver{display:block;margin:12px auto 0;padding:10px 16px;border:0;background:none;color:#fff;font:700 13px Montserrat,system-ui,sans-serif;text-decoration:underline;cursor:pointer}
@media(max-width:380px){.intro-vmenus__reserva-fila{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){.intro-vmenus__reserva{transition:none!important}}`;

// Conecta el botón, el formulario y «Volver» dentro de la tarjeta ya pintada.
// Solo corre con el DOM real de la carta.
export function montarReservaIntro(raiz, restauranteId, apiUrl, { fetchFn, ahora = () => Date.now() } = {}) {
  const tarjeta = raiz.querySelector('.intro-vmenus__card');
  const boton = raiz.querySelector('[data-reservar]');
  const form = raiz.querySelector('.intro-vmenus__reserva-form');
  if (!tarjeta || !boton || !form) return;
  const aviso = (clase, texto) => {
    const error = form.querySelector('.intro-vmenus__reserva-error'); const ok = form.querySelector('.intro-vmenus__reserva-ok');
    error.hidden = clase !== 'error'; ok.hidden = clase !== 'ok';
    (clase === 'error' ? error : ok).textContent = texto || '';
  };
  let abiertoEn = ahora();
  boton.addEventListener('click', () => {
    abiertoEn = ahora();   // el tiempo mínimo se cuenta desde que ve el formulario
    tarjeta.dataset.vista = 'reserva'; aviso('ninguno'); form.querySelector('#introResNombre')?.focus();
  });
  form.querySelector('[data-volver]').addEventListener('click', () => {
    delete tarjeta.dataset.vista; boton.focus();
    // Tras una reserva enviada el formulario quedó bloqueado: al volver se deja listo
    // para otra (una mesa para otro día, por ejemplo) y sin los datos de la anterior.
    if (form.querySelector('.intro-vmenus__reserva-enviar').hidden) {
      form.querySelectorAll('input').forEach(i => { i.disabled = false; });
      form.reset?.(); form.querySelector('.intro-vmenus__reserva-enviar').hidden = false; aviso('ninguno');
    }
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const val = n => form.elements[n]?.value ?? '';
    const datos = { nombre: val('nombre'), celular: val('celular'), fecha: val('fecha'), hora: val('hora'), personas: val('personas') };
    const zona = raiz.dataset.zona || '';
    const error = errorDeReserva(datos, hoyEn(zona));
    if (error) { aviso('error', error); return; }
    const enviar = form.querySelector('.intro-vmenus__reserva-enviar');
    enviar.disabled = true; aviso('ninguno');
    const r = await enviarReserva(apiUrl, cuerpoDeReserva(restauranteId, datos, { trampa: val('sitio_web'), abiertoEn }), fetchFn);
    enviar.disabled = false;
    if (!r.ok) { aviso('error', r.error); return; }
    aviso('ok', `¡Listo, ${datos.nombre.trim()}! Recibimos tu solicitud. El restaurante te escribirá por WhatsApp para confirmarla.`);
    enviar.hidden = true; form.querySelectorAll('input').forEach(i => { i.disabled = true; });
  });
}
