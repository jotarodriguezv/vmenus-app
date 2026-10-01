// La pantalla de bienvenida (intro), opcional y apagada por defecto. No es
// "portada" (la imagen de cabecera de Explorar) ni "mostrar_hero" (el mensaje
// de sidebar/topnav): ver la cabecera de core/intro.js.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// El módulo crea elementos con document.createElement y los cuelga de
// document.body. Se monta un DOM mínimo antes de importarlo, como en
// carrusel.test.js: solo lo que intro.js usa de verdad.
function nodoFalso(etiqueta) {
	const hijos = [];
	return {
		etiqueta, hijos, className: '', id: '', src: '', alt: '', href: '',
		target: '', rel: '', textContent: '', innerHTML: '', style: {},
		onclick: null,
		appendChild(h) { hijos.push(h); return h; },
		remove() { this._removido = true; },
	};
}
const cuerpo = { hijos: [], appendChild(h) { this.hijos.push(h); return h; } };
globalThis.document = { createElement: nodoFalso, body: cuerpo };

const { introActiva, construirIntro, mostrarIntro, redesIntro, botonResenaIntro, RESENA_TEXTO_POR_DEFECTO, variablesTarjeta } = await import('../core/intro.js');

const restaurante = (atributos = {}, extra = {}) => ({
	nombre: 'Bonzas', logo_url: '/uploads/logos/bonzas.png', atributos, ...extra,
});

describe('introActiva', () => {
	test('encendida solo con intro_activo: true', () => {
		assert.equal(introActiva(restaurante({ intro_activo: true })), true);
		assert.equal(introActiva(restaurante({ intro_activo: false })), false);
		assert.equal(introActiva(restaurante({})), false, 'ausente es apagada, al revés que buscador o filtros');
	});

	test('sin restaurante no revienta', () => {
		assert.equal(introActiva(null), false);
		assert.equal(introActiva(undefined), false);
	});
});

test('la vista previa de la carta no monta la bienvenida encima del modelo', () => {
	const loader = fs.readFileSync(new URL('../core/loader.js', import.meta.url), 'utf8');
	assert.match(loader, /if \(!previewDraft && introActiva\(restaurante\)\) mostrarIntro\(restaurante\);/);
});

describe('construirIntro · qué se pinta', () => {
	test('el logo se pinta si hay logo_url', () => {
		const host = construirIntro(restaurante({}));
		const logo = host.hijos[0].hijos.find(h => h.className === 'intro-logo');
		assert.ok(logo, 'falta el logo');
		assert.equal(logo.src, '/uploads/logos/bonzas.png');
	});

	test('sin logo_url, no se pinta ningún <img>', () => {
		const host = construirIntro(restaurante({}, { logo_url: null }));
		assert.equal(host.hijos[0].hijos.some(h => h.className === 'intro-logo'), false);
	});

	test('el nombre siempre se pinta, por textContent (no por HTML)', () => {
		const host = construirIntro(restaurante({}, { nombre: '<script>alert(1)</script>' }));
		const nombre = host.hijos[0].hijos.find(h => h.className === 'intro-nombre');
		assert.equal(nombre.textContent, '<script>alert(1)</script>', 'textContent no ejecuta nada, aunque el texto lo parezca');
	});

	test('el eslogan solo se pinta si está configurado', () => {
		const conEslogan = construirIntro(restaurante({ intro_eslogan: 'Hecho con cariño' }));
		const eslogan = conEslogan.hijos[0].hijos.find(h => h.className === 'intro-eslogan');
		assert.equal(eslogan.textContent, 'Hecho con cariño');

		const sinEslogan = construirIntro(restaurante({}));
		assert.equal(sinEslogan.hijos[0].hijos.some(h => h.className === 'intro-eslogan'), false);
	});

	test('el botón "Ver carta" quita la pantalla al pulsarlo', () => {
		const host = construirIntro(restaurante({}));
		const boton = host.hijos[0].hijos.find(h => h.className === 'intro-boton');
		assert.equal(boton.textContent, 'Ver carta');
		assert.equal(host._removido, undefined);
		boton.onclick();
		assert.equal(host._removido, true);
	});

	test('el WhatsApp es el mismo de la barra social (social_whatsapp), sin uno aparte', () => {
		const host = construirIntro(restaurante({ social_whatsapp: '+57 300 123 4567' }));
		const wa = host.hijos[0].hijos.find(h => h.className === 'intro-contacto intro-whatsapp');
		assert.ok(wa, 'falta el enlace de WhatsApp');
		assert.equal(wa.href, 'https://wa.me/573001234567', 'se limpia igual que la barra social');
		assert.equal(wa.target, '_blank');
		assert.equal(wa.rel, 'noopener');
	});

	test('sin social_whatsapp, no hay enlace de contacto', () => {
		const host = construirIntro(restaurante({}));
		assert.equal(host.hijos[0].hijos.some(h => h.className === 'intro-contacto intro-whatsapp'), false);
	});

	test('la dirección solo se pinta si está configurada', () => {
		const host = construirIntro(restaurante({ direccion: 'Cra 7 # 12-34, Bogotá' }));
		const direccion = host.hijos[0].hijos.find(h => h.className === 'intro-contacto intro-direccion');
		assert.equal(direccion.textContent, 'Cra 7 # 12-34, Bogotá');

		const sinDireccion = construirIntro(restaurante({}));
		assert.equal(sinDireccion.hijos[0].hijos.some(h => h.className === 'intro-contacto intro-direccion'), false);
	});

	test('las redes son las mismas que la barra social: nada si está apagada', () => {
		const apagada = construirIntro(restaurante({ social_bar: false, social_instagram: 'https://instagram.com/bonzas' }));
		assert.equal(apagada.hijos[0].hijos.some(h => h.className === 'intro-redes'), false);

		const encendida = construirIntro(restaurante({ social_bar: true, social_instagram: 'https://instagram.com/bonzas' }));
		const redes = encendida.hijos[0].hijos.find(h => h.className === 'intro-redes');
		assert.ok(redes, 'con la barra encendida, sí salen');
		assert.match(redes.innerHTML, /instagram\.com\/bonzas/);
	});

	test('sin ninguna red configurada, tampoco sale la fila (aunque esté encendida)', () => {
		const host = construirIntro(restaurante({ social_bar: true }));
		assert.equal(host.hijos[0].hijos.some(h => h.className === 'intro-redes'), false);
	});
});

describe('mostrarIntro', () => {
	test('cuelga la pantalla de document.body', () => {
		cuerpo.hijos.length = 0;
		mostrarIntro(restaurante({}));
		assert.equal(cuerpo.hijos.length, 1);
		assert.equal(cuerpo.hijos[0].id, 'introPantalla');
	});
});

// 01/10/2026: TikTok en la bienvenida y el botón de reseña de Google. La
// bienvenida real se arma con una cadena larga que estas pruebas, con su DOM de
// mentira, no recorren (mostrarIntro cae a construirIntro sin getElementById),
// así que los botones viven en funciones exportadas que sí se pueden mirar.
describe('redesIntro · TikTok y compañía', () => {
	const css = 'width:48px';
	const base = {
		social_instagram: 'https://instagram.com/bonzas',
		social_facebook: 'https://facebook.com/bonzas',
		social_tiktok: 'https://www.tiktok.com/@bonzas',
	};

	test('TikTok sale si está encendido en la bienvenida y tiene su enlace', () => {
		const redes = redesIntro({ ...base, intro_social_tiktok: true }, css);
		assert.equal(redes.length, 1);
		assert.match(redes[0], /href="https:\/\/www\.tiktok\.com\/@bonzas"/);
		assert.match(redes[0], /aria-label="Abrir TikTok"/);
		assert.match(redes[0], /rel="noopener noreferrer"/);
	});

	test('encendido pero sin enlace guardado en Ajustes, no sale: un botón sin destino sobra', () => {
		assert.equal(redesIntro({ intro_social_tiktok: true }, css).length, 0);
		assert.equal(redesIntro({ intro_social_tiktok: true, social_tiktok: '' }, css).length, 0);
	});

	test('con enlace pero apagado en la bienvenida, tampoco: el enlace también sirve a la carta', () => {
		assert.equal(redesIntro({ ...base, intro_social_tiktok: false }, css).length, 0);
		assert.equal(redesIntro({ ...base }, css).length, 0);
	});

	test('van Instagram, Facebook y TikTok, en ese orden, con el mismo estilo', () => {
		const redes = redesIntro({ ...base, intro_social_instagram: true, intro_social_facebook: true, intro_social_tiktok: true }, css);
		assert.deepEqual(redes.map(r => r.match(/aria-label="Abrir (\w+)"/)[1]), ['Instagram', 'Facebook', 'TikTok']);
		for (const r of redes) assert.match(r, /style="width:48px"/);
	});

	test('el enlace se escapa: no abre la puerta a un javascript:', () => {
		const [r] = redesIntro({ intro_social_tiktok: true, social_tiktok: 'javascript:alert(1)' }, css);
		assert.match(r, /href="#"/);
	});
});

describe('botonResenaIntro · «Califícanos en Google»', () => {
	const on = (extra = {}) => ({ intro_resena_activo: true, intro_resena_url: 'https://g.page/r/abc123/review', ...extra });

	test('apagado o sin atributos, no pinta nada', () => {
		assert.equal(botonResenaIntro({}), '');
		assert.equal(botonResenaIntro(null), '');
		assert.equal(botonResenaIntro({ intro_resena_activo: false, intro_resena_url: 'https://g.page/r/abc123/review' }), '');
	});

	test('encendido y con enlace https, pinta el botón con su estrella y el texto por defecto', () => {
		const html = botonResenaIntro(on());
		assert.match(html, /class="intro-vmenus__resena"/);
		assert.match(html, /href="https:\/\/g\.page\/r\/abc123\/review"/);
		assert.match(html, /target="_blank" rel="noopener noreferrer"/);
		assert.ok(html.includes(RESENA_TEXTO_POR_DEFECTO));
		assert.equal(RESENA_TEXTO_POR_DEFECTO, 'Califícanos en Google');
	});

	test('encendido pero sin un enlace http(s) de verdad, no pinta: un botón que no lleva a ningún lado sobra', () => {
		for (const url of ['', '   ', undefined, 'javascript:alert(1)', '/reseña', 'ftp://x.test', 'g.page/r/abc']) {
			assert.equal(botonResenaIntro(on({ intro_resena_url: url })), '', JSON.stringify(url));
		}
	});

	test('el texto del restaurante manda, se escapa y no pasa de 60 caracteres', () => {
		assert.match(botonResenaIntro(on({ intro_resena_texto: '¿Te gustó? Califícanos' })), /¿Te gustó\? Califícanos<\/a>/);
		const malo = botonResenaIntro(on({ intro_resena_texto: '<img src=x onerror=alert(1)>' }));
		assert.doesNotMatch(malo, /<img/);
		const largo = botonResenaIntro(on({ intro_resena_texto: 'x'.repeat(200) }));
		assert.equal(largo.match(/x+/)[0].length, 60);
	});

	test('un texto en blanco vuelve al de por defecto', () => {
		assert.ok(botonResenaIntro(on({ intro_resena_texto: '   ' })).includes(RESENA_TEXTO_POR_DEFECTO));
	});

	test('mostrarIntro pone reservas y reseñas justo debajo del botón principal, y las redes con el estilo de siempre', () => {
		const fuente = fs.readFileSync(new URL('../core/intro.js', import.meta.url), 'utf8');
		assert.match(fuente, /<\/button>\$\{botonReservaIntro\(at\)\}\$\{botonResenaIntro\(at\)\}\$\{redes\.length/);
		assert.match(fuente, /redes\.push\(\.\.\.redesIntro\(at, socialCss\)\)/);
	});
});

describe('el recuadro de la bienvenida · color y borde que elige el restaurante', () => {
	// El panel los guarda (intro_tarjeta_*) y la carta no los leía: la-leydi y
	// lobsterboat habían elegido un color y la bienvenida se veía igual.
	const fuente = fs.readFileSync(new URL('../core/intro.js', import.meta.url), 'utf8');

	test('sin nada guardado no se pone ninguna variable: la tarjeta se ve como siempre', () => {
		assert.deepEqual(variablesTarjeta({}), {});
		assert.deepEqual(variablesTarjeta(undefined), {});
	});

	test('lo guardado se convierte en variables', () => {
		assert.deepEqual(
			variablesTarjeta({ intro_tarjeta_fondo: '#f7ffdb', intro_tarjeta_borde: '#fff', intro_tarjeta_borde_grosor: '3' }),
			{ '--intro-tarjeta-fondo': '#f7ffdb', '--intro-tarjeta-borde': '#fff', '--intro-tarjeta-borde-grosor': '3px' });
	});

	test('solo se ponen las que existen: un restaurante con solo el fondo no cambia su borde', () => {
		assert.deepEqual(variablesTarjeta({ intro_tarjeta_fondo: '#551b1b' }), { '--intro-tarjeta-fondo': '#551b1b' });
	});

	test('un color que no es hexadecimal se ignora, y no llega al CSS', () => {
		for (const malo of ['rojo', 'red; background:url(x)', '#12', '#gggggg', 'url(javascript:1)', '', null])
			assert.deepEqual(variablesTarjeta({ intro_tarjeta_fondo: malo, intro_tarjeta_borde: malo }), {}, String(malo));
	});

	test('el grosor se acota a 0–5 px, y vacío no es «sin borde»', () => {
		assert.equal(variablesTarjeta({ intro_tarjeta_borde_grosor: 99 })['--intro-tarjeta-borde-grosor'], '5px');
		assert.equal(variablesTarjeta({ intro_tarjeta_borde_grosor: -4 })['--intro-tarjeta-borde-grosor'], '0px');
		assert.equal(variablesTarjeta({ intro_tarjeta_borde_grosor: 0 })['--intro-tarjeta-borde-grosor'], '0px', '0 es un grosor válido');
		for (const v of ['', null, undefined, 'abc', NaN])
			assert.equal('--intro-tarjeta-borde-grosor' in variablesTarjeta({ intro_tarjeta_borde_grosor: v }), false, String(v));
	});

	test('el CSS de la tarjeta lee las variables y conserva su aspecto de siempre como respaldo', () => {
		const regla = fuente.match(/\.intro-vmenus__card\{position:relative[^}]*\}/)?.[0] || '';
		assert.match(regla, /border:var\(--intro-tarjeta-borde-grosor,1px\) solid var\(--intro-tarjeta-borde,rgba\(255,255,255,\.35\)\)/);
		assert.match(regla, /background:var\(--intro-tarjeta-fondo,rgba\(15,15,20,\.28\)\)/);
	});

	test('mostrarIntro las aplica a la bienvenida', () => {
		assert.match(fuente, /Object\.entries\(variablesTarjeta\(at\)\)\) raiz\.style\.setProperty\(k, val\)/);
	});
});
