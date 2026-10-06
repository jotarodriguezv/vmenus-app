// La cartelera con sedes: cada pantalla pertenece a una sede y enseña sus precios.
//
// La regla de precios por sede vive en DOS sitios que no pueden importarse entre sí:
// core/sedes.js (la carta del QR, módulos ES) y tv.html (dialecto viejo, para
// televisores que nadie puede depurar). Los dos corren contra el MISMO juego de casos,
// test/casos-sede.json, para que ninguno se separe sin que salte algo.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { productosDeLaSede as enLaCarta } from '../core/sedes.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = readFileSync(join(RAIZ, 'tv.html'), 'utf8').replace(/\r\n/g, '\n');
const GUION = HTML.slice(HTML.indexOf('<script>') + 8, HTML.indexOf('</script>'));
const CASOS = JSON.parse(readFileSync(join(RAIZ, 'test', 'casos-sede.json'), 'utf8'));

function extraer(nombres, contexto = {}) {
	const ctx = vm.createContext(contexto);
	for (const n of nombres) {
		const i = GUION.indexOf('function ' + n + '(');
		assert.notEqual(i, -1, `no se encontró ${n}() en tv.html — ¿se renombró?`);
		vm.runInContext(GUION.slice(i, GUION.indexOf('\n}', i) + 2), ctx);
	}
	return ctx;
}

const enLaTv = extraer(['formatoPesos', 'presentacionesDe', 'productosDeLaSede']).productosDeLaSede;

// Solo se comparan los campos que el caso nombra: lo demás del plato es de otro asunto.
const resumen = (lista, esperado) => lista.map((p, i) => {
	const r = {};
	for (const k of Object.keys(esperado[i] || {})) r[k] = p[k];
	return r;
});

describe('la regla de precios por sede · el mismo juego de casos en la carta y en la cartelera', () => {
	for (const [nombre, f] of [['la carta del QR (core/sedes.js)', enLaCarta], ['la cartelera (tv.html)', enLaTv]]) {
		describe(nombre, () => {
			for (const c of CASOS) {
				test(c.nombre, () => {
					const entrada = JSON.parse(JSON.stringify(c.productos));
					const salida = JSON.parse(JSON.stringify(f(entrada, c.filas)));
					assert.deepEqual(salida.map(p => p.id), c.esperado.map(p => p.id), 'qué platos quedan, y en qué orden');
					assert.deepEqual(JSON.parse(JSON.stringify(resumen(salida, c.esperado))), c.esperado);
					assert.deepEqual(entrada, c.productos, 'no modifica los platos de entrada');
				});
			}
		});
	}
});

describe('de qué sede es una pantalla', () => {
	const { sedeConfigurada } = extraer(['sedeConfigurada']);
	const at = { tv: { sede: 'piedecuesta' }, tv_pantallas: { 2: { sede: 'bucaramanga' }, 3: { nombre: 'sin sede' } } };

	test('la pantalla 1 lee atributos.tv y las otras, tv_pantallas', () => {
		assert.equal(sedeConfigurada(at, 1), 'piedecuesta');
		assert.equal(sedeConfigurada(at, 2), 'bucaramanga');
	});
	test('sin sede, o sin configuración, es la cadena vacía', () => {
		assert.equal(sedeConfigurada(at, 3), '');
		assert.equal(sedeConfigurada({}, 1), '');
		assert.equal(sedeConfigurada(null, 2), '');
		assert.equal(sedeConfigurada({ tv: { sede: 5 } }, 1), '', 'solo vale un texto');
	});
});

describe('pedirSede · qué pasa según el restaurante', () => {
	// Un `pedir` de mentira que contesta lo que se le diga y apunta qué se pidió.
	function montar(respuestas, pantalla = 1) {
		const pedidos = [];
		const ctx = extraer(['sedeConfigurada', 'pedirSede'], {
			numeroPantalla: pantalla,
			pedir(recurso, alTerminar) {
				pedidos.push(recurso);
				const clave = Object.keys(respuestas).find(k => recurso.startsWith(k));
				alTerminar(clave === undefined ? null : respuestas[clave]);
			},
		});
		return { ctx, pedidos };
	}
	const resolver = (ctx, r) => { let sal; ctx.pedirSede(r, v => { sal = v; }); return JSON.parse(JSON.stringify(sal)); };
	const SEDES = [{ id: 's1', slug: 'piedecuesta', nombre: 'Piedecuesta' }, { id: 's2', slug: 'bucaramanga', nombre: 'Bucaramanga' }];
	const resto = (atributos) => ({ id: 'r1', atributos });

	test('sin el interruptor «Varias sedes», no pide NADA y la carta es la de siempre', () => {
		for (const atributos of [{}, { con_sedes: false }, { con_sedes: 'true' }, undefined]) {
			const { ctx, pedidos } = montar({});
			assert.deepEqual(resolver(ctx, resto(atributos)), { sede: null, faltante: false, filas: [] });
			assert.equal(pedidos.length, 0);
		}
	});

	test('con sedes, la pantalla enseña las de SU sede: pide sus precios', () => {
		const { ctx, pedidos } = montar({ sedes: SEDES, productos_sedes: [{ producto_id: 'p', precio_numerico: 1 }] }, 2);
		const r = resolver(ctx, resto({ con_sedes: true, tv_pantallas: { 2: { sede: 'bucaramanga' } } }));
		assert.equal(r.sede.slug, 'bucaramanga');
		assert.equal(r.faltante, false);
		assert.equal(r.filas.length, 1);
		assert.ok(pedidos.some(p => p.startsWith('productos_sedes?sede_id=eq.s2')), pedidos.join(' | '));
	});

	test('con sedes y la pantalla SIN sede: faltante, y no se piden precios de nadie', () => {
		const { ctx, pedidos } = montar({ sedes: SEDES });
		const r = resolver(ctx, resto({ con_sedes: true, tv: { activa: true } }));
		assert.equal(r.sede, null);
		assert.equal(r.faltante, true);
		assert.equal(pedidos.some(p => p.startsWith('productos_sedes')), false);
	});

	test('con una sede que ya no existe: también faltante (no se cae a los precios base)', () => {
		const { ctx } = montar({ sedes: SEDES });
		assert.equal(resolver(ctx, resto({ con_sedes: true, tv: { sede: 'cali' } })).faltante, true);
	});

	test('encendido pero sin ninguna sede creada: carta normal, no faltante', () => {
		const { ctx } = montar({ sedes: [] });
		assert.deepEqual(resolver(ctx, resto({ con_sedes: true, tv: { sede: 'piedecuesta' } })), { sede: null, faltante: false, filas: [] });
	});

	test('si fallan las sedes o los precios, contesta null: se trata como un fallo de carga', () => {
		assert.equal(resolver(montar({}).ctx, resto({ con_sedes: true, tv: { sede: 'piedecuesta' } })), null);
		const { ctx } = montar({ sedes: SEDES });   // los precios de la sede no contestan
		assert.equal(resolver(ctx, resto({ con_sedes: true, tv: { sede: 'piedecuesta' } })), null);
	});
});

describe('cómo se conecta con el resto de tv.html', () => {
	test('una pantalla sin sede no se enciende, y el reposo dice por qué', () => {
		assert.match(GUION, /function tvActiva\(\) \{\s*[\s\S]{0,200}?if \(datos && datos\.sedeFaltante\) return false;/);
		assert.match(GUION, /getElementById\('reposoAviso'\)\.textContent =\s*\(datos && datos\.sedeFaltante\)/);
	});

	test('la caché es por pantalla: dos sedes en un mismo navegador no se pisan', () => {
		assert.match(GUION, /CLAVE_CACHE \+ slug \+ '_' \+ numeroPantalla, JSON\.stringify\(datos\)/);
		assert.match(GUION, /localStorage\.getItem\(CLAVE_CACHE \+ slug \+ '_' \+ numeroPantalla\)/);
	});

	test('cargar() mete la sede entre los platos y las promociones, y un fallo corta la carga', () => {
		const cargar = GUION.slice(GUION.indexOf('function cargar('), GUION.indexOf('function sondear('));
		assert.match(cargar, /pedirSede\(r, function \(infoSede\) \{\s*if \(!infoSede\) \{ alTerminar\(false\); return; \}/);
		assert.match(cargar, /productosDeLaSede\(prods, infoSede\.filas\)/);
		assert.match(cargar, /sede: infoSede\.sede, sedeFaltante: infoSede\.faltante/);
	});
});
