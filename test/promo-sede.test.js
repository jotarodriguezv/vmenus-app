// Los destacados por sede: una promoción puede ser de UNA sede o de todas (sql/39 del
// panel). La regla vive en dos sitios que no pueden importarse entre sí —core/promociones.js
// (la carta del QR) y tv.html (dialecto viejo)— y los dos corren contra el MISMO juego de
// casos, test/casos-promo-sede.json, para que ninguno se separe sin que salte algo.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { paraElPopup, paraLaCartelera, deLaSede } from '../core/promociones.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = readFileSync(join(RAIZ, 'tv.html'), 'utf8').replace(/\r\n/g, '\n');
const GUION = HTML.slice(HTML.indexOf('<script>') + 8, HTML.indexOf('</script>'));
const CASOS = JSON.parse(readFileSync(join(RAIZ, 'test', 'casos-promo-sede.json'), 'utf8'));

// Un martes, hora de Bogotá, para las programadas.
const MARTES = new Date('2026-10-06T15:00:00-05:00');

function extraer(nombres, contexto = {}) {
	const ctx = vm.createContext(contexto);
	for (const n of nombres) {
		const i = GUION.indexOf('function ' + n + '(');
		assert.notEqual(i, -1, `no se encontró ${n}() en tv.html — ¿se renombró?`);
		vm.runInContext(GUION.slice(i, GUION.indexOf('\n}', i) + 2), ctx);
	}
	return ctx;
}

// Cada promoción, completa: lo que el caso no nombra es lo normal.
const completa = (p, i) => ({
	imagen_url: 'https://x/promo.jpg', activa: true, en_popup: true, en_tv: true,
	programacion: {}, orden: i, ...p,
});

const enLaCartelera = (promos, desde) =>
	paraLaCartelera(promos, { atributos: {}, sede: desde ? { id: desde } : undefined }, MARTES).map(p => p.id);

const enLaTv = (promos, desde) => extraer(
	['urlSegura', 'ahoraEnZona', 'aMinutosDelDia', 'esFecha', 'vigenteAhora', 'tieneProgramacion', 'promocionesDeAhora'],
	{ datos: { restaurante: { atributos: {} }, promociones: promos, sede: desde ? { id: desde } : null }, Intl, Date, RegExp, String, parseInt },
).promocionesDeAhora(MARTES).map(p => p.id);
const enLaTvPlano = (promos, desde) => Array.from(enLaTv(promos, desde));

describe('el destacado por sede · el mismo juego de casos en la carta y en la cartelera', () => {
	for (const [nombre, f] of [['la cartelera según core/promociones.js', enLaCartelera], ['la cartelera según tv.html', enLaTvPlano]]) {
		describe(nombre, () => {
			for (const c of CASOS.casos) {
				test(c.nombre, () => {
					const promos = c.promos.map(completa);
					assert.deepEqual(f(promos, c.desde), c.esperado);
				});
			}
		});
	}

	describe('el popup de la carta', () => {
		for (const c of CASOS.casos) {
			test(c.nombre, () => {
				const promos = c.promos.map(completa);
				const elegida = paraElPopup(promos, { atributos: {}, sede: c.desde ? { id: c.desde } : undefined }, MARTES, () => 0);
				// Con azar fijo en 0 sale la primera de las que pueden salir: la lista esperada es la de la cartelera.
				assert.equal(elegida ? elegida.id : null, c.esperado.length ? c.esperado[0] : null);
			});
		}

		test('una promoción solo para el televisor no se la quita al popup, sea de la sede que sea', () => {
			const promos = [completa({ id: 'popup' }), completa({ id: 'tv-buc', sede_id: 'sede-buc', en_popup: false, programacion: { activo: true, dias: [2] } }, 1)];
			assert.equal(paraElPopup(promos, { atributos: {}, sede: { id: 'sede-pie' } }, MARTES, () => 0).id, 'popup');
			assert.equal(paraElPopup(promos, { atributos: {}, sede: { id: 'sede-buc' } }, MARTES, () => 0).id, 'popup');
		});
	});
});

describe('deLaSede', () => {
	test('vacía vale para todas; una concreta, solo para esa', () => {
		assert.equal(deLaSede({ sede_id: null }, { id: 'x' }), true);
		assert.equal(deLaSede({}, undefined), true);
		assert.equal(deLaSede({ sede_id: 'x' }, { id: 'x' }), true);
		assert.equal(deLaSede({ sede_id: 'x' }, { id: 'y' }), false);
		assert.equal(deLaSede({ sede_id: 'x' }, undefined), false);
	});
});

describe('cómo se conecta', () => {
	test('la cartelera pide la columna sede_id de las promociones', () => {
		assert.match(GUION, /id,imagen_url,nombre,precio,activa,en_popup,en_tv,pantallas_tv,programacion,orden,sede_id/);
	});

	test('el loader le da al popup el restaurante con su sede, que es lo que lee paraElPopup', () => {
		const loader = readFileSync(join(RAIZ, 'core', 'loader.js'), 'utf8');
		assert.match(loader, /paraElPopup\(promos, restaurante\)/);
		assert.match(loader, /restauranteDeLaSede\(/);
	});
});
