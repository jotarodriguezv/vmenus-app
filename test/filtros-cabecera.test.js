// Dónde acaba la fila de chips (16/09/2026). En los modelos con cabecera fija
// —Sidebar y Carrito— la fila se pintaba en lo alto del documento, debajo de
// una cabecera de 60 px con z-index 100: los chips existían, medían lo suyo y
// no se veían, y un toque en su sitio se lo llevaba la hamburguesa. Se cazó en
// la carta de pruebas con modelo Sidebar, con los filtros bien configurados.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ── DOM falso: solo lo que contenedorDeChips y montarChips tocan ──
function nodo(id = '') {
	return {
		id, innerHTML: '', className: '', textContent: '', onclick: null,
		hijos: [], insertados: [],
		appendChild(h) { this.hijos.push(h); return h; },
		// Insertar de verdad, porque el código vuelve a buscar la fila por su id
		// en el siguiente repintado y tiene que encontrar la misma.
		insertAdjacentElement(donde, el) { this.insertados.push([donde, el]); if (el.id) nodos[el.id] = el; },
		classList: {
			_c: new Set(),
			add(c) { this._c.add(c); }, remove(c) { this._c.delete(c); },
			contains(c) { return this._c.has(c); },
			toggle(c, on) { on ? this._c.add(c) : this._c.delete(c); },
		},
		style: {},
	};
}

let nodos;
globalThis.document = {
	// Como el de verdad: lo que no está en el documento no existe. Devolver un
	// nodo vacío haría creer al código que la fila ya estaba puesta.
	getElementById: id => nodos[id] || null,
	createElement: () => nodo(),
	querySelectorAll: () => [],
};

const { setRestaurante, setProductos } = await import('../core/menu.js');
const { montarChips } = await import('../core/filtros.js');

const CATALOGO = [{ id: 'picante', label: 'Picante', emoji: '🌶' }];

// Un restaurante con un filtro configurado y un plato que lo cumple: es lo
// mínimo para que haya chips, porque filtrosEnUso() descarta los que no usa
// ningún plato.
function conFiltros() {
	setRestaurante({ id: 'r1', slug: 'pruebas', atributos: { filtros_disponibles: CATALOGO } });
	setProductos([{ id: 'p1', nombre: 'Papas', atributos: { filtros: ['picante'] } }]);
}

// Sidebar y Carrito: sin barra de categorías, y main marcado por la cabecera.
function conCabeceraFija() {
	nodos = {};
	nodos.navSticky = nodo('navSticky');
	nodos.navSticky.style.display = 'none';
	nodos.mainContent = nodo('mainContent');
	nodos.mainContent.classList.add('with-fixed-header');
}

const filaSuelta = () => nodos.filtrosSueltos;

describe('la fila de chips con cabecera fija (Sidebar y Carrito)', () => {
	beforeEach(() => { conCabeceraFija(); conFiltros(); });

	test('se cuelga justo antes del contenido, que es lo único que no se repinta', () => {
		montarChips(() => {});
		assert.deepEqual(nodos.mainContent.insertados.map(([d]) => d), ['beforebegin']);
	});

	test('lleva la clase que la baja hasta debajo de la cabecera', () => {
		montarChips(() => {});
		const fila = filaSuelta();
		assert.match(fila.className, /\bnav-filtros-bajo-fijo\b/,
			'sin esta clase la fila queda tapada por la cabecera fija');
		assert.match(fila.className, /\bnav-filtros\b/, 'y conserva las de siempre');
		assert.match(fila.className, /\bnav-filtros-sueltos\b/);
	});

	test('los chips acaban dentro de ella', () => {
		montarChips(() => {});
		assert.equal(filaSuelta().hijos.length, 1);
		assert.equal(filaSuelta().hijos[0].textContent, '🌶 Picante');
	});
});

describe('la fila de chips sin cabecera fija', () => {
	beforeEach(() => {
		nodos = {};
		nodos.navSticky = nodo('navSticky');
		nodos.navSticky.style.display = 'none';
		nodos.mainContent = nodo('mainContent');   // sin with-fixed-header
		conFiltros();
	});

	test('no se baja: no hay nada arriba que la tape', () => {
		// Bajarla de todos modos dejaría 60 px en blanco sobre la carta.
		montarChips(() => {});
		assert.doesNotMatch(filaSuelta().className, /nav-filtros-bajo-fijo/);
	});
});

describe('Topnav sigue metiendo los chips en su barra', () => {
	test('con la nav horizontal a la vista no se crea fila suelta', () => {
		nodos = {};
		nodos.navSticky = nodo('navSticky');
		nodos.navSticky.style.display = 'block';
		nodos.navFiltros = nodo('navFiltros');
		nodos.mainContent = nodo('mainContent');
		conFiltros();

		montarChips(() => {});
		assert.equal(nodos.navFiltros.hijos.length, 1);
		assert.equal(nodos.mainContent.insertados.length, 0);
	});
});

describe('el CSS que hace visible la fila', () => {
	const css = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

	test('la baja y la deja pegada bajo la cabecera', () => {
		const regla = css.match(/\.nav-filtros-bajo-fijo:not\(:empty\)\s*\{[^}]*\}/);
		assert.ok(regla, 'falta la regla de la fila bajo cabecera fija');
		assert.match(regla[0], /position:\s*sticky/);
		assert.match(regla[0], /top:\s*60px/);
		assert.match(regla[0], /margin-top:\s*60px/);
		// Por debajo de la cabecera (100) y por encima de la carta.
		assert.match(regla[0], /z-index:\s*99/);
		// Sin fondo, la carta se vería pasar por debajo de los chips.
		assert.match(regla[0], /background:/);
	});

	test('y le quita a main su margen para no sumar dos veces', () => {
		assert.match(
			css,
			/\.nav-filtros-bajo-fijo:not\(:empty\)\s*\+\s*main\.with-fixed-header\s*\{[^}]*margin-top:\s*0/,
			'sin esto quedan 60 px en blanco entre los chips y el primer plato',
		);
	});
});
