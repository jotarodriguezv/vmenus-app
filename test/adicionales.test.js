// Los adicionales de la carta en el modal del pedido (core/adicionales.js): una categoría «ADICIONALES»
// que también se ofrece al agregar otro plato, sin copiarla como toppings con costo.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const almacen = new Map();
globalThis.localStorage = { getItem: k => (almacen.has(k) ? almacen.get(k) : null), setItem: (k, v) => almacen.set(k, String(v)), removeItem: k => almacen.delete(k) };
globalThis.document = { getElementById: () => null };
globalThis.fetch = () => Promise.resolve({ ok: true });

const { configAdicionales, aplicaAdicionales, adicionalesDeLaCarta, PREFIJO_ADICIONAL } = await import('../core/adicionales.js');
const { setRestaurante, setProductos } = await import('../core/menu.js');
const { opcionesDe, tienePersonalizacion, revalidarCarrito, recargoPremium } = await import('../core/carrito.js');

const ADIC = 'cat-adicionales', BURGER = 'cat-burgers', GASEOSAS = 'cat-gaseosas';
const cfg = (extra = {}) => ({ activo: true, categoria_id: ADIC, categorias: [BURGER], ...extra });
const papa = { id: 'p-papa', nombre: 'PORCION DE PAPA FRANCESA', precio_numerico: 6000, categoria_id: ADIC, disponible: true, atributos: {} };
const tocineta = { id: 'p-toc', nombre: 'PORCION DE TOCINETA', precio_numerico: 4000, categoria_id: ADIC, disponible: true, atributos: {} };
const burger = { id: 'p-bur', nombre: 'Clásica', precio_numerico: 20000, categoria_id: BURGER, disponible: true, atributos: {} };
const gaseosa = { id: 'p-gas', nombre: 'Gaseosa', precio_numerico: 4000, categoria_id: GASEOSAS, disponible: true, atributos: {} };

function montar(adicionales_carta, productos = [papa, tocineta, burger, gaseosa]) {
	setRestaurante({ id: 'r1', slug: 'pruebas', atributos: adicionales_carta === undefined ? {} : { adicionales_carta } });
	setProductos(productos);
}
beforeEach(() => almacen.clear());

describe('configAdicionales · opt-in y tolerante', () => {
	test('apagada, ausente o incompleta no es configuración', () => {
		const r = a => ({ atributos: { adicionales_carta: a } });
		assert.equal(configAdicionales({ atributos: {} }), null);
		assert.equal(configAdicionales(r({ ...cfg(), activo: false })), null);
		assert.equal(configAdicionales(r({ ...cfg(), activo: 'true' })), null);
		assert.equal(configAdicionales(r({ ...cfg(), categoria_id: '' })), null);
		assert.equal(configAdicionales(r({ ...cfg(), categorias: [] })), null);
		assert.equal(configAdicionales(r({ ...cfg(), categorias: 'x' })), null);
		assert.equal(configAdicionales(undefined), null);
	});

	test('la categoría de adicionales no se ofrece a sí misma', () => {
		assert.equal(configAdicionales({ atributos: { adicionales_carta: cfg({ categorias: [ADIC] }) } }), null);
		const c = configAdicionales({ atributos: { adicionales_carta: cfg({ categorias: [ADIC, BURGER] }) } });
		assert.deepEqual([...c.categorias], [BURGER]);
	});
});

describe('adicionalesDeLaCarta', () => {
	test('traduce cada plato de la categoría a un adicional repetible con id propio', () => {
		const c = configAdicionales({ atributos: { adicionales_carta: cfg() } });
		const lista = adicionalesDeLaCarta([papa, tocineta, burger], c);
		assert.deepEqual(lista.map(a => a.id), [PREFIJO_ADICIONAL + 'p-papa', PREFIJO_ADICIONAL + 'p-toc']);
		assert.equal(lista[0].precio, 6000);
		assert.equal(lista[0].repetible, true);
		assert.ok(lista[0].max >= 2);
	});

	test('un adicional agotado o sin nombre no se ofrece', () => {
		const c = configAdicionales({ atributos: { adicionales_carta: cfg() } });
		const lista = adicionalesDeLaCarta([{ ...papa, disponible: false }, { ...tocineta, nombre: '  ' }], c);
		assert.deepEqual(lista, []);
	});

	test('usa el precio que rige hoy (oferta)', () => {
		const c = configAdicionales({ atributos: { adicionales_carta: cfg() } });
		const enOferta = { ...papa, oferta_activa: true, oferta_precio_numerico: 5000 };
		assert.equal(adicionalesDeLaCarta([enOferta], c)[0].precio, 5000);
	});
});

describe('en el modal del pedido (opcionesDe)', () => {
	test('un plato de una categoría elegida recibe los adicionales como toppings con costo', () => {
		montar(cfg());
		const o = opcionesDe(burger);
		assert.deepEqual(o.premium.map(t => t.nombre), ['PORCION DE PAPA FRANCESA', 'PORCION DE TOCINETA']);
		assert.equal(tienePersonalizacion(burger), true, 'ahora su «+» abre el modal');
	});

	test('el recargo cuenta las porciones elegidas, también repetidas', () => {
		montar(cfg());
		const { premium } = opcionesDe(burger);
		const marcados = new Set([premium[0].id, premium[1].id]);
		assert.equal(recargoPremium(premium, marcados, new Map([[premium[0].id, 2]])), 2 * 6000 + 4000);
	});

	test('un plato de otra categoría, y los adicionales mismos, quedan como siempre', () => {
		montar(cfg());
		assert.equal(tienePersonalizacion(gaseosa), false);
		assert.equal(tienePersonalizacion(papa), false);
	});

	test('sin la configuración, nada cambia', () => {
		montar(undefined);
		assert.equal(tienePersonalizacion(burger), false);
		montar({ ...cfg(), activo: false });
		assert.equal(tienePersonalizacion(burger), false);
	});

	test('se suman a lo que el plato ya tenía, sin duplicarse', () => {
		const conQueso = { ...burger, atributos: { personalizacion: { premium: ['top1'] } } };
		setRestaurante({ id: 'r1', slug: 'pruebas', atributos: { adicionales_carta: cfg(), toppings_premium: [{ id: 'top1', nombre: 'Queso extra', precio: 3000 }] } });
		setProductos([papa, conQueso]);
		assert.deepEqual(opcionesDe(conQueso).premium.map(t => t.nombre), ['Queso extra', 'PORCION DE PAPA FRANCESA']);
	});
});

describe('revalidar el carrito con adicionales de la carta', () => {
	const linea = (premium, extras) => ({
		cartKey: 'p-bur__x', id: 'p-bur', name: 'Clásica', price: 20000, extras, cantidad: 1, descripcion: '',
		sel: { platino: [], premium, salsas: [] },
	});

	test('un adicional que sigue disponible se conserva con su precio de hoy', () => {
		montar(cfg());
		const r = revalidarCarrito([linea([PREFIJO_ADICIONAL + 'p-papa'], 6000)]);
		assert.equal(r.vivos.length, 1);
		assert.equal(r.vivos[0].extras, 6000);
	});

	test('si el precio del adicional cambió, la línea se recalcula', () => {
		montar(cfg(), [{ ...papa, precio_numerico: 7000 }, tocineta, burger]);
		const r = revalidarCarrito([linea([PREFIJO_ADICIONAL + 'p-papa'], 6000)]);
		assert.equal(r.vivos[0].extras, 7000);
	});

	test('un adicional agotado sale de la línea', () => {
		montar(cfg(), [{ ...papa, disponible: false }, tocineta, burger]);
		const r = revalidarCarrito([linea([PREFIJO_ADICIONAL + 'p-papa'], 6000)]);
		const sel = r.vivos[0]?.sel;
		assert.equal(sel?.premium?.includes(PREFIJO_ADICIONAL + 'p-papa') ?? false, false);
		assert.ok(!r.vivos[0] || r.vivos[0].extras === 0);
	});
});
