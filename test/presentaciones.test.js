// Las presentaciones de un plato (1X / 2X, 500 ml / 750 ml): un mismo plato con varios precios.
// La regla de cómo se ESCRIBEN vive en core/presentaciones.js y en tv.html (dialecto viejo, para
// televisores que nadie puede depurar), y las dos corren contra el MISMO juego de casos,
// test/casos-presentaciones.json.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// El carrito toca localStorage y el DOM: se preparan antes de importar los módulos.
const almacen = new Map();
globalThis.localStorage = { getItem: k => (almacen.has(k) ? almacen.get(k) : null), setItem: (k, v) => almacen.set(k, String(v)), removeItem: k => almacen.delete(k) };
globalThis.document = { getElementById: () => null };
globalThis.fetch = () => Promise.resolve({ ok: true });

const {
	presentacionesDe, tienePresentaciones, presentacionPorId, masBarata, textoPresentaciones,
	claveDeLinea, nombreConPresentacion, MIN_PRESENTACIONES,
} = await import('../core/presentaciones.js');
const { htmlPrecio, htmlListaPresentaciones } = await import('../core/html.js');
const { setRestaurante, setProductos } = await import('../core/menu.js');
const { revalidarCarrito, tienePersonalizacion } = await import('../core/carrito.js');

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CASOS = JSON.parse(readFileSync(join(RAIZ, 'test', 'casos-presentaciones.json'), 'utf8')).casos;
const HTML = readFileSync(join(RAIZ, 'tv.html'), 'utf8').replace(/\r\n/g, '\n');
const GUION = HTML.slice(HTML.indexOf('<script>') + 8, HTML.indexOf('</script>'));

function extraer(nombres, contexto = {}) {
	const ctx = vm.createContext(contexto);
	for (const n of nombres) {
		const i = GUION.indexOf('function ' + n + '(');
		assert.notEqual(i, -1, `no se encontró ${n}() en tv.html — ¿se renombró?`);
		vm.runInContext(GUION.slice(i, GUION.indexOf('\n}', i) + 2), ctx);
	}
	return ctx;
}
const enLaTv = extraer(['formatoPesos', 'presentacionesDe', 'textoPresentaciones']).textoPresentaciones;

describe('cómo se escriben las presentaciones · el mismo juego de casos en la carta y en la cartelera', () => {
	for (const [nombre, f] of [['la carta (core/presentaciones.js)', textoPresentaciones], ['la cartelera (tv.html)', enLaTv]]) {
		describe(nombre, () => {
			for (const c of CASOS) test(c.nombre, () => assert.equal(f(c.producto), c.esperado));
		});
	}
	test('el archivo de casos no se ha quedado vacío', () => assert.ok(CASOS.length >= 8));
});

const FRESAS = {
	id: 'f', nombre: 'Fresas con crema', precio: '$ 12.000', precio_numerico: 12000,
	atributos: { presentaciones: [{ id: 'p1', nombre: '1X', precio_numerico: 12000 }, { id: 'p2', nombre: '2X', precio_numerico: 20000 }] },
};

describe('presentacionesDe y ayudantes', () => {
	test('un plato con dos o más tiene presentaciones; con una o ninguna, no', () => {
		assert.equal(tienePresentaciones(FRESAS), true);
		assert.equal(tienePresentaciones({ atributos: {} }), false);
		assert.equal(tienePresentaciones(null), false);
		assert.equal(MIN_PRESENTACIONES, 2);
	});
	test('por id y la más barata', () => {
		assert.equal(presentacionPorId(FRESAS, 'p2').nombre, '2X');
		assert.equal(presentacionPorId(FRESAS, 'nada'), null);
		assert.equal(masBarata(FRESAS).id, 'p1');
		assert.equal(masBarata({}), null);
	});
	test('un id que falta se toma del nombre', () => {
		const p = { atributos: { presentaciones: [{ nombre: 'A', precio_numerico: 1 }, { nombre: 'B', precio_numerico: 2 }] } };
		assert.deepEqual(presentacionesDe(p).map(x => x.id), ['A', 'B']);
	});
	test('la clave de una línea: sin presentación, la de siempre', () => {
		assert.equal(claveDeLinea('f', '', 'sin cebolla'), 'f__sin cebolla');
		assert.equal(claveDeLinea('f', undefined, ''), 'f__');
		assert.equal(claveDeLinea('f', 'p2', ''), 'f~p2__');
		assert.notEqual(claveDeLinea('f', 'p1', ''), claveDeLinea('f', 'p2', ''));
	});
	test('el nombre del pedido lleva la presentación', () => {
		assert.equal(nombreConPresentacion('Fresas con crema', { nombre: '2X' }), 'Fresas con crema · 2X');
		assert.equal(nombreConPresentacion('Fresas con crema', null), 'Fresas con crema');
	});
});

describe('el precio que se pinta (htmlPrecio)', () => {
	test('con presentaciones: la lista, escapada', () => {
		assert.equal(htmlPrecio(FRESAS), '1X $ 12.000 · 2X $ 20.000');
		const mala = { atributos: { presentaciones: [{ id: 'a', nombre: '<b>1X</b>', precio_numerico: 1 }, { id: 'b', nombre: '2X', precio_numerico: 2 }] } };
		assert.ok(!htmlPrecio(mala).includes('<b>'), 'el nombre no puede abrir una etiqueta');
	});
	test('la oferta de precio se ignora con presentaciones: no distingue cuál', () => {
		const conOferta = { ...FRESAS, oferta_activa: true, oferta_precio_numerico: 5000 };
		assert.equal(htmlPrecio(conOferta), '1X $ 12.000 · 2X $ 20.000');
		assert.ok(!htmlPrecio(conOferta).includes('<s '));
	});
	test('«Gratis» manda, como siempre', () => {
		assert.equal(htmlPrecio({ ...FRESAS, atributos: { ...FRESAS.atributos, precio_gratis: true } }), 'Gratis');
	});
	test('un plato sin presentaciones se pinta como siempre', () => {
		assert.equal(htmlPrecio({ precio: '$ 9.000', precio_numerico: 9000, atributos: {} }), '$ 9.000');
	});
});

describe('el botón de agregar de un plato con presentaciones', () => {
	test('se elige antes de sumarlo: el plato «se personaliza»', () => {
		assert.equal(tienePersonalizacion(FRESAS), true);
		assert.equal(tienePersonalizacion({ id: 'x', atributos: {} }), false);
	});
});

describe('el carrito y las presentaciones (revalidarCarrito)', () => {
	beforeEach(() => {
		almacen.clear();
		setRestaurante({ id: 'r1', slug: 'pruebas', atributos: {} });
		setProductos([FRESAS]);
	});
	const linea = (extra = {}) => ({
		cartKey: claveDeLinea('f', 'p2', ''), id: 'f', name: 'Fresas con crema · 2X', price: 20000, extras: 0, cantidad: 2,
		descripcion: '', sel: { platino: [], premium: [], salsas: [] }, pres: { id: 'p2', nombre: '2X' }, ...extra,
	});

	test('una línea con su presentación al día no cambia', () => {
		const r = revalidarCarrito([linea()]);
		assert.equal(r.vivos.length, 1);
		assert.equal(r.reprecio.length, 0);
		assert.equal(r.vivos[0].price, 20000);
		assert.equal(r.vivos[0].name, 'Fresas con crema · 2X');
		assert.equal(r.vivos[0].cartKey, 'f~p2__');
	});

	test('si el restaurante cambió el precio de ESA presentación, la línea se reprecia y se avisa', () => {
		setProductos([{ ...FRESAS, atributos: { presentaciones: [{ id: 'p1', nombre: '1X', precio_numerico: 12000 }, { id: 'p2', nombre: '2X', precio_numerico: 22000 }] } }]);
		const r = revalidarCarrito([linea()]);
		assert.equal(r.vivos[0].price, 22000);
		assert.deepEqual(r.reprecio.map(x => [x.antes, x.ahora]), [[20000, 22000]]);
	});

	test('el precio de la OTRA presentación no contamina a la línea (no se cobra el base)', () => {
		const r = revalidarCarrito([linea({ price: 99999 })]);
		assert.equal(r.vivos[0].price, 20000, 'no es el de 1X ($12.000) ni el que traía');
	});

	test('si el restaurante renombró la presentación, la línea lleva el nombre de hoy', () => {
		setProductos([{ ...FRESAS, atributos: { presentaciones: [{ id: 'p1', nombre: '1X', precio_numerico: 12000 }, { id: 'p2', nombre: 'Doble', precio_numerico: 20000 }] } }]);
		const r = revalidarCarrito([linea()]);
		assert.equal(r.vivos[0].name, 'Fresas con crema · Doble');
		assert.equal(r.vivos[0].pres.nombre, 'Doble');
	});

	test('si el restaurante QUITÓ esa presentación, la línea se retira y se dice', () => {
		setProductos([{ ...FRESAS, atributos: { presentaciones: [{ id: 'p1', nombre: '1X', precio_numerico: 12000 }, { id: 'p3', nombre: '3X', precio_numerico: 27000 }] } }]);
		const r = revalidarCarrito([linea()]);
		assert.equal(r.vivos.length, 0);
		assert.deepEqual(r.retirados, ['Fresas con crema · 2X']);
	});

	test('dos presentaciones del mismo plato son dos líneas, no una', () => {
		const r = revalidarCarrito([linea(), linea({ cartKey: 'f~p1__', price: 12000, name: 'Fresas con crema · 1X', pres: { id: 'p1', nombre: '1X' }, cantidad: 1 })]);
		assert.equal(r.vivos.length, 2);
		assert.deepEqual(r.vivos.map(v => v.price).sort(), [12000, 20000]);
	});

	test('una línea de un plato SIN presentaciones sigue exactamente igual', () => {
		setProductos([{ id: 'h', nombre: 'Hamburguesa', precio_numerico: 20000, categoria_id: 'c1', atributos: {} }]);
		const r = revalidarCarrito([{ id: 'h', name: 'Hamburguesa', price: 18000, extras: 0, cantidad: 1 }]);
		assert.equal(r.vivos[0].price, 20000);
		assert.equal(r.vivos[0].cartKey, undefined, 'no se le inventa una clave');
	});
});

describe('htmlListaPresentaciones · la lista de Explorar', () => {
	test('un renglón por presentación, con el nombre escapado', () => {
		const html = htmlListaPresentaciones({ atributos: { presentaciones: [
			{ id: 'a', nombre: '1X', precio_numerico: 12000 }, { id: 'b', nombre: '<b>2X</b>', precio_numerico: 20000 }] } });
		assert.equal((html.match(/<li>/g) || []).length, 2);
		assert.match(html, /1X<\/span><span class="pres-precio">\$ 12\.000/);
		assert.ok(!html.includes('<b>'), 'el nombre se escapa');
	});

	test('sin presentaciones (o con una sola) no hay lista', () => {
		assert.equal(htmlListaPresentaciones({ atributos: {} }), '');
		assert.equal(htmlListaPresentaciones({ atributos: { presentaciones: [{ id: 'a', nombre: '1X', precio_numerico: 1 }] } }), '');
	});
});
