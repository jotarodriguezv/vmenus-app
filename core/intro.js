// Pantalla opcional que se muestra antes de la carta. Todo se pinta con nodos
// y texto escapado: los atributos del restaurante viajan a un navegador público.
import { esc, escUrl } from './html.js';
import { soloDigitos, enlacesSociales } from './menu.js';

const TIPOS = ['nombre', 'eslogan', 'adicional', 'cta'];
const MAPAS = new Set(['mapa', 'boton', 'ambos']);
const COLOR_HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const FUENTE_SEGURA = /^[\p{L}\p{N} .-]{0,60}$/u;
function colorSeguro(valor, defecto) { return COLOR_HEX.test(String(valor || '')) ? valor : defecto; }

export function introActiva(restaurante) { return !!restaurante?.atributos?.intro_activo; }

// Conserva esta fábrica pequeña para las pruebas y para integraciones que
// todavía consumen el contrato original de la intro.
export function construirIntro(restaurante) {
  const at = restaurante.atributos || {}; const host = document.createElement('div'); host.id = 'introPantalla'; host.className = 'intro-pantalla';
  const contenido = document.createElement('div'); contenido.className = 'intro-contenido';
  if (restaurante.logo_url) { const logo = document.createElement('img'); logo.className = 'intro-logo'; logo.src = escUrl(restaurante.logo_url); logo.alt = ''; contenido.appendChild(logo); }
  const nombre = document.createElement('h1'); nombre.className = 'intro-nombre'; nombre.textContent = restaurante.nombre || ''; contenido.appendChild(nombre);
  if (at.intro_eslogan) { const eslogan = document.createElement('p'); eslogan.className = 'intro-eslogan'; eslogan.textContent = at.intro_eslogan; contenido.appendChild(eslogan); }
  const boton = document.createElement('button'); boton.type = 'button'; boton.className = 'intro-boton'; boton.textContent = 'Ver carta'; boton.onclick = () => host.remove(); contenido.appendChild(boton);
  const numero = soloDigitos(at.social_whatsapp); if (numero) { const wa = document.createElement('a'); wa.className = 'intro-contacto intro-whatsapp'; wa.href = `https://wa.me/${numero}`; wa.target = '_blank'; wa.rel = 'noopener'; wa.textContent = `📞 ${esc(at.social_whatsapp)}`; contenido.appendChild(wa); }
  if (at.direccion) { const direccion = document.createElement('p'); direccion.className = 'intro-contacto intro-direccion'; direccion.textContent = at.direccion; contenido.appendChild(direccion); }
  const redes = at.social_bar ? enlacesSociales(at) : []; if (redes.length) { const bar = document.createElement('div'); bar.className = 'intro-redes'; bar.innerHTML = redes.map(r => `<a href="${escUrl(r.href)}" target="_blank" rel="noopener" aria-label="${esc(r.label)}">${r.icon}</a>`).join(''); contenido.appendChild(bar); }
  host.appendChild(contenido); return host;
}

function texto(at, tipo, defecto = '') {
  const valores = { nombre: at.intro_nombre, eslogan: at.intro_eslogan, adicional: at.intro_texto_adicional, cta: at.intro_cta };
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
function enlaceMapa(url) { try { const u = new URL(url); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } }
function fuenteMapa(url) { const enlace = enlaceMapa(url); if (!enlace) return ''; const u = new URL(enlace); if (/google\.[a-z.]+$/i.test(u.hostname) && /\/maps\/embed/i.test(u.pathname)) return enlace; const q = u.searchParams.get('q') || u.searchParams.get('query') || enlace; return `https://www.google.com/maps?output=embed&q=${encodeURIComponent(q)}`; }

function insertarEstilos() {
  if (document.getElementById('introVmenusStyles')) return;
  const style = document.createElement('style'); style.id = 'introVmenusStyles'; style.textContent = `
    .intro-vmenus{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;overflow:auto;background:var(--intro-fondo,#101827) center/var(--intro-ajuste,cover) no-repeat;padding:24px;isolation:isolate}.intro-vmenus::before{content:'';position:absolute;inset:0;background:var(--intro-overlay,#0a0a0f);opacity:var(--intro-opacidad,.55);z-index:0}.intro-vmenus__card{position:relative;z-index:1;width:min(100%,620px);padding:clamp(28px,6vw,56px);border:1px solid rgba(255,255,255,.35);border-radius:28px;background:rgba(15,15,20,.28);box-shadow:0 24px 70px rgba(0,0,0,.4);backdrop-filter:blur(10px);color:#fff;text-align:center}.intro-vmenus__logo{width:82px;height:82px;object-fit:contain;border-radius:50%;background:rgba(255,255,255,.92);padding:5px;margin:0 auto 16px;display:block}.intro-vmenus__logo--vacio{display:grid;place-items:center;font:800 20px Montserrat,system-ui,sans-serif}.intro-vmenus h1,.intro-vmenus p{margin:0 0 12px}.intro-vmenus__cta,.intro-vmenus__mapa-link{display:inline-flex;align-items:center;justify-content:center;min-height:48px;margin-top:12px;padding:12px 21px;border:1px solid rgba(255,255,255,.75);border-radius:999px;background:rgba(12,12,16,.78);font:800 14px Montserrat,system-ui,sans-serif;text-decoration:none;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease}.intro-vmenus__cta:hover,.intro-vmenus__mapa-link:hover{transform:translateY(-2px);box-shadow:0 10px 20px rgba(0,0,0,.2)}.intro-vmenus__social{display:flex;justify-content:center;gap:10px;margin-top:18px}.intro-vmenus__social a{display:grid;place-items:center;min-width:44px;min-height:44px;border:1px solid;border-radius:999px;text-decoration:none;transition:transform .18s ease,filter .18s ease}.intro-vmenus__social a:hover{transform:translateY(-2px);filter:brightness(1.1)}.intro-vmenus__social svg{width:22px;height:22px}.intro-vmenus__mapa{display:block;width:100%;height:170px;border:0;border-radius:16px;margin-top:20px;background:rgba(255,255,255,.12)}.intro-vmenus__direccion{margin-top:14px!important;font-size:13px;opacity:.88}@media(max-width:520px){.intro-vmenus{padding:14px}.intro-vmenus__card{padding:30px 20px;border-radius:22px}.intro-vmenus__mapa{height:145px}}@media(prefers-reduced-motion:reduce){.intro-vmenus__cta,.intro-vmenus__mapa-link,.intro-vmenus__social a{transition:none!important}}`;
  style.textContent += '.intro-vmenus__logo{position:relative;z-index:2;isolation:isolate;background:#fff;box-shadow:0 3px 12px rgba(0,0,0,.22);opacity:1!important;filter:none!important;mix-blend-mode:normal!important}';
  document.head.appendChild(style);
}

export function mostrarIntro(restaurante) {
  // Los tests y consumidores antiguos montan un DOM mínimo; ahí se conserva
  // la estructura original. El menú real dispone de getElementById.
  if (typeof document.getElementById !== 'function') { document.body.appendChild(construirIntro(restaurante)); return; }
  const at = restaurante?.atributos || {}; if (!at.intro_activo || document.getElementById('introVmenus')) return;
  insertarEstilos(); const fondo = colorSeguro(at.intro_fondo_color, '#111827'); const imagen = at.intro_fondo_url ? `url("${escUrl(at.intro_fondo_url)}")` : 'none';
  const ajuste = ['cover', 'contain', 'center'].includes(at.intro_imagen_ajuste) ? at.intro_imagen_ajuste : 'cover'; const opacidad = Math.max(0, Math.min(100, Number(at.intro_overlay_opacidad ?? 50))) / 100; const overlayActivo = at.intro_overlay_activo !== false;
  const nombre = texto(at, 'nombre', restaurante.nombre); const eslogan = texto(at, 'eslogan'); const adicional = texto(at, 'adicional'); const cta = texto(at, 'cta', 'Ver carta'); const mapaUrl = enlaceMapa(at.intro_mapa_url); const modoMapa = MAPAS.has(at.intro_mapa_modo) ? at.intro_mapa_modo : 'mapa';
  const raiz = document.createElement('section'); raiz.id = 'introVmenus'; raiz.className = 'intro-vmenus'; raiz.setAttribute('aria-label', `Bienvenida a ${nombre}`); raiz.style.setProperty('--intro-fondo', fondo); raiz.style.backgroundImage = imagen; raiz.style.setProperty('--intro-ajuste', ajuste === 'center' ? 'auto' : ajuste); raiz.style.setProperty('--intro-overlay', colorSeguro(at.intro_overlay_color, '#0a0a0f')); raiz.style.setProperty('--intro-opacidad', overlayActivo ? opacidad : 0);
  const logo = restaurante.logo_url ? `<img class="intro-vmenus__logo" src="${escUrl(restaurante.logo_url)}" alt="Logo de ${esc(nombre)}">` : `<div class="intro-vmenus__logo intro-vmenus__logo--vacio" aria-hidden="true">${esc(nombre.slice(0, 2).toUpperCase())}</div>`;
  const redes = []; const estilo = ['circular', 'redondeado', 'pildora'].includes(at.intro_social_estilo) ? at.intro_social_estilo : 'circular'; const tamano = Math.max(36, Math.min(72, Number(at.intro_social_tamano || 48))); const socialCss = `color:${colorSeguro(at.intro_social_icono_color, '#ffffff')};background:${colorSeguro(at.intro_social_fondo, '#ef7a00')};border-color:${colorSeguro(at.intro_social_borde, '#ffffff')};width:${tamano}px;height:${tamano}px;border-radius:${estilo === 'redondeado' ? '12px' : '999px'};`;
  if (at.intro_social_instagram && at.social_instagram) redes.push(`<a style="${socialCss}" href="${escUrl(at.social_instagram)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir Instagram">${iconoInstagram()}</a>`);
  if (at.intro_social_facebook && at.social_facebook) redes.push(`<a style="${socialCss}" href="${escUrl(at.social_facebook)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir Facebook">${iconoFacebook()}</a>`);
  raiz.innerHTML = `<div class="intro-vmenus__card">${logo}<h1 style="${estiloTexto(at, 'nombre', '#ffffff')}">${esc(nombre)}</h1>${eslogan ? `<p style="${estiloTexto(at, 'eslogan', '#ffffff')}">${esc(eslogan)}</p>` : ''}${adicional ? `<p style="${estiloTexto(at, 'adicional', '#ffffff')}">${esc(adicional)}</p>` : ''}<button class="intro-vmenus__cta" type="button" style="${estiloTexto(at, 'cta', '#ffffff')}">${esc(cta)}</button>${redes.length ? `<div class="intro-vmenus__social">${redes.join('')}</div>` : ''}${at.direccion ? `<p class="intro-vmenus__direccion">${esc(at.direccion)}</p>` : ''}${mapaUrl && modoMapa !== 'boton' ? `<iframe class="intro-vmenus__mapa" title="Ubicación de ${esc(nombre)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${escUrl(fuenteMapa(mapaUrl))}"></iframe>` : ''}${mapaUrl && modoMapa !== 'mapa' ? `<a class="intro-vmenus__mapa-link" href="${escUrl(mapaUrl)}" target="_blank" rel="noopener noreferrer">Ver ubicación</a>` : ''}</div>`;
  const cerrar = () => { raiz.remove(); document.body.style.overflow = ''; }; raiz.querySelector('.intro-vmenus__cta').addEventListener('click', cerrar); document.addEventListener('keydown', function escape(e) { if (e.key === 'Escape') { cerrar(); document.removeEventListener('keydown', escape); } }); document.body.appendChild(raiz); document.body.style.overflow = 'hidden';
}
