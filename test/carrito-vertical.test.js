// El botón de agregar del modelo Vertical (30/09/2026). Pasó de «+ Agregar» a
// un «+» solo, así que el texto ya no dice qué hace: lo tiene que decir el
// nombre accesible, y el «✓» de confirmar no puede quedarse pegado si se toca
// dos veces seguidas (la versión anterior restauraba «lo de antes», y con el
// segundo toque «lo de antes» ya era la marca de agregado).
import { test, describe, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ── Un DOM falso con lo justo para este tema ──────────────────
function nodo() {
	const n = {
		style: {}, dataset: {}, atributos: {}, hijos: [], oyentes: {}, onclick: null, hidden: false,
		_html: '', textContent: '', className: '', tabIndex: -1, _q: {},
		set innerHTML(v) { this._html = v; this._q = {}; this.hijos = []; }, get innerHTML() { return this._html; },
		setAttribute(k, v) { this.atributos[k] = String(v); },
		getAttribute(k) { return this.atributos[k] ?? null; },
		appendChild(h) { this.hijos.push(h); return h; },
		append(...hs) { this.hijos.push(...hs); },
		addEventListener(ev, fn) { (this.oyentes[ev] ||= []).push(fn); },
		insertAdjacentHTML() {}, insertAdjacentElement() {},
		// Las líneas del pedido buscan sus botones con querySelector: tiene que
		// devolver siempre el mismo nodo para cada selector.
		querySelector(sel) { return (this._q[sel] ||= nodo()); }, querySelectorAll: () => [],
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
const vertical = await import('../temas/vertical.js');

const CAT = { id: 'c1', nombre: 'BURGERS' };
const SIMPLE = { id: 'p1', nombre: 'Clásica', precio: '$ 18.000', precio_numerico: 18000, categoria_id: 'c1', imagen_url: '/uploads/x.jpg', disponible: true, atributos: {} };
const CON_TOPPINGS = { id: 'p2', nombre: 'Doble', precio: '$ 24.000', precio_numerico: 24000, categoria_id: 'c1', imagen_url: '/uploads/y.jpg', disponible: true,
	atributos: { personalizacion: { platino: ['t1'] } } };
// Sin foto ni video: cae a la pantalla de lista, que lleva el mismo botón.
const SIN_MEDIA = { id: 'p3', nombre: 'Agua', precio: '$ 4.500', precio_numerico: 4500, categoria_id: 'c1', imagen_url: '', disponible: true, atributos: {} };

function montar({ carrito }) {
	setRestaurante({ id: 'r1', slug: 'pruebas', nombre: 'Pruebas',
		atributos: { nav: 'vertical', plan: 'video', carrito, toppings_platino: [{ id: 't1', nombre: 'Cebolla' }] } });
	setCategorias([CAT]);
	setProductos([SIMPLE, CON_TOPPINGS, SIN_MEDIA]);
	vertical.buildNav();
	vertical.buildMenu();
}

// Lo que se pintó en la carta, todo junto.
const html = () => nodos.mainContent.hijos.map(s => s.innerHTML).join('');

// Un botón falso con lo que el escuchador le pide al tocarlo.
function botonFalso(id, etiqueta) {
	const b = nodo();
	b.dataset.plato = id;
	b.textContent = '+';
	b.setAttribute('aria-label', etiqueta);
	return b;
}
const tocar = btn => nodos.mainContent.oyentes.click[0]({ target: { closest: () => btn } });

beforeEach(() => {
	almacen.clear();
	documentoNuevo();
	setRestaurante({ id: 'r1', slug: 'pruebas', atributos: {} });
	almacen.set('pruebas_cart', JSON.stringify({ v: 2, ts: Date.now(), items: [] }));
	loadCartFromStorage();
	almacen.clear();
});

describe('Vertical sin carrito', () => {
	test('no pinta ningún botón de agregar', () => {
		montar({ carrito: false });
		assert.doesNotMatch(html(), /ver-add/);
	});
});

describe('Vertical con carrito: el botón es solo el «+»', () => {
	test('el botón dice «+», sin la palabra Agregar, y lleva el nombre del plato para el lector de pantalla', () => {
		montar({ carrito: true });
		const pintado = html();
		assert.match(pintado, /<button class="ver-add" data-plato="p1" aria-label="Agregar Clásica al pedido">\+<\/button>/);
		assert.doesNotMatch(pintado, />\s*\+ (Agregar|Personalizar)\s*</, 'ya no hay texto dentro del botón');
	});

	test('un plato con personalización se anuncia como «Personalizar», no como agregar', () => {
		montar({ carrito: true });
		assert.match(html(), /data-plato="p2" aria-label="Personalizar Doble">\+<\/button>/);
	});

	test('la pantalla de lista (platos sin foto ni video) usa el mismo botón', () => {
		montar({ carrito: true });
		assert.match(html(), /<button class="ver-add" data-plato="p3" aria-label="Agregar Agua al pedido">\+<\/button>/);
	});
});

describe('Al tocar el «+»', () => {
	test('confirma con «✓», cambia el nombre accesible y lo restaura entero a los 900 ms', () => {
		mock.timers.enable({ apis: ['setTimeout'] });
		try {
			montar({ carrito: true });
			const btn = botonFalso('p1', 'Agregar Clásica al pedido');
			tocar(btn);
			assert.equal(btn.textContent, '✓');
			assert.ok(btn.classList.contains('ver-add-ok'));
			assert.equal(btn.getAttribute('aria-label'), 'Clásica agregado al pedido');
			mock.timers.tick(900);
			assert.equal(btn.textContent, '+');
			assert.ok(!btn.classList.contains('ver-add-ok'));
			assert.equal(btn.getAttribute('aria-label'), 'Agregar Clásica al pedido');
		} finally {
			mock.timers.reset();
		}
	});

	test('dos toques seguidos no dejan el botón pegado en «✓»', () => {
		mock.timers.enable({ apis: ['setTimeout'] });
		try {
			montar({ carrito: true });
			const btn = botonFalso('p1', 'Agregar Clásica al pedido');
			tocar(btn);
			mock.timers.tick(300);
			tocar(btn); // el segundo toque llega con el botón aún en «✓»
			mock.timers.tick(900);
			assert.equal(btn.textContent, '+');
			assert.equal(btn.getAttribute('aria-label'), 'Agregar Clásica al pedido');
			// Y las dos unidades entraron en el pedido.
			assert.equal(nodos.cartFabCount.textContent, 2);
		} finally {
			mock.timers.reset();
		}
	});

	test('un plato con personalización abre la ventana y no lo agrega todavía', () => {
		montar({ carrito: true });
		const btn = botonFalso('p2', 'Personalizar Doble');
		tocar(btn);
		assert.equal(nodos.customName.textContent, 'Doble');
		assert.equal(btn.textContent, '+', 'el botón no cambia: aún no se agregó nada');
		assert.equal(nodos.cartFabCount.textContent ?? 0, 0);
	});
});

describe('El carrito flotante rebota al agregar, y solo al agregar', () => {
	test('sube el contador → rebota; bajarlo no', () => {
		montar({ carrito: true });
		const fab = nodos.cartFab;
		tocar(botonFalso('p1', 'Agregar Clásica al pedido'));
		assert.ok(fab.classList.contains('rebote'), 'rebota al subir');
		fab.classList.remove('rebote');
		mock.timers.enable({ apis: ['setTimeout'] });
		mock.timers.tick(900);
		mock.timers.reset();
		assert.ok(!fab.classList.contains('rebote'));
	});
});
