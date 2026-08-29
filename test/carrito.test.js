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

const { setRestaurante, setProductos, soloDigitos } = await import('../core/menu.js');
const { revalidarCarrito, recargoPremium, loadCartFromStorage, opcionesDe,
        describirSeleccion, leerSeleccion, catalogoDe } = await import('../core/carrito.js');

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

describe('soloDigitos · wa.me no acepta otra cosa', () => {
	// Un número escrito como lo teclea cualquiera arma un enlace que no abre
	// ningún chat, y el fallo no se ve desde el panel: el enlace existe, se
	// pulsa, y WhatsApp contesta que el número no es válido.
	//
	// El checkout ya lo limpiaba desde que costó un pedido; la barra social no,
	// y montaba el wa.me en crudo. Ahora comparten el ayudante.
	test('quita lo que no es dígito', () => {
		assert.equal(soloDigitos('+57 300 123 4567'), '573001234567');
		assert.equal(soloDigitos('(57) 300-123-4567'), '573001234567');
		assert.equal(soloDigitos('573001234567'), '573001234567', 'uno limpio no se toca');
	});

	test('lo vacío o ausente da cadena vacía, no "null"', () => {
		// Si devolviera la cadena "null" o "undefined", la barra social pintaría
		// un botón de WhatsApp que lleva a ninguna parte.
		for (const v of ['', null, undefined, '   ', '+- ()'])
			assert.equal(soloDigitos(v), '', `con ${JSON.stringify(v)}`);
	});
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

	// ── EL RECARGO SE RECALCULA CONTRA EL CATÁLOGO DE HOY ─────
	// Antes se cogía de lo guardado, y ahí se colaba el mismo fallo que motivó
	// subir el catálogo al restaurante: el precio base se refrescaba y el de
	// los toppings no.
	const CAT_TOPPINGS = {
		toppings_platino: [{ id: 't_que', nombre: 'Queso' }],
		toppings_premium: [{ id: 't_toc', nombre: 'Tocineta', precio: 4000 }],
		salsas: [],
	};
	const conToppings = (extra = {}) =>
		setRestaurante({ id: 'r1', slug: 'pruebas', atributos: { ...CAT_TOPPINGS, ...extra } });
	const platoConToppings = () => ({
		...P('h', 'HAMBURGUESA', 25000),
		atributos: { personalizacion: { platino: ['t_que'], premium: ['t_toc'], salsas: [] } },
	});
	const lineaPersonalizada = () => ({
		cartKey: 'h__Toppings: Queso | Premium: Tocineta', id: 'h', name: 'HAMBURGUESA',
		price: 29000, extras: 4000, cantidad: 1,
		descripcion: 'Toppings: Queso | Premium: Tocineta',
		sel: { platino: ['t_que'], premium: ['t_toc'], salsas: [] },
	});

	test('subir el precio de un topping se cobra al carrito dormido', () => {
		// El caso que costaba dinero: el restaurante sube Tocineta de 4.000 a
		// 6.000 y el carrito de ayer seguía cobrando 4.000. Al restaurante le
		// llegaba el pedido con el total viejo.
		conToppings({ toppings_premium: [{ id: 't_toc', nombre: 'Tocineta', precio: 6000 }] });
		setProductos([platoConToppings()]);

		const r = revalidarCarrito([lineaPersonalizada()]);
		assert.equal(r.vivos[0].extras, 6000, 'el recargo sale del catálogo de hoy');
		assert.equal(r.vivos[0].price, 31000, '25.000 de base + 6.000 de topping');
		assert.deepEqual(r.reprecio, [{ nombre: 'HAMBURGUESA', antes: 29000, ahora: 31000 }],
			'y se le dice al cliente');
	});

	test('un topping borrado deja de cobrarse', () => {
		conToppings({ toppings_premium: [] });
		setProductos([platoConToppings()]);

		const r = revalidarCarrito([lineaPersonalizada()]);
		assert.equal(r.vivos[0].extras, 0);
		assert.equal(r.vivos[0].price, 25000, 'solo la base');
		assert.ok(!r.vivos[0].descripcion.includes('Tocineta'), 'ni aparece en el texto');
	});

	test('renombrar un topping actualiza lo que se le manda al restaurante', () => {
		// Renombrar es una operación admitida desde que hay identificadores,
		// así que un carrito dormido no puede mandar por WhatsApp un nombre
		// que ya nadie usa.
		conToppings({ toppings_premium: [{ id: 't_toc', nombre: 'Tocineta ahumada', precio: 4000 }] });
		setProductos([platoConToppings()]);

		const r = revalidarCarrito([lineaPersonalizada()]);
		assert.match(r.vivos[0].descripcion, /Tocineta ahumada/);
		assert.equal(r.vivos[0].price, 29000, 'el precio no cambia: es el mismo topping');
		assert.deepEqual(r.reprecio, [], 'y no se avisa de un cambio de precio que no hubo');
	});

	test('un carrito viejo, guardado con NOMBRES, se recalcula igual', () => {
		// Vive en el móvil del cliente y no conoce los identificadores.
		conToppings({ toppings_premium: [{ id: 't_toc', nombre: 'Tocineta', precio: 6000 }] });
		setProductos([platoConToppings()]);

		const viejo = { ...lineaPersonalizada(), sel: undefined,
			descripcion: 'Toppings: Queso | Premium: Tocineta' };
		const r = revalidarCarrito([viejo]);
		assert.equal(r.vivos[0].price, 31000);
	});

	test('dos líneas que quedan iguales al recalcular se juntan', () => {
		// Si un topping desaparece y con él la diferencia entre dos líneas,
		// dejar dos filas idénticas es algo que el cliente no sabe distinguir.
		conToppings({ toppings_premium: [] });
		setProductos([platoConToppings()]);

		const conTocineta = lineaPersonalizada();
		const sinTocineta = { ...lineaPersonalizada(), cartKey: 'h__Toppings: Queso',
			descripcion: 'Toppings: Queso', extras: 0, price: 25000,
			sel: { platino: ['t_que'], premium: [], salsas: [] } };

		const r = revalidarCarrito([conTocineta, sinTocineta]);
		assert.equal(r.vivos.length, 1, 'una sola línea');
		assert.equal(r.vivos[0].cantidad, 2, 'con las dos cantidades sumadas');
	});

	test('una línea sin personalizar NO pierde su recargo guardado', () => {
		// No saber no es saber que no: sin 'sel' ni texto no hay de dónde
		// recalcular, y poner el recargo a cero le cobraría de menos al
		// restaurante. Se conserva lo único que se sabe.
		setProductos([P('h', 'HAMBURGUESA', 25000)]);
		const r = revalidarCarrito([{ id: 'h', name: 'HAMBURGUESA', price: 23000, extras: 3000, cantidad: 1 }]);
		assert.equal(r.vivos[0].price, 28000);
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
	// Recibe la lista premium ya normalizada por catalogoDe: es la forma en
	// que le llega desde el modal, y así la prueba no inventa una tercera.
	const premium = catalogoDe({ toppings_premium: [
		{ id: 't_toc', nombre: 'Tocineta', precio: 4000 },
		{ id: 't_qf',  nombre: 'Queso fundido', precio: 4000 },
	] }).premium;

	test('suma lo marcado', () => {
		assert.equal(recargoPremium(premium, new Set()), 0);
		assert.equal(recargoPremium(premium, new Set(['t_toc'])), 4000);
		assert.equal(recargoPremium(premium, new Set(['t_toc', 't_qf'])), 8000);
	});

	test('un carrito guardado con nombres se sigue cobrando bien', () => {
		// El carrito del cliente puede ser de antes de la migración. Cobrarle
		// de menos por eso sería peor que cualquier otra cosa que pase aquí.
		assert.equal(recargoPremium(premium, new Set(['Tocineta'])), 4000);
	});

	test('un catálogo con el elemento repetido NO cobra dos veces', () => {
		// El panel ya impide crear duplicados, pero lo guardado de antes no
		// debe cobrarle de más al cliente.
		const conDuplicado = catalogoDe({ toppings_premium: [
			{ id: 't_toc', nombre: 'Tocineta', precio: 4000 },
			{ id: 't_qf',  nombre: 'Queso fundido', precio: 4000 },
			{ id: 't_toc', nombre: 'Tocineta', precio: 4000 },
		] }).premium;
		assert.equal(recargoPremium(conDuplicado, new Set(['t_toc'])), 4000, 'marcado una vez, cobrado una vez');
	});

	test('un precio que no es número no convierte el total en NaN', () => {
		const malo = catalogoDe({ toppings_premium: [{ id: 't_x', nombre: 'X', precio: 'abc' }] }).premium;
		assert.equal(recargoPremium(malo, new Set(['t_x'])), 0);
	});

	test('sin lista premium no suma nada', () => {
		assert.equal(recargoPremium([], new Set(['t_x'])), 0);
		assert.equal(recargoPremium(null, new Set(['t_x'])), 0);
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

// ═══════════════════════════════════════════════════════════════
// ── EL CATÁLOGO Y SUS TRES ÉPOCAS ─────────────────────────────
// El catálogo de toppings se ha guardado de tres formas: cadenas sueltas
// (platino y salsas), objeto con precio (premium) y, desde la migración a
// identificadores, objeto con id. catalogoDe las traduce todas a una sola,
// para que el resto del archivo no tenga que preguntar de qué época es cada
// dato.
describe('catalogoDe · las tres formas dan lo mismo', () => {
	test('una cadena suelta usa su nombre como identificador', () => {
		// Es la pieza que sostiene la migración: sin ella, un plato guardado
		// con nombres y un catálogo ya migrado no se encontrarían nunca.
		const c = catalogoDe({ toppings_platino: ['Queso'], salsas: ['BBQ'] });
		assert.deepEqual(c.platino, [{ id: 'Queso', nombre: 'Queso' }]);
		assert.deepEqual(c.salsas,  [{ id: 'BBQ', nombre: 'BBQ' }]);
	});

	test('un premium sin identificador también cae de pie', () => {
		const c = catalogoDe({ toppings_premium: [{ nombre: 'Tocineta', precio: 4000 }] });
		assert.deepEqual(c.premium, [{ id: 'Tocineta', nombre: 'Tocineta', precio: 4000 }]);
	});

	test('con identificador, manda el identificador', () => {
		const c = catalogoDe({
			toppings_platino: [{ id: 'top_1', nombre: 'Queso' }],
			toppings_premium: [{ id: 'top_2', nombre: 'Tocineta', precio: 4000 }],
			salsas:           [{ id: 'top_3', nombre: 'BBQ' }],
		});
		assert.deepEqual(c.platino.map(t => t.id), ['top_1']);
		assert.deepEqual(c.premium.map(t => t.id), ['top_2']);
		assert.deepEqual(c.salsas.map(t => t.id),  ['top_3']);
	});

	test('un precio que no es número no envenena el catálogo', () => {
		const c = catalogoDe({ toppings_premium: [{ nombre: 'X', precio: 'abc' }] });
		assert.equal(c.premium[0].precio, 0);
	});

	test('la basura se cae en vez de pintarse', () => {
		// atributos es JSON libre: lo que entre raro no puede acabar como un
		// chip vacío en el modal del cliente.
		const c = catalogoDe({ toppings_platino: ['', null, '  ', 'Queso'], salsas: 'no soy lista' });
		assert.deepEqual(c.platino.map(t => t.nombre), ['Queso']);
		assert.deepEqual(c.salsas, []);
	});

	test('un restaurante sin catálogo da las tres listas vacías', () => {
		assert.deepEqual(catalogoDe({}),   { platino: [], premium: [], salsas: [] });
		assert.deepEqual(catalogoDe(null), { platino: [], premium: [], salsas: [] });
	});
});

describe('opcionesDe · qué toppings ofrece cada plato', () => {
	// El catálogo vive en el restaurante y el plato solo dice cuáles ofrece.
	// Antes cada plato llevaba una copia con los precios dentro, y eso hacía
	// que un plato nuevo naciera sin nada y que cambiar un precio en el
	// catálogo no cambiara lo que pagaba el cliente.
	const CATALOGO = {
		toppings_platino: [{ id: 't_ceb', nombre: 'Cebolla' }, { id: 't_tom', nombre: 'Tomate' }, { id: 't_lec', nombre: 'Lechuga' }],
		toppings_premium: [{ id: 't_toc', nombre: 'Tocineta', precio: 4000 }, { id: 't_dq', nombre: 'Doble queso', precio: 3000 }],
		salsas:           [{ id: 't_bbq', nombre: 'BBQ' }, { id: 't_pin', nombre: 'Piña' }, { id: 't_ros', nombre: 'Rosada' }],
	};
	const conCatalogo = (extra = {}) =>
		setRestaurante({ id: 'r1', slug: 'pruebas', atributos: { ...CATALOGO, ...extra } });

	test('el precio sale del catálogo, no del plato', () => {
		// Es el fallo que motivó el cambio: el restaurante sube un precio en
		// el panel, el panel dice que guardó, y el cliente seguía pagando el
		// de antes porque el plato llevaba su propia copia.
		conCatalogo({ toppings_premium: [{ id: 't_toc', nombre: 'Tocineta', precio: 9000 }] });
		const o = opcionesDe({ atributos: { personalizacion: { premium: ['t_toc'] } } });
		assert.equal(o.premium[0].precio, 9000, 'manda el catálogo de hoy');
	});

	test('un plato puede ofrecer solo una parte del catálogo', () => {
		// Una hamburguesa lleva de todo; un perro, menos. Es el caso normal,
		// no la excepción.
		conCatalogo();
		const o = opcionesDe({ atributos: { personalizacion: {
			platino: ['t_ceb'], premium: ['t_dq'], salsas: ['t_bbq', 't_ros'],
		} } });
		assert.deepEqual(o.platino.map(t => t.nombre), ['Cebolla']);
		assert.deepEqual(o.premium.map(t => t.nombre), ['Doble queso']);
		assert.deepEqual(o.salsas.map(t => t.nombre),  ['BBQ', 'Rosada']);
	});

	test('RENOMBRAR un topping ya no desengancha el plato', () => {
		// El motivo entero de que exista el identificador. Antes el plato
		// guardaba "Cebolla"; el restaurante lo llamaba "Cebolla caramelizada"
		// desde el panel y el plato se quedaba apuntando a un nombre que ya no
		// existía: chip desmarcado, sin cobro, y sin ningún aviso.
		conCatalogo({ toppings_platino: [{ id: 't_ceb', nombre: 'Cebolla caramelizada' }] });
		const o = opcionesDe({ atributos: { personalizacion: { platino: ['t_ceb'] } } });
		assert.deepEqual(o.platino.map(t => t.nombre), ['Cebolla caramelizada'],
			'el plato sigue enganchado y ahora dice el nombre nuevo');
	});

	test('un plato guardado con nombres encuentra el catálogo ya migrado', () => {
		// La ventana de la migración: el catálogo tiene identificadores y el
		// plato todavía no. Tienen que seguir encontrándose, o la migración
		// habría que hacerla a la vez en la base, el panel y cada móvil.
		conCatalogo();
		const o = opcionesDe({ atributos: { personalizacion: {
			platino: ['Cebolla'], premium: ['Tocineta'], salsas: ['BBQ'],
		} } });
		assert.deepEqual(o.platino.map(t => t.id), ['t_ceb']);
		assert.deepEqual(o.premium.map(t => t.id), ['t_toc']);
		assert.deepEqual(o.salsas.map(t => t.id),  ['t_bbq']);
	});

	test('y al revés: un catálogo sin migrar con un plato ya migrado', () => {
		// Solo puede pasar si alguien guarda un plato antes de correr la
		// migración del catálogo. Como el identificador cae en el nombre, sale
		// bien igual.
		setRestaurante({ id: 'r1', slug: 'pruebas', atributos: {
			toppings_platino: ['Cebolla', 'Tomate'],
		} });
		const o = opcionesDe({ atributos: { personalizacion: { platino: ['Cebolla'] } } });
		assert.deepEqual(o.platino.map(t => t.nombre), ['Cebolla']);
	});

	test('lo que se borra del catálogo desaparece solo', () => {
		// El plato sigue nombrando 'Piña' pero el restaurante ya la quitó. No
		// puede aparecer en el modal: no tiene precio ni existe.
		conCatalogo({ salsas: [{ id: 't_bbq', nombre: 'BBQ' }] });
		const o = opcionesDe({ atributos: { personalizacion: { salsas: ['t_bbq', 't_pin'] } } });
		assert.deepEqual(o.salsas.map(t => t.nombre), ['BBQ']);
	});

	test('un plato sin personalización no ofrece nada', () => {
		// El caso del producto recién creado. Antes esto era indistinguible de
		// un fallo; ahora es una respuesta.
		conCatalogo();
		const o = opcionesDe({ atributos: {} });
		assert.deepEqual([o.platino, o.premium, o.salsas], [[], [], []]);
	});

	test('los platos con la copia antigua se siguen leyendo', () => {
		// Compatibilidad: los que ya existen no pueden romperse mientras se
		// migran. Si el plato trae copia, manda la copia.
		conCatalogo();
		const o = opcionesDe({ atributos: {
			toppings_platino: ['Cebolla caramelizada'],
			toppings_premium: [{ nombre: 'Trufa', precio: 12000 }],
			salsas: ['Ajo'],
		} });
		assert.deepEqual(o.platino.map(t => t.nombre), ['Cebolla caramelizada']);
		assert.equal(o.premium[0].precio, 12000);
		assert.deepEqual(o.salsas.map(t => t.nombre), ['Ajo']);
	});

	test('una selección vacía es "no ofrece", no "ofrece todo"', () => {
		// La gaseosa. Si una lista vacía se leyera como "todo el catálogo", se
		// le ofrecerían toppings a una bebida.
		conCatalogo();
		const o = opcionesDe({ atributos: { personalizacion: { platino: [], premium: [], salsas: [] } } });
		assert.deepEqual([o.platino, o.premium, o.salsas], [[], [], []]);
	});
});

// ── EDITAR UNA LÍNEA DEL CARRITO ──────────────────────────────
// Al pulsar "editar" sobre un plato personalizado hay que volver a marcar en
// el modal lo que el cliente había elegido. Antes eso se reconstruía leyendo
// el texto de la línea y partiéndolo por ', ', y ahí es donde se perdía
// dinero: un topping con coma en el nombre se partía en dos que no existen,
// el modal abría sin nada marcado y, al guardar, la línea volvía al carrito
// sin el recargo. Sin ningún error a la vista.
describe('describirSeleccion · el texto que lee el restaurante', () => {
	const obj = (...nombres) => nombres.map(n => ({ id: 't_' + n, nombre: n }));

	test('arma las tres secciones separadas por barra', () => {
		assert.equal(
			describirSeleccion({ platino: obj('Queso', 'Doritos'), premium: obj('Tocineta'), salsas: obj('BBQ') }),
			'Toppings: Queso, Doritos | Premium: Tocineta | Salsas: BBQ');
	});

	test('escribe el NOMBRE, nunca el identificador', () => {
		// El texto se lo lee una persona por WhatsApp. Mandar lo que se guarda
		// tal cual le pediría al restaurante "un perro con top_9f21c4a3".
		const texto = describirSeleccion({ premium: [{ id: 'top_9f21c4a3', nombre: 'Tocineta' }] });
		assert.equal(texto, 'Premium: Tocineta');
		assert.ok(!texto.includes('top_'), 'no puede escaparse un identificador al pedido');
	});

	test('lo que no se eligió no deja sección vacía', () => {
		assert.equal(describirSeleccion({ premium: obj('Tocineta') }), 'Premium: Tocineta');
		assert.equal(describirSeleccion({}), '');
	});
});

describe('leerSeleccion · volver a abrir lo que se eligió', () => {
	const CAT = {
		platino: [{ id: 't_que', nombre: 'Queso' }, { id: 't_dor', nombre: 'Doritos' }],
		premium: [{ id: 't_toc', nombre: 'Tocineta', precio: 4000 }],
		salsas:  [{ id: 't_bbq', nombre: 'BBQ' }, { id: 't_ajo', nombre: 'Ajo' }],
	};

	test('la ida y vuelta es exacta para una selección normal', () => {
		const sel = { platino: ['t_que', 't_dor'], premium: ['t_toc'], salsas: ['t_bbq', 't_ajo'] };
		const leido = leerSeleccion({ sel }, CAT);
		assert.deepEqual([...leido.platino], sel.platino);
		assert.deepEqual([...leido.premium], sel.premium);
		assert.deepEqual([...leido.salsas],  sel.salsas);
	});

	test('un carrito guardado con NOMBRES se traduce a identificadores', () => {
		// Vive en el móvil del cliente y puede reaparecer mañana, ya con el
		// catálogo migrado. Perderlo sería quitarle toppings a un pedido a
		// medias sin decir nada.
		const leido = leerSeleccion({ sel: { platino: ['Queso'], premium: ['Tocineta'] } }, CAT);
		assert.deepEqual([...leido.platino], ['t_que']);
		assert.deepEqual([...leido.premium], ['t_toc']);
	});

	test('un topping con coma en el nombre sobrevive a la ida y vuelta', () => {
		// El caso que costaba dinero. Hoy ningún restaurante tiene una coma en
		// sus toppings, pero nada lo impide: "Salsa de la casa, picante" es un
		// nombre perfectamente normal para una carta.
		const cat = { platino: [], salsas: [],
			premium: [{ id: 't_sal', nombre: 'Salsa de la casa, picante', precio: 4000 }] };
		const elegidos = { platino: [], premium: cat.premium, salsas: [] };
		const item = { sel: { premium: ['t_sal'] }, descripcion: describirSeleccion(elegidos) };

		const leido = leerSeleccion(item, cat);
		assert.deepEqual([...leido.premium], ['t_sal'],
			'el topping tiene que volver entero, no partido por la coma');
	});

	test('un carrito guardado antes de que existiera "sel" se sigue entendiendo', () => {
		// No lleva selección, solo el texto. Se lee como se leía siempre y se
		// traduce al catálogo de hoy.
		const viejo = { descripcion: 'Toppings: Queso, Doritos | Premium: Tocineta | Salsas: BBQ' };
		const leido = leerSeleccion(viejo, CAT);
		assert.deepEqual([...leido.platino], ['t_que', 't_dor']);
		assert.deepEqual([...leido.premium], ['t_toc']);
		assert.deepEqual([...leido.salsas],  ['t_bbq']);
	});

	test('lo que ya no está en el catálogo se cae', () => {
		// Un topping que el restaurante borró no se puede ni cobrar ni
		// preparar: reabrir la línea no puede resucitarlo.
		const leido = leerSeleccion({ sel: { platino: ['t_que', 't_borrado'] } }, CAT);
		assert.deepEqual([...leido.platino], ['t_que']);
	});

	test('una línea sin personalizar no marca nada', () => {
		for (const item of [{ descripcion: '' }, {}, null]) {
			const leido = leerSeleccion(item, CAT);
			assert.equal(leido.platino.size, 0);
			assert.equal(leido.premium.size, 0);
			assert.equal(leido.salsas.size, 0);
		}
	});

	test('un "sel" corrupto no revienta el modal', () => {
		// Lo que hay en localStorage lo puede tocar cualquiera.
		const leido = leerSeleccion({ sel: { platino: 'Queso', premium: null } }, CAT);
		assert.equal(leido.platino.size, 0);
		assert.equal(leido.premium.size, 0);
	});

	test('sin catálogo no marca nada, en vez de romperse', () => {
		const leido = leerSeleccion({ sel: { platino: ['t_que'] } });
		assert.equal(leido.platino.size, 0);
	});

	test('el recargo se recupera al reabrir, que es lo que se perdía', () => {
		// La prueba de arriba dice que el topping vuelve; esta dice que eso se
		// traduce en pesos. Con el nombre partido, recargoPremium no
		// encontraba nada y el plato volvía al carrito al precio base.
		const cat = { platino: [], salsas: [],
			premium: [{ id: 't_sal', nombre: 'Salsa de la casa, picante', precio: 4000 }] };
		const item = { sel: { premium: ['t_sal'] },
			descripcion: describirSeleccion({ premium: cat.premium }) };
		const leido = leerSeleccion(item, cat);

		assert.equal(recargoPremium(cat.premium, leido.premium), 4000);
	});
});
