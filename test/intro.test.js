// La pantalla de bienvenida (intro), opcional y apagada por defecto. No es
// "portada" (la imagen de cabecera de Explorar) ni "mostrar_hero" (el mensaje
// de sidebar/topnav): ver la cabecera de core/intro.js.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

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

const { introActiva, construirIntro, mostrarIntro } = await import('../core/intro.js');

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
