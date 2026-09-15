// El carrito en Topnav y Sidebar (15/09/2026). Hasta entonces solo lo tenían
// carrito, video y vertical; Bonzas es Topnav y Malparados Sidebar, los dos
// clientes reales. Con el carrito apagado la carta tiene que quedar igual que
// siempre: eso es lo que permite desplegar esto antes de que nadie lo encienda.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ── Un DOM falso con lo justo ─────────────────────────────────
function nodo() {
	const n = {
		style: {}, dataset: {}, atributos: {}, hijos: [], oyentes: {}, onclick: null, hidden: false,
		_html: '', textContent: '', className: '', tabIndex: -1,
		set innerHTML(v) { this._html = v; this._q = {}; }, get innerHTML() { return this._html; },
		setAttribute(k, v) { this.atributos[k] = String(v); },
		appendChild(h) { this.hijos.push(h); return h; },
		addEventListener(ev, fn) { (this.oyentes[ev] ||= []).push(fn); },
		insertAdjacentElement() {},
		querySelector(sel) { return ((this._q ||= {})[sel] ||= nodo()); },
		querySelectorAll: () => [],
		insertAdjacentHTML() {},
		remove() {},
		focus() {},
		classList: {
			_c: new Set(),
			add(c) { this._c.add(c); }, remove(c) { this._c.delete(c); },
			contains(c) { return this._c.has(c); }, toggle(c, on) { on ? this._c.add(c) : this._c.delete(c); },
		},
	};
	n.classList = { ...n.classList, _c: new Set() };
	return n;
}

let nodos;
function documentoNuevo() {
	nodos = {};
	globalThis.document = {
		getElementById: id => (nodos[id] ||= nodo()),
		createElement: () => nodo(),
		querySelector: () => null,
		querySelectorAll: () => [],
		addEventListener() {},
		body: { style: {} },
		activeElement: null,
	};
}

const almacen = new Map();
globalThis.localStorage = {
	getItem: k => (almacen.has(k) ? almacen.get(k) : null),
	setItem: (k, v) => almacen.set(k, String(v)),
	removeItem: k => almacen.delete(k),
};
// ?preview hace que analytics no llame a la red.
globalThis.window = { location: { search: '?preview=1' } };
globalThis.IntersectionObserver = class { observe() {} };
documentoNuevo();

const { setRestaurante, setCategorias, setProductos, buildMenu, openModal } = await import('../core/menu.js');
const { carritoEncendido, activarCarrito, loadCartFromStorage } = await import('../core/carrito.js');
const topnav = await import('../temas/topnav.js');
const sidebar = await import('../temas/sidebar.js');

const CAT = { id: 'c1', nombre: 'BURGERS' };
const CON_FOTO = { id: 'p1', nombre: 'Clásica', precio: '$ 18.000', precio_numerico: 18000, categoria_id: 'c1', imagen_url: '/uploads/x.jpg', atributos: {} };
const SIN_FOTO = { id: 'p2', nombre: 'Gaseosa', precio: '$ 4.000', precio_numerico: 4000, categoria_id: 'c1', imagen_url: '', atributos: {} };
const CON_TOPPINGS = { id: 'p3', nombre: 'Doble', precio: '$ 24.000', precio_numerico: 24000, categoria_id: 'c1', imagen_url: '/uploads/y.jpg',
	atributos: { personalizacion: { platino: ['t1'] } } };

function restaurante({ carrito, plan = 'completo', nav = 'topnav' } = {}) {
	setRestaurante({ id: 'r1', slug: 'pruebas', nombre: 'Pruebas',
		atributos: { nav, plan, carrito, toppings_platino: [{ id: 't1', nombre: 'Cebolla' }] } });
	setCategorias([CAT]);
	setProductos([CON_FOTO, SIN_FOTO, CON_TOPPINGS]);
}

// Los botones «+» que quedaron en la carta, en el orden de los platos.
function botonesAgregar() {
	const seccion = nodos.mainContent.hijos[0];
	const grid = seccion.hijos[0];
	return grid.hijos.map(el => {
		const donde = el.className.includes('product-card') ? el.querySelector('.card-body') : el;
		return donde.hijos.find(h => h.className === 'menu-add') || null;
	});
}

// El pedido vive en memoria del módulo: sin recargarlo vacío, lo que agregó una
// prueba aparece en la siguiente.
beforeEach(() => {
	almacen.clear();
	documentoNuevo();
	setRestaurante({ id: 'r1', slug: 'pruebas', atributos: {} });
	// Sin nada guardado, loadCartFromStorage no toca lo que haya en memoria.
	almacen.set('pruebas_cart', JSON.stringify({ v: 2, ts: Date.now(), items: [] }));
	loadCartFromStorage();
	almacen.clear();
});

// ═══════════════════════════════════════════════════════════════
describe('carritoEncendido · una sola regla para los cuatro modelos', () => {
	test('hace falta el plan y el interruptor', () => {
		assert.equal(carritoEncendido({ atributos: { plan: 'completo', carrito: true } }), true);
		assert.equal(carritoEncendido({ atributos: { plan: 'completo', carrito: false } }), false, 'el restaurante no lo quiere');
		assert.equal(carritoEncendido({ atributos: { plan: 'completo' } }), false, 'sin decir nada, apagado');
		assert.equal(carritoEncendido({ atributos: { plan: 'vitrina', carrito: true } }), false, 'Vitrina no incluye pedidos');
	});

	test('los temas de video la usan en vez de su copia', async () => {
		const fs = await import('node:fs');
		for (const f of ['temas/video.js', 'temas/vertical.js']) {
			const src = fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
			assert.doesNotMatch(src, /planDe\(restaurante\)\.carrito/, `${f} volvió a escribir la regla`);
			assert.match(src, /carritoEncendido\(\)/);
		}
	});
});

describe('activarCarrito · una sola vez por página', () => {
	// El modelo 'carrito' reutiliza el buildNav de sidebar, que ahora también lo
	// enciende. Dos veces dejaría cada escuchador duplicado: el «+» de cantidad
	// sumaría de dos en dos.
	test('la segunda llamada no vuelve a registrar nada', () => {
		restaurante({ carrito: true });
		activarCarrito();
		activarCarrito();
		assert.equal(nodos.btnMas.oyentes.click.length, 1);
		assert.equal(nodos.btnAgregarCarrito.oyentes.click.length, 1);
	});
});

// ═══════════════════════════════════════════════════════════════
describe('Topnav y Sidebar enseñan su botón del pedido', () => {
	test('Topnav, con carrito: el botón flotante', () => {
		restaurante({ carrito: true });
		topnav.buildNav();
		assert.equal(nodos.cartFab.style.display, 'block');
		assert.notEqual(nodos.cartBtn?.style.display, 'flex', 'no tiene cabecera fija donde ponerlo');
	});

	test('Sidebar, con carrito: el botón de la cabecera fija', () => {
		restaurante({ carrito: true, nav: 'sidebar' });
		sidebar.buildNav();
		assert.equal(nodos.cartBtn.style.display, 'flex');
		assert.notEqual(nodos.cartFab?.style.display, 'block');
	});

	test('sin carrito, ninguno de los dos enseña nada', () => {
		for (const [tema, nav] of [[topnav, 'topnav'], [sidebar, 'sidebar']]) {
			documentoNuevo();
			restaurante({ carrito: false, nav });
			tema.buildNav();
			assert.notEqual(nodos.cartFab?.style.display, 'block', nav);
			assert.notEqual(nodos.cartBtn?.style.display, 'flex', nav);
			assert.equal(nodos.btnMas, undefined, `${nav} encendió el carrito sin tenerlo`);
		}
	});

	test('con el plan Vitrina, aunque el interruptor diga que sí, tampoco', () => {
		restaurante({ carrito: true, plan: 'vitrina' });
		topnav.buildNav();
		assert.notEqual(nodos.cartFab?.style.display, 'block');
	});
});

// ═══════════════════════════════════════════════════════════════
describe('el «+» de cada plato', () => {
	test('sin carrito la carta queda como siempre: ningún «+»', () => {
		restaurante({ carrito: false });
		buildMenu();
		assert.deepEqual(botonesAgregar(), [null, null, null]);
	});

	test('con carrito, cada plato lleva el suyo, con foto o sin ella', () => {
		restaurante({ carrito: true });
		buildMenu();
		const botones = botonesAgregar();
		assert.ok(botones.every(Boolean), 'algún plato se quedó sin «+»');
		assert.equal(botones[0].atributos['aria-label'], 'Agregar Clásica al pedido');
		assert.equal(botones[2].atributos['aria-label'], 'Personalizar Doble al pedido', 'con toppings dice que personaliza');
	});

	test('pulsarlo agrega al pedido y no abre la ficha', () => {
		restaurante({ carrito: true });
		buildMenu();
		let subio = false;
		const [boton] = botonesAgregar();
		boton.onclick({ stopPropagation() { subio = 'parado'; } });
		assert.equal(subio, 'parado', 'el clic llegaría a la tarjeta y abriría la ficha');
		const guardado = JSON.parse(almacen.get('pruebas_cart'));
		assert.deepEqual(guardado.items.map(i => [i.id, i.cantidad]), [['p1', 1]]);
		assert.equal(boton.textContent, '✓', 'el propio botón confirma');
	});

	test('un plato con toppings abre la personalización en vez de agregar a ciegas', () => {
		restaurante({ carrito: true });
		activarCarrito();
		buildMenu();
		botonesAgregar()[2].onclick({ stopPropagation() {} });
		const enPedido = almacen.has('pruebas_cart') ? JSON.parse(almacen.get('pruebas_cart')).items.length : 0;
		assert.equal(enPedido, 0, 'se agregó sin elegir los toppings');
		assert.ok(nodos.customOverlay.classList.contains('open'), 'no se abrió la personalización');
	});
});

// ═══════════════════════════════════════════════════════════════
describe('el botón de agregar de la ficha', () => {
	test('sin carrito está escondido', () => {
		restaurante({ carrito: false });
		buildMenu();
		openModal('c1', 0);
		assert.equal(nodos.modalAgregar.hidden, true);
		assert.equal(nodos.modalAgregar.onclick, null);
	});

	test('con carrito aparece y agrega el plato que se está viendo', () => {
		restaurante({ carrito: true });
		buildMenu();
		openModal('c1', 1);
		assert.equal(nodos.modalAgregar.hidden, false);
		assert.equal(nodos.modalAgregar.textContent, '+ Agregar al pedido');
		nodos.modalAgregar.onclick();
		assert.deepEqual(JSON.parse(almacen.get('pruebas_cart')).items.map(i => i.id), ['p2']);
		assert.equal(nodos.modalAgregar.textContent, '✓ Agregado');
	});

	test('con toppings dice «Personalizar», cierra la ficha y abre la personalización encima', () => {
		// La ficha tiene z-index 500 y la personalización 400: sin cerrarla,
		// la personalización se abriría detrás.
		restaurante({ carrito: true });
		activarCarrito();
		buildMenu();
		openModal('c1', 2);
		assert.equal(nodos.modalAgregar.textContent, '+ Personalizar');
		nodos.modalAgregar.onclick();
		assert.equal(nodos.modalOverlay.classList.contains('open'), false, 'la ficha sigue tapando');
		assert.ok(nodos.customOverlay.classList.contains('open'));
	});
});
