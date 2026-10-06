// Pantalla opcional que se muestra antes de la carta. Todo se pinta con nodos
// y texto escapado: los atributos del restaurante viajan a un navegador público.
import { esc, escUrl } from './html.js';
import { soloDigitos, enlacesSociales } from './menu.js';
import { whatsappParaMostrar, mapaDelNegocio, resenaDelNegocio, textoHorarioAtencion, correoDelNegocio, direccionDelNegocio } from './negocio.js';
import { botonReservaIntro, formularioReservaIntro, montarReservaIntro, hoyEn, ESTILOS_RESERVA } from './reservas-intro.js';
import { rutaDeSede, recordarEleccionDeSede } from './sedes.js';

const TIPOS = ['nombre', 'eslogan', 'adicional', 'cta', 'direccion'];
const MAPAS = new Set(['mapa', 'boton', 'ambos']);
const MAPA_API_URL = 'https://adminvmenus.verificame.click';
const COLOR_HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const FUENTE_SEGURA = /^[\p{L}\p{N} .-]{0,60}$/u;
function colorSeguro(valor, defecto) { return COLOR_HEX.test(String(valor || '')) ? valor : defecto; }

export function introActiva(restaurante) { return !!restaurante?.atributos?.intro_activo; }

// ── «USAR LOS COLORES Y LA TIPOGRAFÍA DE LA CARTA» ───────────
// Un interruptor (atributos.intro_estilo_carta, Ajustes → Bienvenida) para quien no quiere afinar cada
// color: la bienvenida toma de la carta el fondo (color, imagen o degradado), la tarjeta, el borde, el
// texto y las fuentes, y los campos de color manuales dejan de aplicarse (se conservan guardados: apagarlo
// los devuelve). Es OPT-IN: ausente es apagado, para no cambiar la bienvenida de los que ya la afinaron.
// Los tamaños, pesos y alineación de cada texto siguen siendo del restaurante: eso no es color.
export function introHeredaCarta(at) { return at?.intro_estilo_carta === true; }

// Lo que cambia respecto a la bienvenida de siempre. Todo con !important porque los colores y fuentes
// manuales viajan en atributos style de cada elemento. Los colores salen de las variables que
// core/loader.js ya puso para la carta (--card, --card-hover, --border, --text, --font-*).
const ESTILOS_CARTA = `
.intro-vmenus--carta .intro-vmenus__card{color:var(--text)!important;backdrop-filter:none}
.intro-vmenus--carta :is(h1,p,a,button,span,label,input,textarea,select){font-family:var(--font-cuerpo,system-ui,sans-serif)!important}
.intro-vmenus--carta h1{font-family:var(--font-titulo,var(--font-cuerpo,system-ui,sans-serif))!important}
.intro-vmenus--carta :is(h1,p,.intro-vmenus__correo,.intro-vmenus__sedes-titulo){color:var(--text)!important}
.intro-vmenus--carta .intro-vmenus__cta,.intro-vmenus--carta .intro-vmenus__reserva-enviar{background:var(--text)!important;color:var(--intro-carta-fondo,#0a0a0f)!important;border-color:var(--text)!important}
.intro-vmenus--carta :is(.intro-vmenus__resena,.intro-vmenus__mapa-link,.intro-vmenus__sede,.intro-vmenus__reserva,.intro-vmenus__reserva-volver){background:var(--card-hover,var(--card))!important;color:var(--text)!important;border-color:var(--border)!important}
.intro-vmenus--carta .intro-vmenus__social a{background:var(--card-hover,var(--card))!important;color:var(--text)!important;border-color:var(--border)!important}
.intro-vmenus--carta .intro-vmenus__logo{box-shadow:0 0 0 2px var(--border)}`;

// Conserva esta fábrica pequeña para las pruebas y para integraciones que
// todavía consumen el contrato original de la intro.
export function construirIntro(restaurante) {
  const at = restaurante.atributos || {}; const host = document.createElement('div'); host.id = 'introPantalla'; host.className = 'intro-pantalla';
  const contenido = document.createElement('div'); contenido.className = 'intro-contenido';
  if (restaurante.logo_url) { const logo = document.createElement('img'); logo.className = 'intro-logo'; logo.src = escUrl(restaurante.logo_url); logo.alt = ''; contenido.appendChild(logo); }
  const nombre = document.createElement('h1'); nombre.className = 'intro-nombre'; nombre.textContent = restaurante.nombre || ''; contenido.appendChild(nombre);
  if (at.intro_eslogan) { const eslogan = document.createElement('p'); eslogan.className = 'intro-eslogan'; eslogan.textContent = at.intro_eslogan; contenido.appendChild(eslogan); }
  const boton = document.createElement('button'); boton.type = 'button'; boton.className = 'intro-boton'; boton.textContent = 'Ver carta'; boton.onclick = () => host.remove(); contenido.appendChild(boton);
  const numero = whatsappParaMostrar(at); if (numero) { const wa = document.createElement('a'); wa.className = 'intro-contacto intro-whatsapp'; wa.href = `https://wa.me/${numero}`; wa.target = '_blank'; wa.rel = 'noopener'; wa.textContent = `📞 ${numero}`; contenido.appendChild(wa); }
  if (at.direccion) { const direccion = document.createElement('p'); direccion.className = 'intro-contacto intro-direccion'; direccion.textContent = at.direccion; contenido.appendChild(direccion); }
  const redes = at.social_bar ? enlacesSociales(at) : []; if (redes.length) { const bar = document.createElement('div'); bar.className = 'intro-redes'; bar.innerHTML = redes.map(r => `<a href="${escUrl(r.href)}" target="_blank" rel="noopener" aria-label="${esc(r.label)}">${r.icon}</a>`).join(''); contenido.appendChild(bar); }
  host.appendChild(contenido); return host;
}

function texto(at, tipo, defecto = '') {
  const valores = { nombre: at.intro_nombre, eslogan: at.intro_eslogan, adicional: at.intro_texto_adicional, cta: at.intro_cta, direccion: at.direccion };
  return String(valores[tipo] || defecto).trim();
}
function estiloTexto(at, tipo, defecto) {
  const t = at.intro_textos?.[tipo] || {}; const alineacion = { izquierda: 'left', centro: 'center', derecha: 'right' }[t.alineacion] || 'center';
  const tamano = Number(t.tamano); const peso = Number(t.peso);
  const fuente = FUENTE_SEGURA.test(String(t.fuente || '')) ? t.fuente : '';
  const base = `font-family:${fuente ? `'${esc(fuente)}',` : ''}Montserrat,system-ui,sans-serif;font-size:${Number.isFinite(tamano) && tamano >= 12 && tamano <= 64 ? tamano : ''}px;font-weight:${[400,500,600,700,800].includes(peso) ? peso : ''};text-align:${alineacion};`;
  if (tipo === 'cta') return `background:${colorSeguro(t.color, '#ffffff')};color:${colorSeguro(t.color_texto, '#15100b')};${base}`;
  return `color:${colorSeguro(t.color, defecto)};${base}`;
}
function iconoInstagram() { return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="2.5" y="2.5" width="19" height="19" rx="5"/><circle cx="12" cy="12" r="4.5"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor"/></svg>`; }
function iconoFacebook() { return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M13.6 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.6-1.5H17V3.9c-.4-.1-1.3-.2-2.4-.2-2.4 0-4 1.4-4 4.1V10H8v3h2.6v8h3Z"/></svg>`; }
function iconoTikTok() { return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V9.05a8.16 8.16 0 0 0 4.77 1.52V7.14a4.85 4.85 0 0 1-1-.45z"/></svg>`; }

// Los botones de redes de la bienvenida. Cada uno necesita dos cosas: que el
// restaurante lo encienda en la bienvenida (intro_social_*) y que tenga su
// enlace guardado en Ajustes (social_*). TikTok se añadió el 01/10/2026: antes
// solo había Instagram y Facebook, aunque el enlace de TikTok ya existía.
// Está aparte de mostrarIntro para poder probarlo: ahí se arma todo con una
// sola cadena que las pruebas, con su DOM de mentira, no recorren.
export function redesIntro(at, socialCss) {
  const redes = [];
  if (at.intro_social_instagram && at.social_instagram) redes.push(`<a style="${socialCss}" href="${escUrl(at.social_instagram)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir Instagram">${iconoInstagram()}</a>`);
  if (at.intro_social_facebook && at.social_facebook) redes.push(`<a style="${socialCss}" href="${escUrl(at.social_facebook)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir Facebook">${iconoFacebook()}</a>`);
  if (at.intro_social_tiktok && at.social_tiktok) redes.push(`<a style="${socialCss}" href="${escUrl(at.social_tiktok)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir TikTok">${iconoTikTok()}</a>`);
  return redes;
}

// «Califícanos en Google» (01/10/2026): lleva al comensal a dejar su reseña en
// Google, el enlace que da Google Business Profile. Solo se pinta si está
// encendido Y el enlace es un http(s) de verdad: un botón que no lleva a ningún
// lado es peor que no tenerlo. El texto es del restaurante, con tope de 60.
export const RESENA_TEXTO_POR_DEFECTO = 'Califícanos en Google';
export function botonResenaIntro(at) {
  if (!at || !at.intro_resena_activo) return '';
  // El enlace es del negocio (Ajustes → Datos del negocio); el interruptor, de la bienvenida.
  const url = resenaDelNegocio(at);
  if (!/^https?:\/\//i.test(url)) return '';
  const texto = String(at.intro_resena_texto || '').trim().slice(0, 60) || RESENA_TEXTO_POR_DEFECTO;
  return `<a class="intro-vmenus__resena" href="${escUrl(url)}" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">★</span> ${esc(texto)}</a>`;
}
function enlaceMapa(url) { try { const u = new URL(url); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } }
function consultaMapa(url) {
  const enlace = enlaceMapa(url); if (!enlace) return '';
  const u = new URL(enlace); const directa = u.searchParams.get('q') || u.searchParams.get('query') || u.searchParams.get('destination') || u.searchParams.get('center') || u.searchParams.get('ll');
  if (directa) return directa;
  const coordenadas = u.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (coordenadas) return `${coordenadas[1]},${coordenadas[2]}`;
  const lugar = u.pathname.match(/\/maps\/(?:place|search)\/([^/?]+)/i);
  return lugar ? decodeURIComponent(lugar[1].replace(/\+/g, ' ')) : '';
}
function fuenteMapa(url) {
  const enlace = enlaceMapa(url); if (!enlace) return ''; const u = new URL(enlace);
  if (/google\.[a-z.]+$/i.test(u.hostname) && /\/maps\/embed/i.test(u.pathname)) return enlace;
  if (/(^|\.)maps\.app\.goo\.gl$/i.test(u.hostname)) return '';
  const consulta = consultaMapa(enlace); return consulta ? `https://maps.google.com/maps?output=embed&q=${encodeURIComponent(consulta)}` : '';
}
async function resolverFuenteMapa(url) {
  if (fuenteMapa(url)) return fuenteMapa(url);
  try {
    const respuesta = await fetch(`${MAPA_API_URL}/api/mapa-embed?url=${encodeURIComponent(url)}`);
    if (!respuesta.ok) return '';
    const datos = await respuesta.json(); return fuenteMapa(datos.url);
  } catch { return ''; }
}
function crearMiniMapa(src, nombre) {
  const iframe = document.createElement('iframe'); iframe.className = 'intro-vmenus__mapa'; iframe.title = `Ubicación de ${nombre}`; iframe.loading = 'lazy'; iframe.referrerPolicy = 'no-referrer-when-downgrade'; iframe.src = src; return iframe;
}
function estiloBotonMapa(at) {
  const fuente = FUENTE_SEGURA.test(String(at.intro_mapa_boton_fuente || '')) ? at.intro_mapa_boton_fuente : '';
  return `background:${colorSeguro(at.intro_mapa_boton_fondo, '#17120b')};color:${colorSeguro(at.intro_mapa_boton_color, '#ffffff')};font-family:${fuente ? `'${esc(fuente)}',` : ''}Montserrat,system-ui,sans-serif;`;
}

function insertarEstilos() {
  if (document.getElementById('introVmenusStyles')) return;
  const style = document.createElement('style'); style.id = 'introVmenusStyles'; style.textContent = `
    .intro-vmenus{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;overflow:auto;background:var(--intro-fondo,#101827) center/var(--intro-ajuste,cover) no-repeat;padding:24px;isolation:isolate}.intro-vmenus::before{content:'';position:absolute;inset:0;background:var(--intro-overlay,#0a0a0f);opacity:var(--intro-opacidad,.55);z-index:0}.intro-vmenus__card{position:relative;z-index:1;width:min(100%,620px);padding:clamp(28px,6vw,56px);border:var(--intro-tarjeta-borde-grosor,1px) solid var(--intro-tarjeta-borde,rgba(255,255,255,.35));border-radius:28px;background:var(--intro-tarjeta-fondo,rgba(15,15,20,.28));box-shadow:0 24px 70px rgba(0,0,0,.4);backdrop-filter:blur(10px);color:#fff;text-align:center}.intro-vmenus__logo{width:82px;height:82px;object-fit:contain;border-radius:50%;background:rgba(255,255,255,.92);padding:5px;margin:0 auto 16px;display:block}.intro-vmenus__logo--vacio{display:grid;place-items:center;font:800 20px Montserrat,system-ui,sans-serif}.intro-vmenus h1,.intro-vmenus p{margin:0 0 12px}.intro-vmenus__cta,.intro-vmenus__resena,.intro-vmenus__mapa-link{display:inline-flex;align-items:center;justify-content:center;min-height:48px;margin-top:12px;padding:12px 21px;border:1px solid rgba(255,255,255,.75);border-radius:999px;background:rgba(12,12,16,.78);font:800 14px Montserrat,system-ui,sans-serif;text-decoration:none;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease}.intro-vmenus__cta:hover,.intro-vmenus__resena:hover,.intro-vmenus__mapa-link:hover{transform:translateY(-2px);box-shadow:0 10px 20px rgba(0,0,0,.2)}.intro-vmenus__social{display:flex;justify-content:center;gap:10px;margin-top:18px}.intro-vmenus__social a{display:grid;place-items:center;min-width:44px;min-height:44px;border:1px solid;border-radius:999px;text-decoration:none;transition:transform .18s ease,filter .18s ease}.intro-vmenus__social a:hover{transform:translateY(-2px);filter:brightness(1.1)}.intro-vmenus__social svg{width:22px;height:22px}.intro-vmenus__mapa{display:block;width:100%;height:170px;border:0;border-radius:16px;margin-top:20px;background:rgba(255,255,255,.12)}.intro-vmenus__direccion{margin-top:14px!important;font-size:13px;opacity:.88}.intro-vmenus__horario{margin:6px 0 0!important;font-size:13px;opacity:.88}.intro-vmenus__correo{display:block;margin-top:6px;font-size:13px;opacity:.88;color:inherit;text-decoration:underline;text-underline-offset:3px}@media(max-width:520px){.intro-vmenus{padding:14px}.intro-vmenus__card{padding:30px 20px;border-radius:22px}.intro-vmenus__mapa{height:145px}}@media(prefers-reduced-motion:reduce){.intro-vmenus__cta,.intro-vmenus__mapa-link,.intro-vmenus__social a{transition:none!important}}`;
  style.textContent += '.intro-vmenus__resena{display:flex;width:fit-content;max-width:100%;margin:10px auto 0;gap:8px;color:#fff;background:rgba(255,255,255,.1)}.intro-vmenus__resena span{color:#ffd521;font-size:1.15em;line-height:1}';
  style.textContent += '.intro-vmenus__logo{position:relative;z-index:2;isolation:isolate;background:#fff;box-shadow:0 3px 12px rgba(0,0,0,.22);opacity:1!important;filter:none!important;mix-blend-mode:normal!important}';
  style.textContent += '.intro-vmenus__sedes-titulo{margin:6px 0 4px!important;font:700 15px Montserrat,system-ui,sans-serif;opacity:.9}.intro-vmenus__sedes{display:grid;gap:10px;margin-top:10px}.intro-vmenus__sede{display:block;padding:14px 18px;border:1px solid rgba(255,255,255,.75);border-radius:18px;background:rgba(12,12,16,.78);color:#fff;text-align:left;text-decoration:none;font:800 15px Montserrat,system-ui,sans-serif;transition:transform .18s ease,box-shadow .18s ease}.intro-vmenus__sede:hover,.intro-vmenus__sede:focus-visible{transform:translateY(-2px);box-shadow:0 10px 20px rgba(0,0,0,.2)}.intro-vmenus__sede-nombre{display:block}.intro-vmenus__sede-direccion{display:block;margin-top:3px;font-weight:500;font-size:12px;opacity:.8}@media(prefers-reduced-motion:reduce){.intro-vmenus__sede{transition:none!important}}';
  style.textContent += ESTILOS_RESERVA;
  style.textContent += ESTILOS_CARTA;
  document.head.appendChild(style);
}

// El fondo se COPIA de lo que la carta ya pintó en el <body> (applyStyles corre antes que la bienvenida):
// color, imagen o degradado, sea cual sea la intensidad elegida. Así no se reimplementa esa lógica aquí.
export function aplicarEstiloDeLaCarta(raiz, cuerpo = document.body) {
  const cs = getComputedStyle(cuerpo);
  raiz.classList.add('intro-vmenus--carta');
  raiz.style.backgroundColor = cs.backgroundColor;
  raiz.style.backgroundImage = cs.backgroundImage;
  raiz.style.backgroundSize = cs.backgroundSize === 'auto' ? 'cover' : cs.backgroundSize;
  raiz.style.backgroundPosition = cs.backgroundPosition;
  raiz.style.backgroundRepeat = cs.backgroundRepeat;
  raiz.style.setProperty('--intro-opacidad', 0);
  raiz.style.setProperty('--intro-tarjeta-fondo', 'var(--card)');
  raiz.style.setProperty('--intro-tarjeta-borde', 'var(--border)');
  raiz.style.setProperty('--intro-tarjeta-borde-grosor', '1px');
  raiz.style.setProperty('--intro-carta-fondo', cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : '#0a0a0f');
}

// ── EL RECUADRO DE LA BIENVENIDA: COLOR Y BORDE ──────────────
// El panel deja elegir el fondo del recuadro, el color de su borde y lo grueso
// que es (intro_tarjeta_fondo, intro_tarjeta_borde, intro_tarjeta_borde_grosor;
// el servidor las valida). La carta no las leía: un restaurante las guardaba y
// la bienvenida se veía igual. Un commit que lo arreglaba se subió a una rama
// DESPUÉS de mergear su pull request y no llegó a main.
//
// Solo se ponen las variables de lo que el restaurante guardó, y el CSS lleva el
// aspecto de siempre como respaldo: quien nunca tocó esto no ve ningún cambio.
// Poner siempre un valor por defecto volvía sólidas las tarjetas de todos.
export function variablesTarjeta(at) {
  const v = {};
  if (COLOR_HEX.test(String(at?.intro_tarjeta_fondo || ''))) v['--intro-tarjeta-fondo'] = at.intro_tarjeta_fondo;
  if (COLOR_HEX.test(String(at?.intro_tarjeta_borde || ''))) v['--intro-tarjeta-borde'] = at.intro_tarjeta_borde;
  const g = at?.intro_tarjeta_borde_grosor;
  // Number('') y Number(null) dan 0, y 0 es un grosor válido: sin esta guarda un
  // campo vacío se leería como «sin borde».
  if (g !== undefined && g !== null && g !== '' && Number.isFinite(Number(g)))
    v['--intro-tarjeta-borde-grosor'] = `${Math.max(0, Math.min(5, Number(g)))}px`;
  return v;
}

// ── ELEGIR SEDE DENTRO DE LA BIENVENIDA ───────────────────────
// Un restaurante con varias sedes que se abre por su dirección general no tiene
// una carta que enseñar todavía (los precios dependen de la sede): en lugar del
// botón «Ver carta», la tarjeta ofrece un botón por sede. HTML ya escapado.
// Cada sede lleva el nombre y, si la tiene, su dirección; el enlace conserva la
// forma de URL con la que entró el visitante (rutaDeSede).
export function htmlSedesIntro(restaurante, sedes, host, estiloCta = '') {
  const botones = sedes.map(sede => {
    const direccion = direccionDelNegocio(sede.atributos);
    return `<a class="intro-vmenus__sede" style="${estiloCta}" data-sede="${esc(sede.slug)}" href="${escUrl(rutaDeSede(host, restaurante.slug, sede.slug))}"><span class="intro-vmenus__sede-nombre">${esc(sede.nombre)}</span>${direccion ? `<span class="intro-vmenus__sede-direccion">${esc(direccion)}</span>` : ''}</a>`;
  }).join('');
  return `<p class="intro-vmenus__sedes-titulo">¿En qué sede estás?</p><div class="intro-vmenus__sedes">${botones}</div>`;
}

export function mostrarIntro(restaurante, opciones = {}) {
  // Los tests y consumidores antiguos montan un DOM mínimo; ahí se conserva
  // la estructura original. El menú real dispone de getElementById.
  if (typeof document.getElementById !== 'function') { document.body.appendChild(construirIntro(restaurante)); return; }
  const at = restaurante?.atributos || {}; if (!at.intro_activo || document.getElementById('introVmenus')) return;
  insertarEstilos(); const fondo = colorSeguro(at.intro_fondo_color, '#111827'); const imagen = at.intro_fondo_url ? `url("${escUrl(at.intro_fondo_url)}")` : 'none';
  const ajuste = ['cover', 'contain', 'center'].includes(at.intro_imagen_ajuste) ? at.intro_imagen_ajuste : 'cover'; const opacidad = Math.max(0, Math.min(100, Number(at.intro_overlay_opacidad ?? 50))) / 100; const overlayActivo = at.intro_overlay_activo !== false;
  // Con sedes por elegir, la tarjeta ofrece las sedes y no deja pasar sin elegir: ni «Ver carta», ni Escape, ni reservas (que todavía no saben de sedes). Tampoco enseña dirección, horario ni mapa: son de cada sede, y los del restaurante a secas confundirían.
  const sedes = Array.isArray(opciones.sedes) && opciones.sedes.length ? opciones.sedes : null;
  const nombre = texto(at, 'nombre', restaurante.nombre); const eslogan = texto(at, 'eslogan'); const adicional = texto(at, 'adicional'); const cta = texto(at, 'cta', 'Ver carta'); const direccion = sedes ? '' : texto(at, 'direccion');
  // El horario y el correo son del negocio (Ajustes → Datos del negocio); cada uno tiene su interruptor en la bienvenida y, ausente, está encendido.
  const horario = sedes || at.intro_horario_activo === false ? '' : textoHorarioAtencion(at.horario_atencion); const correo = at.intro_correo_activo === false ? '' : correoDelNegocio(at); const mapaUrl = !sedes && at.intro_mapa_activo === true ? enlaceMapa(mapaDelNegocio(at)) : ''; const modoMapa = MAPAS.has(at.intro_mapa_modo) ? at.intro_mapa_modo : 'mapa'; const estiloMapa = estiloBotonMapa(at);
  const raiz = document.createElement('section'); raiz.id = 'introVmenus'; raiz.className = 'intro-vmenus'; raiz.setAttribute('aria-label', `Bienvenida a ${nombre}`); raiz.style.setProperty('--intro-fondo', fondo); for (const [k, val] of Object.entries(variablesTarjeta(at))) raiz.style.setProperty(k, val); raiz.style.backgroundImage = imagen; raiz.style.setProperty('--intro-ajuste', ajuste === 'center' ? 'auto' : ajuste); raiz.style.setProperty('--intro-overlay', colorSeguro(at.intro_overlay_color, '#0a0a0f')); raiz.style.setProperty('--intro-opacidad', overlayActivo ? opacidad : 0);
  if (introHeredaCarta(at)) aplicarEstiloDeLaCarta(raiz);
  const logo = restaurante.logo_url ? `<img class="intro-vmenus__logo" src="${escUrl(restaurante.logo_url)}" alt="Logo de ${esc(nombre)}">` : `<div class="intro-vmenus__logo intro-vmenus__logo--vacio" aria-hidden="true">${esc(nombre.slice(0, 2).toUpperCase())}</div>`;
  const redes = []; const estilo = ['circular', 'redondeado', 'pildora'].includes(at.intro_social_estilo) ? at.intro_social_estilo : 'circular'; const tamano = Math.max(36, Math.min(72, Number(at.intro_social_tamano || 48))); const socialCss = `color:${colorSeguro(at.intro_social_icono_color, '#ffffff')};background:${colorSeguro(at.intro_social_fondo, '#ef7a00')};border-color:${colorSeguro(at.intro_social_borde, '#ffffff')};width:${tamano}px;height:${tamano}px;border-radius:${estilo === 'redondeado' ? '12px' : '999px'};`;
  redes.push(...redesIntro(at, socialCss));
  const fuenteMiniMapa = fuenteMapa(mapaUrl); raiz.innerHTML = `<div class="intro-vmenus__card">${logo}<h1 style="${estiloTexto(at, 'nombre', '#ffffff')}">${esc(nombre)}</h1>${eslogan ? `<p style="${estiloTexto(at, 'eslogan', '#ffffff')}">${esc(eslogan)}</p>` : ''}${adicional ? `<p style="${estiloTexto(at, 'adicional', '#ffffff')}">${esc(adicional)}</p>` : ''}${sedes ? htmlSedesIntro(restaurante, sedes, opciones.host ?? window.location.hostname, estiloTexto(at, 'cta', '#ffffff')) : `<button class="intro-vmenus__cta" type="button" style="${estiloTexto(at, 'cta', '#ffffff')}">${esc(cta)}</button>${botonReservaIntro(at)}`}${botonResenaIntro(at)}${redes.length ? `<div class="intro-vmenus__social">${redes.join('')}</div>` : ''}${direccion ? `<p class="intro-vmenus__direccion" style="${estiloTexto(at, 'direccion', '#ffffff')}">${esc(direccion)}</p>` : ''}${horario ? `<p class="intro-vmenus__horario" style="${estiloTexto(at, 'direccion', '#ffffff')}">${esc(horario)}</p>` : ''}${correo ? `<a class="intro-vmenus__correo" style="${estiloTexto(at, 'direccion', '#ffffff')}" href="${escUrl('mailto:' + correo)}">✉ ${esc(correo)}</a>` : ''}${mapaUrl && fuenteMiniMapa && modoMapa !== 'boton' ? `<iframe class="intro-vmenus__mapa" title="Ubicación de ${esc(nombre)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${escUrl(fuenteMiniMapa)}"></iframe>` : ''}${mapaUrl && modoMapa !== 'mapa' ? `<a class="intro-vmenus__mapa-link" style="${estiloMapa}" href="${escUrl(mapaUrl)}" target="_blank" rel="noopener noreferrer">Ver ubicación</a>` : ''}${sedes ? '' : formularioReservaIntro(at, hoyEn(at.zona_horaria))}</div>`;
  // Reservas (01/10/2026): la zona del restaurante decide qué es «hoy» en el formulario.
  raiz.dataset.zona = at.zona_horaria || '';
  // En la bienvenida de una sede la reserva es de ESA sede (en la de elegir sede no hay formulario).
  montarReservaIntro(raiz, restaurante.id, MAPA_API_URL, { sedeId: restaurante.sede?.id });
  if (mapaUrl && !fuenteMiniMapa && modoMapa !== 'boton') resolverFuenteMapa(mapaUrl).then(fuente => {
    if (!fuente || !raiz.isConnected) return;
    const iframe = crearMiniMapa(fuente, nombre); const botonMapa = raiz.querySelector('.intro-vmenus__mapa-link');
    if (botonMapa) botonMapa.before(iframe); else raiz.querySelector('.intro-vmenus__card')?.appendChild(iframe);
  });
  if (sedes) {
    // Se deja la nota ANTES de que el enlace navegue: la carta de la sede la lee para no repetir la bienvenida.
    raiz.querySelectorAll('.intro-vmenus__sede').forEach(a => a.addEventListener('click', () => recordarEleccionDeSede(restaurante.slug, a.dataset.sede)));
  } else {
    const cerrar = () => { raiz.remove(); document.body.style.overflow = ''; }; raiz.querySelector('.intro-vmenus__cta').addEventListener('click', cerrar); document.addEventListener('keydown', function escape(e) { if (e.key === 'Escape') { cerrar(); document.removeEventListener('keydown', escape); } });
  }
  document.body.appendChild(raiz); document.body.style.overflow = 'hidden';
}
