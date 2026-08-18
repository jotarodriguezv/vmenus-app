// Carrito: es donde vive el dinero. Un fallo aquí no rompe la página, hace
// que al restaurante le llegue un pedido con el precio equivocado.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// El carrito toca localStorage y el DOM. Se preparan ANTES de importar el
// módulo, aunque solo se usen dentro de las funciones.
const almacen = new Map();
globalThis.localStorage = {
	getItem: k => almacen.has(k) ? almacen.get(k) : null,
	setItem: (k, v) => almacen.set(k, String(v)),
	removeItem: k => almacen.delete(k),
};
// Devolver null en todo hace que updateCartUI y el aviso salgan sin tocar nada.
globalThis.document = { getElementById: () => null };

const { setRestaurante, setProductos } = await import('../core/menu.js');
const { revalidarCarrito, recargoPremium, loadCartFromStorage } = await import('../core/carrito.js');

const P = (id, nombre, precio) => ({ id, nombre, precio_numerico: precio, categoria_id: 'c1' });
const CLAVE = 'pruebas_cart';
const HORA = 3600 * 1000;
const guardar = obj => almacen.set(CLAVE, JSON.stringify(obj));
const leido = () => almacen.has(CLAVE) ? JSON.parse(almacen.get(CLAVE)) : null;

beforeEach(() => {
	almacen.clear();
	setRestaurante({ id: 'r1', slug: 'pruebas', atributos: {} });
	setProductos([]);
});

describe('revalidarCarrito', () => {
	test('el precio se refresca contra el menú de hoy', () => {
		// El caso real: el carrito duerme en el móvil del cliente, el
		// restaurante sube el precio, el cliente vuelve días después.
		setProductos([P('h', 'HAMBURGUESA', 25000)]);
		const r = revalidarCarrito([{ id: 'h', name: 'HAMBURGUESA', price: 20000, extras: 0, cantidad: 2 }]);

		assert.equal(r.vivos[0].price, 25000, 'debe cobrarse el precio actual');
		assert.equal(r.vivos[0].cantidad, 2, 'la cantidad elegida se respeta');
		assert.deepEqual(r.reprecio, [{ nombre: 'HAMBURGUESA', antes: 20000, ahora: 25000 }]);
	});

	test('el recargo de los toppings sobrevive al recálculo', () => {
		// Si solo se tomara el precio base, una hamburguesa con tocineta
		// perdería el recargo y el restaurante cobraría de menos.
		setProductos([P('h', 'HAMBURGUESA', 25000)]);
		const r = revalidarCarrito([{ id: 'h', name: 'HAMBURGUESA', price: 23000, extras: 3000, cantidad: 1 }]);
		assert.equal(r.vivos[0].price, 28000, '25.000 de base + 3.000 de topping');
	});

	test('un precio a la baja también se refleja', () => {
		setProductos([P('h', 'HAMBURGUESA', 18000)]);
		const r = revalidarCarrito([{ id: 'h', name: 'HAMBURGUESA', price: 25000, extras: 0, cantidad: 1 }]);
		assert.equal(r.vivos[0].price, 18000, 'a favor del cliente');
	});

	test('lo que ya no está en el menú se retira y se nombra', () => {
		// 'productos' llega filtrado por disponibilidad y horario, así que
		// esto cubre agotados, borrados y fuera de franja.
		setProductos([P('h', 'HAMBURGUESA', 25000)]);
		const r = revalidarCarrito([
			{ id: 'h', name: 'HAMBURGUESA', price: 25000, extras: 0, cantidad: 1 },
			{ id: 'x', name: 'PERRO CALIENTE', price: 12000, extras: 0, cantidad: 3 },
		]);
		assert.deepEqual(r.vivos.map(i => i.id), ['h']);
		assert.deepEqual(r.retirados, ['PERRO CALIENTE']);
	});

	test('el nombre se refresca si cambió en el panel', () => {
		setProductos([P('h', 'HAMBURGUESA DOBLE', 25000)]);
		const r = revalidarCarrito([{ id: 'h', name: 'HAMBURGUESA', price: 25000, extras: 0, cantidad: 1 }]);
		assert.equal(r.vivos[0].name, 'HAMBURGUESA DOBLE');
	});

	test('sin cambios no se molesta al cliente con avisos', () => {
		setProductos([P('h', 'HAMBURGUESA', 25000)]);
		const r = revalidarCarrito([{ id: 'h', name: 'HAMBURGUESA', price: 25000, extras: 0, cantidad: 1 }]);
		assert.equal(r.reprecio.length, 0);
		assert.equal(r.retirados.length, 0);
	});

	test('datos corruptos no revientan el cálculo', () => {
		setProductos([P('h', 'HAMBURGUESA', 25000)]);
		const r = revalidarCarrito([{ id: 'h', name: 'X', price: 25000, extras: 'basura', cantidad: 1 }]);
		assert.equal(r.vivos[0].price, 25000, 'un extras no numérico vale 0');
		assert.deepEqual(revalidarCarrito([]).vivos, []);
	});
});

describe('recargoPremium', () => {
	const catalogo = { toppings_premium: [
		{ nombre: 'Tocineta', precio: 4000 },
		{ nombre: 'Queso fundido', precio: 4000 },
	] };

	test('suma lo marcado', () => {
		assert.equal(recargoPremium(catalogo, new Set()), 0);
		assert.equal(recargoPremium(catalogo, new Set(['Tocineta'])), 4000);
		assert.equal(recargoPremium(catalogo, new Set(['Tocineta', 'Queso fundido'])), 8000);
	});

	test('un catálogo con el nombre repetido NO cobra dos veces', () => {
		// El panel ya impide crear duplicados, pero lo guardado de antes no
		// debe cobrarle de más al cliente.
		const conDuplicado = { toppings_premium: [
			{ nombre: 'Tocineta', precio: 4000 },
			{ nombre: 'Queso fundido', precio: 4000 },
			{ nombre: 'Tocineta', precio: 4000 },
		] };
		assert.equal(recargoPremium(conDuplicado, new Set(['Tocineta'])), 4000, 'marcado una vez, cobrado una vez');
	});

	test('un precio que no es número no convierte el total en NaN', () => {
		const malo = { toppings_premium: [{ nombre: 'X', precio: 'abc' }] };
		assert.equal(recargoPremium(malo, new Set(['X'])), 0);
	});

	test('producto sin toppings o sin atributos', () => {
		assert.equal(recargoPremium({}, new Set(['X'])), 0);
		assert.equal(recargoPremium(null, new Set(['X'])), 0);
	});
});

describe('loadCartFromStorage · formato guardado', () => {
	test('el formato anterior se descarta en vez de malinterpretarse', () => {
		// Un array suelto no lleva 'extras', así que no se puede recalcular
		// el precio de un personalizado: vale más perder el carrito.
		almacen.set(CLAVE, JSON.stringify([{ id: 'h', price: 20000 }]));
		loadCartFromStorage();
		assert.equal(leido(), null, 'debe quedar limpio');
	});

	test('un JSON corrupto no lanza y deja el almacenamiento limpio', () => {
		almacen.set(CLAVE, '{roto');
		assert.doesNotThrow(() => loadCartFromStorage());
		assert.equal(leido(), null);
	});

	test('sin nada guardado no pasa nada', () => {
		assert.doesNotThrow(() => loadCartFromStorage());
	});
});

describe('loadCartFromStorage · caducidad a las 24 horas', () => {
	test('un carrito reciente se conserva', () => {
		setProductos([P('h', 'HAMBURGUESA', 25000)]);
		guardar({ v: 2, ts: Date.now() - 2 * HORA, items: [{ cartKey: 'h', id: 'h', name: 'HAMBURGUESA', price: 25000, extras: 0, cantidad: 1 }] });
		loadCartFromStorage();
		assert.notEqual(leido(), null, 'no debe borrarse');
	});

	test('pasadas 24 horas se descarta en silencio', () => {
		setProductos([P('h', 'HAMBURGUESA', 25000)]);
		guardar({ v: 2, ts: Date.now() - 25 * HORA, items: [{ cartKey: 'h', id: 'h', name: 'HAMBURGUESA', price: 25000, extras: 0, cantidad: 1 }] });
		loadCartFromStorage();
		assert.equal(leido(), null, 'un pedido de ayer ya no es una intención viva');
	});

	test('la revalidación del sistema NO reinicia el plazo', () => {
		// Si lo reiniciara, bastaría con abrir el menú para que el carrito
		// no caducara nunca.
		setProductos([P('h', 'HAMBURGUESA', 30000)]);   // el precio cambió → habrá reguardado
		const hace23h = Date.now() - 23 * HORA;
		guardar({ v: 2, ts: hace23h, items: [{ cartKey: 'h', id: 'h', name: 'HAMBURGUESA', price: 25000, extras: 0, cantidad: 1 }] });
		loadCartFromStorage();

		const tras = leido();
		assert.equal(tras.items[0].price, 30000, 'se revalidó el precio');
		assert.ok(Math.abs(tras.ts - hace23h) < 60000, 'la marca de tiempo sigue siendo la del cliente');
	});

	test('un carrito guardado sin marca de tiempo se trata como reciente', () => {
		// Los que se guardaron entre despliegues no llevan 'ts'. El cliente
		// no tiene por qué pagar un cambio de formato con su pedido.
		setProductos([P('h', 'HAMBURGUESA', 25000)]);
		guardar({ v: 2, items: [{ cartKey: 'h', id: 'h', name: 'HAMBURGUESA', price: 25000, extras: 0, cantidad: 1 }] });
		loadCartFromStorage();
		assert.notEqual(leido(), null, 'no debe borrarse por no tener fecha');
	});
});
