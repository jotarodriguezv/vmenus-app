// La oferta de precio de un plato: la regla, lo que pinta la carta y lo que
// cobra el carrito. La cartelera del televisor aplica la misma regla en otro
// dialecto, y se comprueba aquí contra el mismo juego de casos.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// El carrito toca localStorage y el DOM; se preparan ANTES de importarlo.
const almacen = new Map();
globalThis.localStorage = {
	getItem: k => almacen.has(k) ? almacen.get(k) : null,
	setItem: (k, v) => almacen.set(k, String(v)),
	removeItem: k => almacen.delete(k),
};
globalThis.document = { getElementById: () => null };
// analytics.js mira ?preview en la URL antes de registrar nada.
globalThis.window = { location: { search: '' } };
globalThis.fetch = () => Promise.resolve({ ok: true });

const { estadoOferta, precioVigente, hoyDeOfertas, fijarZonaDeOfertas, formatoPesos } = await import('../core/ofertas.js');
const { htmlPrecio, textoPrecio } = await import('../core/html.js');
const { setRestaurante, setProductos } = await import('../core/menu.js');
const { revalidarCarrito, agregarSimple } = await import('../core/carrito.js');

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CASOS = JSON.parse(readFileSync(join(RAIZ, 'test', 'casos-oferta.json'), 'utf8'));
const TV = readFileSync(join(RAIZ, 'tv.html'), 'utf8');
const GUION = TV.slice(TV.indexOf('<script>') + 8, TV.indexOf('</script>'));

// ═══════════════════════════════════════════════════════════════
describe('la regla · el mismo juego de casos que el panel y la cartelera', () => {
	// La regla vive en TRES sitios y ninguno puede importar a los otros: esta
	// carta, la cartelera del televisor (dialecto viejo dentro de tv.html) y el
	// espejo del panel (otro repositorio). Si se separan, el panel dice que la
	// oferta rige y la carta cobra el precio de siempre.
	test('hay casos que correr', () => assert.ok(CASOS.casos.length >= 10));

	for (const c of CASOS.casos) {
		test(`carta · ${c.nombre}`, () => {
			assert.equal(estadoOferta(c.plato, c.hoy), c.estado);
			assert.equal(precioVigente(c.plato, c.hoy), c.precio);
		});
	}

	// Se saca la función del guion y se evalúa: el código que se despliega, no una
	// copia.
	const cartelera = () => {
		const ctx = vm.createContext({ Number, isNaN });
		const i = GUION.indexOf('function estadoOferta(');
		assert.notEqual(i, -1, 'no se encontró estadoOferta() en tv.html — ¿se renombró?');
		vm.runInContext(GUION.slice(i, GUION.indexOf('\n}', i) + 2), ctx);
		return ctx;
	};

	for (const c of CASOS.casos) {
		test(`cartelera · ${c.nombre}`, () => {
			assert.equal(cartelera().estadoOferta(c.plato, c.hoy), c.estado);
		});
	}
});

// ═══════════════════════════════════════════════════════════════
describe('«hoy» se cuenta en la zona del restaurante', () => {
	beforeEach(() => fijarZonaDeOfertas('America/Bogota'));

	test('el último día rige hasta que acaba en SU zona, no en la del visitante', () => {
		// 23:30 del 24 en Bogotá ya es el 25 en Madrid. Quien mira la carta con el
		// móvil en España no puede ver terminada una oferta que en el restaurante
		// todavía rige.
		const instante = new Date('2026-12-24T23:30:00-05:00');
		assert.equal(hoyDeOfertas(instante), '2026-12-24');
		fijarZonaDeOfertas('Europe/Madrid');
		assert.equal(hoyDeOfertas(instante), '2026-12-25');
	});

	test('una zona inválida no tumba la carta: cae en Bogotá', () => {
		fijarZonaDeOfertas('Marte/Olympus');
		assert.match(hoyDeOfertas(), /^\d{4}-\d{2}-\d{2}$/);
	});

	test('cargar el restaurante fija la zona de las ofertas', () => {
		setRestaurante({ id: 'r1', slug: 'x', atributos: { zona_horaria: 'Europe/Madrid' } });
		assert.equal(hoyDeOfertas(new Date('2026-12-24T23:30:00-05:00')), '2026-12-25');
		setRestaurante({ id: 'r1', slug: 'x', atributos: {} });
		assert.equal(hoyDeOfertas(new Date('2026-12-24T23:30:00-05:00')), '2026-12-24');
	});
});

// ═══════════════════════════════════════════════════════════════
describe('lo que enseña la carta', () => {
	const plato = (extra = {}) => ({ nombre: 'Hamburguesa', precio: '$ 50.000', precio_numerico: 50000, atributos: {},
		oferta_activa: true, oferta_precio_numerico: 40000, ...extra });

	test('con la oferta vigente: el de siempre tachado y el nuevo', () => {
		const h = htmlPrecio(plato());
		assert.match(h, /<s class="precio-antes">\$ 50\.000<\/s>/);
		assert.match(h, /<span class="precio-oferta">\$ 40\.000<\/span>/);
	});

	test('sin oferta, o fuera de fechas, es el precio de siempre y nada más', () => {
		assert.equal(htmlPrecio(plato({ oferta_activa: false })), '$ 50.000');
		assert.equal(htmlPrecio(plato({ oferta_hasta: '2020-01-01' })), '$ 50.000');
		assert.equal(htmlPrecio(plato({ oferta_desde: '2999-01-01' })), '$ 50.000');
	});

	test('«Gratis» manda sobre la oferta', () => {
		assert.equal(htmlPrecio(plato({ atributos: { precio_gratis: true } })), 'Gratis');
	});

	test('lo que escribe un restaurante va escapado', () => {
		// 'precio' lo escribe el panel, pero nada impide que llegue otra cosa.
		const h = htmlPrecio(plato({ precio: '<img src=x onerror=alert(1)>' }));
		assert.doesNotMatch(h, /<img/);
		assert.match(h, /&lt;img/);
	});

	test('textoPrecio sigue diciendo el precio normal: no es lo que se pinta', () => {
		assert.equal(textoPrecio(plato()), '$ 50.000');
	});

	test('el formato de pesos es el que escribe el panel', () => {
		assert.equal(formatoPesos(40000), '$ 40.000');
		assert.equal(formatoPesos(1234567), '$ 1.234.567');
		assert.equal(formatoPesos(900), '$ 900');
	});
});

// ═══════════════════════════════════════════════════════════════
describe('lo que cobra el carrito', () => {
	// Aquí se toca dinero: mostrar $ 40.000 y cobrar $ 50.000 es el fallo que
	// motivó precios.js en el panel.
	const CLAVE = 'pruebas_oferta_cart';
	const leido = () => JSON.parse(almacen.get(CLAVE));
	const conOferta = (extra = {}) => ({ id: 'h', nombre: 'Hamburguesa', precio: '$ 50.000', precio_numerico: 50000,
		categoria_id: 'c1', atributos: {}, oferta_activa: true, oferta_precio_numerico: 40000, ...extra });

	beforeEach(() => {
		almacen.clear();
		setRestaurante({ id: 'r1', slug: 'pruebas_oferta', atributos: {} });
		setProductos([]);
	});

	test('un plato en oferta entra al carrito al precio de oferta', () => {
		const p = conOferta();
		setProductos([p]);
		agregarSimple(p);
		assert.equal(leido().items[0].price, 40000);
	});

	test('sin oferta vigente entra al precio normal', () => {
		// Otro id: el carrito es estado del módulo y una línea que ya estaba en él
		// solo suma cantidad, conservando su precio.
		const p = conOferta({ id: 'h2', oferta_hasta: '2020-01-01' });
		setProductos([p]);
		agregarSimple(p);
		assert.equal(leido().items.find(i => i.id === 'h2').price, 50000);
	});

	test('al volver, una línea que terminó su oferta se reprecia y se avisa', () => {
		// Entró a $ 40.000 ayer; hoy la oferta ya terminó.
		setProductos([conOferta({ oferta_hasta: '2020-01-01' })]);
		const r = revalidarCarrito([{ id: 'h', name: 'Hamburguesa', price: 40000, extras: 0, cantidad: 1 }]);
		assert.equal(r.vivos[0].price, 50000);
		assert.equal(r.reprecio.length, 1);
		assert.deepEqual([r.reprecio[0].antes, r.reprecio[0].ahora], [40000, 50000]);
	});

	test('y una que acaba de empezar baja el precio de una línea que ya estaba', () => {
		setProductos([conOferta()]);
		const r = revalidarCarrito([{ id: 'h', name: 'Hamburguesa', price: 50000, extras: 0, cantidad: 2 }]);
		assert.equal(r.vivos[0].price, 40000);
		assert.equal(r.reprecio.length, 1);
	});
});

// ═══════════════════════════════════════════════════════════════
describe('la cartelera del televisor', () => {
	test('pide las columnas de la oferta, y el precio numérico con que se compara', () => {
		for (const col of ['precio_numerico', 'oferta_activa', 'oferta_precio_numerico', 'oferta_desde', 'oferta_hasta'])
			assert.ok(GUION.includes(col), `la consulta de productos no pide ${col}`);
	});

	test('pinta las dos pantallas de platos con pintarPrecio, no con el texto crudo', () => {
		assert.equal(GUION.match(/pintarPrecio\(/g).length, 3, 'la definición y las dos pantallas (lista y plato)');
		// Las dos únicas asignaciones del texto crudo viven DENTRO de pintarPrecio.
		assert.doesNotMatch(GUION, /(precioLista|pre)\.textContent = /);
	});

	test('el sondeo reconstruye también cuando solo cambia el reloj', () => {
		// Cuando cruza la medianoche de un último día no cambia ningún dato.
		assert.match(GUION, /firmaDeOfertas\(\) !== antes|\+ '\|' \+ firmaDeOfertas\(\) !== antes/);
	});
});
