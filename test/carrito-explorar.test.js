// El carrito en Explorar (17/09/2026). Era el único modelo que no lo pintaba
// aunque el plan lo incluyera y el restaurante lo encendiera en Ajustes. Con
// el carrito apagado, la carta tiene que quedar igual que siempre.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ── Un DOM falso con lo justo para este tema ──────────────────
function nodo() {
	const n = {
		style: {}, dataset: {}, atributos: {}, hijos: [], oyentes: {}, onclick: null, hidden: false,
		_html: '', textContent: '', className: '', tabIndex: -1, _q: {},
		set innerHTML(v) { this._html = v; this._q = {}; this.hijos = []; }, get innerHTML() { return this._html; },
		setAttribute(k, v) { this.atributos[k] = String(v); },
		appendChild(h) { this.hijos.push(h); return h; },
		append(...hs) { this.hijos.push(...hs); },
		addEventListener(ev, fn) { (this.oyentes[ev] ||= []).push(fn); },
		insertAdjacentHTML() {}, insertAdjacentElement() {},
		// El pie de la tarjeta se busca para colgarle el «+»: tiene que ser el mismo
		// nodo cada vez. Una imagen, en cambio, no existe (no hay onerror que colgar).
		querySelector(sel) { return /img/.test(sel) ? null : (this._q[sel] ||= nodo()); },
		querySelectorAll: () => [],
		replaceWith() {}, remove() {}, focus() {}, scrollIntoView() {},
	};
	const clases = new Set();
	n.classList = {
		add: c => clases.add(c), remove: c => clases.delete(c),
		contains: c => clases.has(c), toggle: (c, on) => (on ?? !clases.has(c)) ? clases.add(c) : clases.delete(c),
	};
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
		body: Object.assign(nodo(), { style: {} }),
		activeElement: null,
	};
}

const almacen = new Map();
globalThis.localStorage = {
	getItem: k => (almacen.has(k) ? almacen.get(k) : null),
	setItem: (k, v) => almacen.set(k, String(v)),
	removeItem: k => almacen.delete(k),
};
globalThis.window = { location: { search: '?preview=1' }, addEventListener() {}, scrollY: 0 };
globalThis.IntersectionObserver = class { observe() {} };
documentoNuevo();

const { setRestaurante, setCategorias, setProductos } = await import('../core/menu.js');
const { loadCartFromStorage } = await import('../core/carrito.js');
const explorar = await import('../temas/explorar.js');

const CAT = { id: 'c1', nombre: 'BURGERS' };
const SIMPLE = { id: 'p1', nombre: 'Clásica', precio: '$ 18.000', precio_numerico: 18000, categoria_id: 'c1', imagen_url: '/uploads/x.jpg', disponible: true, atributos: {} };
const CON_TOPPINGS = { id: 'p2', nombre: 'Doble', precio: '$ 24.000', precio_numerico: 24000, categoria_id: 'c1', imagen_url: '', disponible: true,
	atributos: { personalizacion: { platino: ['t1'] } } };

function montar({ carrito }) {
	setRestaurante({ id: 'r1', slug: 'pruebas', nombre: 'Pruebas',
		atributos: { nav: 'explorar', plan: 'completo', carrito, toppings_platino: [{ id: 't1', nombre: 'Cebolla' }] } });
	setCategorias([CAT]);
	setProductos([SIMPLE, CON_TOPPINGS]);
	explorar.buildNav();
	explorar.buildMenu();
}

// La barra de arriba es el primer hijo que el tema cuelga del body.
const barra = () => document.body.hijos[0];
// Los platos pintados: mainContent → contenido → expDishes → sección → lista.
const platos = () => nodos.expDishes.hijos[0].hijos.at(-1).hijos;
const masDe = el => el.hijos.find(h => h.className?.includes('menu-add'))
	|| el._q['.exp-card-body']?.hijos.find(h => h.className?.includes('menu-add')) || null;

beforeEach(() => {
	almacen.clear();
	documentoNuevo();
	setRestaurante({ id: 'r1', slug: 'pruebas', atributos: {} });
	almacen.set('pruebas_cart', JSON.stringify({ v: 2, ts: Date.now(), items: [] }));
	loadCartFromStorage();
	almacen.clear();
});

describe('Explorar sin carrito queda como siempre', () => {
	test('ni botón del pedido arriba ni «+» en los platos', () => {
		montar({ carrito: false });
		assert.doesNotMatch(barra().innerHTML, /expCartBtn/);
		assert.equal(document.vmCarritoActivo, undefined, 'no se enciende la maquinaria');
		for (const p of platos()) assert.equal(masDe(p), null);
	});
});

describe('Explorar con carrito', () => {
	test('el botón del pedido va arriba, junto a la lupa, y abre el pedido', () => {
		montar({ carrito: true });
		// Arriba y no flotante: abajo está fija la barra de categorías.
		assert.match(barra().innerHTML, /id="expCartBtn"[^>]*aria-label="Ver el pedido"/);
		assert.match(barra().innerHTML, /id="expCartCount"/);
		assert.equal(document.vmCarritoActivo, true);
		let abierto = false;
		window.vmToggleCart = () => { abierto = true; };
		nodos.expCartBtn.onclick();
		assert.equal(abierto, true);
	});

	test('cada plato de la lista tiene su «+», con nombre para el lector de pantalla', () => {
		montar({ carrito: true });
		const [simple, doble] = platos().map(masDe);
		assert.ok(simple && doble);
		assert.equal(simple.atributos['aria-label'], 'Agregar Clásica al pedido');
		assert.equal(doble.atributos['aria-label'], 'Personalizar Doble al pedido');
	});

	test('el «+» de un plato simple lo suma sin abrir la ficha', () => {
		montar({ carrito: true });
		const simple = platos()[0];
		let fichaAbierta = false;
		simple.onclick = () => { fichaAbierta = true; };
		let propagado = true;
		masDe(simple).onclick({ stopPropagation: () => { propagado = false; } });
		assert.equal(propagado, false, 'el clic no puede llegar al plato');
		assert.equal(fichaAbierta, false);
		assert.equal(nodos.expCartCount.textContent, 1, 'el contador de arriba sube');
	});

	test('el «+» de un plato con toppings abre la personalización', () => {
		montar({ carrito: true });
		masDe(platos()[1]).onclick({ stopPropagation() {} });
		assert.equal(nodos.customName.textContent, 'Doble');
		assert.equal(nodos.expCartCount.textContent, 0, 'todavía no se ha agregado nada');
	});
});

describe('la ficha de Explorar', () => {
	test('con carrito lleva «+ Agregar al pedido», y sin él no', () => {
		montar({ carrito: true });
		platos()[0].onclick();
		const cuerpo = nodos.expModalContent._q['.exp-modal-body'];
		const boton = cuerpo.hijos.find(h => h.className === 'modal-agregar');
		assert.equal(boton?.textContent, '+ Agregar al pedido');
		boton.onclick();
		assert.equal(nodos.expCartCount.textContent, 1);

		documentoNuevo();
		montar({ carrito: false });
		platos()[0].onclick();
		const sinPedido = nodos.expModalContent._q['.exp-modal-body'];
		assert.equal(sinPedido?.hijos.some(h => h.className === 'modal-agregar') ?? false, false);
	});

	test('con toppings dice «Personalizar» y cierra la ficha antes de abrir la personalización', () => {
		// La ficha va por encima de la personalización: sin cerrarla, esta quedaría detrás.
		montar({ carrito: true });
		platos()[1].onclick();
		assert.ok(nodos.expModal.classList.contains('open'));
		const boton = nodos.expModalContent._q['.exp-modal-body'].hijos.find(h => h.className === 'modal-agregar');
		assert.equal(boton.textContent, '+ Personalizar');
		boton.onclick();
		assert.equal(nodos.expModal.classList.contains('open'), false);
		assert.equal(nodos.customName.textContent, 'Doble');
	});
});
