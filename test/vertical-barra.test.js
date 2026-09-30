// La barra de arriba del modelo Vertical (30/09/2026). Eran tres filas —
// categorías, filtros y buscador— que se comían 148 px de 844. Ahora es una:
// las categorías y una lupa, y el buscador y los filtros viven juntos detrás
// de ella. Lo que estas pruebas cuidan es lo que podía salir mal al esconderlos:
// que la lupa exista solo si hay algo detrás, que el panel abra y cierre, y
// que una carta acotada con el panel cerrado lo diga, porque si no parecería
// una carta a la que le faltan platos.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ── Un DOM falso con lo justo: lo que no se registró no existe ─
function nodo() {
	const n = {
		style: {}, dataset: {}, atributos: {}, hijos: [], oyentes: {}, onclick: null, hidden: false,
		_html: '', textContent: '', className: '', value: '', tabIndex: -1, enfocado: false,
		set innerHTML(v) { this._html = v; this.hijos = []; }, get innerHTML() { return this._html; },
		setAttribute(k, v) { this.atributos[k] = String(v); },
		getAttribute(k) { return this.atributos[k] ?? null; },
		appendChild(h) { this.hijos.push(h); return h; },
		append(...hs) { this.hijos.push(...hs); },
		addEventListener(ev, fn) { (this.oyentes[ev] ||= []).push(fn); },
		insertAdjacentHTML() {}, insertAdjacentElement(_, el) { if (el.id) nodos[el.id] = el; },
		querySelector: () => null, querySelectorAll: () => [],
		replaceWith() {}, remove() {}, scrollIntoView() {},
		focus() { this.enfocado = true; },
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
	// Los nodos que en el navegador crea el HTML de la barra. El documento
	// verdadero los encontraría por id una vez insertada; aquí se registran.
	nodos = {};
	for (const id of ['mainContent', 'verSegmentos', 'verCats', 'verLupa', 'verBusqueda', 'verBuscador', 'verFiltros']) {
		nodos[id] = nodo();
	}
	nodos.verBusqueda.hidden = true;
	nodos.verLupa.hidden = true;
	globalThis.document = {
		getElementById: id => nodos[id] || null,
		createElement: () => nodo(),
		querySelector: () => null,
		querySelectorAll: () => [],
		addEventListener() {},
		body: nodo(),
	};
}

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.window = { location: { search: '?preview=1' }, addEventListener() {}, scrollY: 0 };
globalThis.IntersectionObserver = class { observe() {} };
documentoNuevo();

const { setRestaurante, setCategorias, setProductos } = await import('../core/menu.js');
const { filtrosActivos } = await import('../core/filtros.js');
const { fijarTermino } = await import('../core/buscador.js');
const vertical = await import('../temas/vertical.js');

const CAT = { id: 'c1', nombre: 'BURGERS' };
const FILTROS = [{ id: 'picante', label: 'Picante', emoji: '🌶' }];

function plato(i, filtros = []) {
	return { id: 'p' + i, nombre: 'Plato ' + i, precio: '$ 10.000', precio_numerico: 10000, categoria_id: 'c1',
		imagen_url: '/uploads/x.jpg', disponible: true, atributos: { filtros } };
}

// `cuantos` platos; con `conFiltro`, el primero lleva la etiqueta «picante».
function montar({ cuantos, conFiltro = false }) {
	setRestaurante({ id: 'r1', slug: 'pruebas', nombre: 'Pruebas',
		atributos: { nav: 'vertical', plan: 'video', filtros_disponibles: conFiltro ? FILTROS : [] } });
	setCategorias([CAT]);
	setProductos(Array.from({ length: cuantos }, (_, i) => plato(i, conFiltro && i === 0 ? ['picante'] : [])));
	vertical.buildNav();
	vertical.buildMenu();
}

const lupa = () => nodos.verLupa;
const panel = () => nodos.verBusqueda;

beforeEach(() => {
	documentoNuevo();
	filtrosActivos.clear();
	fijarTermino('');
});

describe('La lupa solo existe si hay algo detrás', () => {
	test('una carta corta y sin filtros no la lleva: se lee de un vistazo', () => {
		montar({ cuantos: 3 });
		assert.equal(lupa().hidden, true);
	});

	test('con buscador (8 platos o más) aparece', () => {
		montar({ cuantos: 9 });
		assert.equal(lupa().hidden, false);
	});

	test('con un filtro en uso aparece aunque la carta sea corta', () => {
		montar({ cuantos: 3, conFiltro: true });
		assert.equal(lupa().hidden, false);
	});
});

describe('El panel del buscador y los filtros', () => {
	test('la barra lleva la lupa junto a las categorías y el panel cerrado, con el buscador antes que los filtros', () => {
		montar({ cuantos: 9, conFiltro: true });
		// El chrome se crea con createElement y se inserta junto a mainContent.
		const chrome = Object.values(nodos).find(n => n.className === 'ver-chrome');
		const marcado = chrome.innerHTML;
		assert.match(marcado, /id="verCats"[\s\S]*id="verLupa"[\s\S]*id="verBusqueda" hidden[\s\S]*id="verBuscador"[\s\S]*id="verFiltros"/);
		assert.match(marcado, /id="verLupa"[\s\S]*?aria-expanded="false"[\s\S]*?aria-controls="verBusqueda"/);
	});

	test('tocar la lupa abre el panel, avisa con aria-expanded y pone el cursor en el buscador; otro toque lo cierra', () => {
		montar({ cuantos: 9 });
		// El buscador se monta dentro del panel: su input es el primer nieto.
		const input = nodos.verBuscador.hijos[0].hijos[0];
		lupa().onclick();
		assert.equal(panel().hidden, false);
		assert.equal(lupa().getAttribute('aria-expanded'), 'true');
		assert.ok(lupa().classList.contains('abierta'));
		lupa().onclick();
		assert.equal(panel().hidden, true);
		assert.equal(lupa().getAttribute('aria-expanded'), 'false');
		assert.ok(!lupa().classList.contains('abierta'));
		assert.ok(input, 'el buscador está montado dentro del panel');
	});

	test('montar la barra otra vez no duplica el escuchador de la lupa', () => {
		montar({ cuantos: 9 });
		const primero = lupa().onclick;
		vertical.buildNav();
		assert.equal(lupa().onclick, primero);
	});
});

describe('Con el panel cerrado, la lupa dice si hay algo puesto', () => {
	test('activar un filtro la marca y quitarlo la limpia', () => {
		montar({ cuantos: 3, conFiltro: true });
		assert.ok(!lupa().classList.contains('con-filtro'));
		const chip = nodos.verFiltros.hijos[0];
		chip.onclick();
		assert.ok(lupa().classList.contains('con-filtro'));
		assert.match(lupa().getAttribute('aria-label'), /hay algo puesto/);
		chip.onclick();
		assert.ok(!lupa().classList.contains('con-filtro'));
		assert.equal(lupa().getAttribute('aria-label'), 'Buscar y filtrar');
	});

	test('escribir en el buscador la marca y borrarlo la limpia', () => {
		montar({ cuantos: 9 });
		const input = nodos.verBuscador.hijos[0].hijos[0];
		input.value = 'plato';
		input.oyentes.input[0]();
		assert.ok(lupa().classList.contains('con-filtro'));
		input.value = '';
		input.oyentes.input[0]();
		assert.ok(!lupa().classList.contains('con-filtro'));
	});

	test('una búsqueda de solo espacios no cuenta como algo puesto', () => {
		montar({ cuantos: 9 });
		const input = nodos.verBuscador.hijos[0].hijos[0];
		input.value = '   ';
		input.oyentes.input[0]();
		assert.ok(!lupa().classList.contains('con-filtro'));
	});
});
