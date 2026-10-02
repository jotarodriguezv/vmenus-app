// Los datos del negocio en la carta: el WhatsApp único, el botón que se decide
// aparte, y quién recibe pedidos. La misma regla vive en el panel y en su
// servidor, y todos corren contra el mismo juego de casos.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// El carrito toca localStorage y el DOM; se preparan ANTES de importarlo.
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = { getElementById: () => null };
globalThis.window = { location: { search: '' } };

const { whatsappDelNegocio, botonWhatsappActivo, whatsappParaMostrar, direccionDelNegocio, mapaDelNegocio, resenaDelNegocio } = await import('../core/negocio.js');
const { setRestaurante, enlacesSociales } = await import('../core/menu.js');
const { recibePedidos } = await import('../core/carrito.js');
const { botonResenaIntro, mostrarIntro } = await import('../core/intro.js');

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CASOS = JSON.parse(readFileSync(join(RAIZ, 'test', 'casos-negocio.json'), 'utf8'));

describe('la regla · el mismo juego de casos que el servidor y el panel', () => {
	// Si se separan, el panel dice que la carta recibe pedidos y la carta rechaza
	// el pedido de un cliente.
	test('hay casos que correr', () => assert.ok(CASOS.casos.length >= 10));

	for (const c of CASOS.casos) {
		test(c.nombre, () => {
			assert.equal(whatsappDelNegocio(c.at), c.numero);
			assert.equal(botonWhatsappActivo(c.at), c.boton);
			// Lo que se enseña en un botón: hace falta el número Y el botón.
			assert.equal(whatsappParaMostrar(c.at), c.visible ? c.numero : '');
		});
	}
});

describe('la barra de redes: el botón de WhatsApp', () => {
	// La barra solo existe con social_bar encendido; lo que se prueba es el botón.
	const waDe = at => enlacesSociales({ social_bar: true, ...at }).filter(l => l.label === 'WhatsApp').map(l => l.href);

	test('con la barra apagada no sale nada, ni el botón de WhatsApp', () => {
		assert.deepEqual(enlacesSociales({ social_bar: false, whatsapp_negocio: '573001234567', whatsapp_boton: true }), []);
	});

	test('con el número y el botón encendido, sale y apunta al número del negocio', () => {
		assert.deepEqual(waDe({ whatsapp_negocio: '573001234567', whatsapp_boton: true }), ['https://wa.me/573001234567']);
	});

	test('con el botón apagado no sale, aunque el número sirva para pedir', () => {
		assert.deepEqual(waDe({ whatsapp_negocio: '573001234567', whatsapp_boton: false }), []);
	});

	test('quien solo tenía el número de pedidos NO ve aparecer un botón que nunca pidió', () => {
		assert.deepEqual(waDe({ whatsapp_pedidos: '573001234567' }), []);
	});

	test('quien ya tenía el de la barra de redes lo sigue viendo, sin hacer nada', () => {
		assert.deepEqual(waDe({ social_whatsapp: '573001234567' }), ['https://wa.me/573001234567']);
	});
});

describe('el carrito: quién recibe pedidos', () => {
	const conAtributos = atributos => setRestaurante({ id: 'r1', slug: 'pruebas', atributos });

	beforeEach(() => conAtributos({}));

	test('con el WhatsApp del negocio, recibe', () => {
		conAtributos({ whatsapp_negocio: '+57 300 123 4567' });
		assert.equal(recibePedidos(), true);
	});

	test('con el número viejo de pedidos, también, mientras dure la transición', () => {
		conAtributos({ whatsapp_pedidos: '573001234567' });
		assert.equal(recibePedidos(), true);
	});

	test('sin ningún número no recibe', () => {
		assert.equal(recibePedidos(), false);
	});

	test('si borró el número, el viejo no lo resucita', () => {
		conAtributos({ whatsapp_negocio: '', whatsapp_pedidos: '573001234567' });
		assert.equal(recibePedidos(), false);
	});

	test('el botón de WhatsApp apagado no impide recibir pedidos', () => {
		conAtributos({ whatsapp_negocio: '573001234567', whatsapp_boton: false });
		assert.equal(recibePedidos(), true);
	});
});

describe('quién más lee el WhatsApp', () => {
	const leer = f => readFileSync(join(RAIZ, f), 'utf8').replace(/^\s*\/\/.*$/gm, '');

	test('el envío del pedido usa el del negocio, no la clave vieja', () => {
		assert.doesNotMatch(leer('core/carrito.js'), /atributos\?\.whatsapp_pedidos/);
		assert.match(leer('core/carrito.js'), /const whatsapp = whatsappDelNegocio\(restaurante\?\.atributos\)/);
	});

	test('la bienvenida y la barra de redes usan whatsappParaMostrar, no social_whatsapp', () => {
		assert.doesNotMatch(leer('core/intro.js'), /social_whatsapp/);
		assert.doesNotMatch(leer('core/menu.js'), /social_whatsapp/);
		assert.match(leer('core/intro.js'), /whatsappParaMostrar\(at\)/);
		assert.match(leer('core/menu.js'), /whatsappParaMostrar\(at\)/);
	});

	test('la vista previa no puede cambiar el WhatsApp: es A DÓNDE APUNTA la carta, no cómo se ve', () => {
		// preview.js lo explica: el parámetro lo escribe quien construye la URL.
		const preview = leer('core/preview.js');
		assert.doesNotMatch(preview, /'whatsapp_negocio'|'whatsapp_boton'|'whatsapp_pedidos'|'social_whatsapp'/);
	});
});

describe('los enlaces y la dirección · el mismo juego de casos que el panel (paso 2)', () => {
	test('hay casos que correr', () => assert.ok(CASOS.enlaces.length >= 6));

	for (const c of CASOS.enlaces) {
		test(c.nombre, () => {
			assert.equal(direccionDelNegocio(c.at), c.direccion);
			assert.equal(mapaDelNegocio(c.at), c.mapa);
			assert.equal(resenaDelNegocio(c.at), c.resena);
		});
	}
});

describe('la bienvenida: el botón de reseñas toma el enlace del negocio', () => {
	const URL_RESENA = 'https://g.page/r/CabC123/review';

	test('con el enlace nuevo y el botón encendido, sale', () => {
		assert.match(botonResenaIntro({ intro_resena_activo: true, resena_url: URL_RESENA }), /href="https:\/\/g\.page\/r\/CabC123\/review"/);
	});

	test('quien tenía el enlace de antes (intro_resena_url) lo sigue viendo, sin hacer nada', () => {
		assert.match(botonResenaIntro({ intro_resena_activo: true, intro_resena_url: URL_RESENA }), /g\.page/);
	});

	test('el interruptor sigue siendo de la bienvenida: con el enlace y apagado, no sale', () => {
		assert.equal(botonResenaIntro({ intro_resena_activo: false, resena_url: URL_RESENA }), '');
	});

	test('si el restaurante borra el enlace, el viejo no resucita', () => {
		assert.equal(botonResenaIntro({ intro_resena_activo: true, resena_url: '', intro_resena_url: URL_RESENA }), '');
	});
});

describe('la bienvenida: la ubicación respeta su interruptor', () => {
	// El enlace pasó a ser del negocio, así que puede estar escrito sin que la
	// bienvenida quiera enseñarlo. Hasta el 02/10/2026 la carta ni miraba el
	// interruptor (intro_mapa_activo): enseñaba el mapa si había enlace, y un
	// restaurante que rellena el enlace en Ajustes habría visto aparecer un mapa
	// que nunca encendió.
	const MAPA = 'https://maps.app.goo.gl/abc';

	// Lo que devuelve querySelector tras pintar el HTML: algo que acepta cualquier
	// llamada, porque lo que se prueba es el HTML y no los eventos.
	const comodin = {
		addEventListener() {}, remove() {}, focus() {}, setAttribute() {}, appendChild() {},
		style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} },
		querySelector: () => comodin, querySelectorAll: () => [],
	};

	function montarIntro(atributos) {
		let raiz = null;
		const nodo = () => ({
			style: { setProperty() {} }, dataset: {}, classList: { add() {}, remove() {}, toggle() {} },
			setAttribute() {}, appendChild() {}, addEventListener() {}, querySelector: () => comodin,
			querySelectorAll: () => [], remove() {}, innerHTML: '', textContent: '',
		});
		globalThis.document = {
			getElementById: () => null, head: { appendChild() {} }, addEventListener() {}, removeEventListener() {},
			body: { appendChild(n) { raiz = n; }, style: {} },
			createElement: () => nodo(),
		};
		mostrarIntro({ nombre: 'Bonzas', logo_url: '', atributos: { intro_activo: true, ...atributos } });
		globalThis.document = { getElementById: () => null };
		return raiz?.innerHTML || '';
	}

	test('encendida y con enlace, se enseña (como antes)', () => {
		const html = montarIntro({ intro_mapa_activo: true, mapa_url: MAPA, intro_mapa_modo: 'boton' });
		assert.match(html, /intro-vmenus__mapa-link/);
	});

	test('con el enlace de la bienvenida de antes y encendida, también', () => {
		assert.match(montarIntro({ intro_mapa_activo: true, intro_mapa_url: MAPA, intro_mapa_modo: 'boton' }), /intro-vmenus__mapa-link/);
	});

	test('con enlace pero APAGADA, no se enseña nada', () => {
		const html = montarIntro({ intro_mapa_activo: false, mapa_url: MAPA, intro_mapa_modo: 'ambos' });
		assert.doesNotMatch(html, /intro-vmenus__mapa/);
	});

	test('sin el interruptor guardado tampoco: es apagada por defecto', () => {
		assert.doesNotMatch(montarIntro({ mapa_url: MAPA, intro_mapa_modo: 'boton' }), /intro-vmenus__mapa/);
	});

	test('encendida sin enlace, no se enseña nada', () => {
		assert.doesNotMatch(montarIntro({ intro_mapa_activo: true, intro_mapa_modo: 'boton' }), /intro-vmenus__mapa/);
	});
});
