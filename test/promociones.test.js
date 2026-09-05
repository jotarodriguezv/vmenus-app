// Qué promoción sale ahora mismo. La regla de programación se prueba contra el
// juego de casos compartido, que es lo único que impide que las tres copias
// —esta, la de tv.html y la del panel— se separen sin que nadie lo note.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ahoraEn, vigenteAhora, tieneProgramacion } from '../core/horarios.js';
import { paraElPopup, paraLaCartelera } from '../core/promociones.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const CASOS = JSON.parse(fs.readFileSync(path.join(AQUI, 'casos-programacion.json'), 'utf8'));

describe('vigenteAhora · el juego de casos compartido', () => {
	// Si esto falla, la carta y el televisor están a punto de discrepar — y una
	// discrepancia así solo se nota los martes.
	for (const c of CASOS.casos) {
		test(c.nombre, () => {
			assert.equal(
				vigenteAhora(c.programacion, CASOS.zona, new Date(c.momento)),
				c.esperado
			);
		});
	}

	test('el archivo de casos no se ha quedado vacío por un mal merge', () => {
		// Un JSON con la lista vacía haría pasar todo lo de arriba sin probar
		// nada, y el verde diría lo contrario de lo que ocurre.
		assert.ok(CASOS.casos.length >= 20, `solo hay ${CASOS.casos.length} casos`);
	});
});

describe('ahoraEn · la zona se calcula de verdad', () => {
	test('preguntar por Madrid da la hora de Madrid', () => {
		// Con Bogotá esta prueba no probaría nada en la máquina del usuario, que
		// ya está en esa hora: cualquier respaldo por reloj local acertaría por
		// casualidad. Madrid no coincide ni con su reloj ni con el UTC de CI.
		const r = ahoraEn('Europe/Madrid', new Date('2026-09-08T23:30:00-05:00'));
		assert.equal(r.dia, 3);
		assert.equal(r.minutos, 6 * 60 + 30);
		assert.equal(r.fecha, '2026-09-09');
	});
});

describe('tieneProgramacion · declarar algo no es estar vigente', () => {
	// Una promoción de los martes SÍ tiene programación un jueves, aunque ese
	// jueves no salga. De esa diferencia depende la regla de dos niveles.
	test('sin nada declarado, no', () => {
		assert.equal(tieneProgramacion({}), false);
		assert.equal(tieneProgramacion(null), false);
		assert.equal(tieneProgramacion({ activo: true }), false);
	});

	test('con días, horas o fechas, sí', () => {
		assert.equal(tieneProgramacion({ activo: true, dias: [2] }), true);
		assert.equal(tieneProgramacion({ activo: true, desde: '18:00' }), true);
		assert.equal(tieneProgramacion({ activo: true, desde_fecha: '2026-12-01' }), true);
	});

	test('apagada no cuenta aunque tenga días', () => {
		assert.equal(tieneProgramacion({ activo: false, dias: [2] }), false);
	});
});

// ═══════════════════════════════════════════════════════════════
describe('paraElPopup · una sola, y al azar', () => {
	const RESTO = { atributos: {} };            // cae en America/Bogota
	const MARTES = new Date('2026-09-08T19:00:00-05:00');
	const JUEVES = new Date('2026-09-10T19:00:00-05:00');

	const promo = (extra = {}) => Object.assign({
		id: 'a', activa: true, imagen_url: 'https://x/a.jpg',
		en_popup: true, en_tv: false, programacion: {}, orden: 0,
	}, extra);

	test('sin promociones no sale nada', () => {
		assert.equal(paraElPopup([], RESTO, MARTES), null);
		assert.equal(paraElPopup(null, RESTO, MARTES), null);
	});

	test('una apagada no sale', () => {
		assert.equal(paraElPopup([promo({ activa: false })], RESTO, MARTES), null);
	});

	test('una sin imagen tampoco', () => {
		assert.equal(paraElPopup([promo({ imagen_url: '' })], RESTO, MARTES), null);
	});

	test('una marcada solo para el televisor tampoco', () => {
		assert.equal(paraElPopup([promo({ en_popup: false, en_tv: true })], RESTO, MARTES), null);
	});

	test('lo programado para hoy manda sobre lo de siempre', () => {
		// Es la regla de los dos niveles. Con las dos en el mismo bombo, el dos
		// por uno del martes lo vería uno de cada dos clientes, y cada cliente
		// entra una sola vez.
		const fondo = promo({ id: 'fondo' });
		const martes = promo({ id: 'martes', programacion: { activo: true, dias: [2] } });
		assert.equal(paraElPopup([fondo, martes], RESTO, MARTES).id, 'martes');
	});

	test('y el jueves vuelve a mandar la de siempre', () => {
		const fondo = promo({ id: 'fondo' });
		const martes = promo({ id: 'martes', programacion: { activo: true, dias: [2] } });
		assert.equal(paraElPopup([fondo, martes], RESTO, JUEVES).id, 'fondo');
	});

	test('si la del martes es solo para el televisor, el popup sigue con la suya', () => {
		// El filtro por superficie va antes que los niveles: quedarse callado por
		// algo que no era para él sería un silencio sin explicación.
		const fondo = promo({ id: 'fondo' });
		const martesTv = promo({ id: 'martesTv', en_popup: false, en_tv: true,
		                         programacion: { activo: true, dias: [2] } });
		assert.equal(paraElPopup([fondo, martesTv], RESTO, MARTES).id, 'fondo');
	});

	test('con varias vigentes elige al azar, no siempre la primera', () => {
		const tres = [promo({ id: 'a' }), promo({ id: 'b' }), promo({ id: 'c' })];
		assert.equal(paraElPopup(tres, RESTO, MARTES, () => 0).id, 'a');
		assert.equal(paraElPopup(tres, RESTO, MARTES, () => 0.5).id, 'b');
		assert.equal(paraElPopup(tres, RESTO, MARTES, () => 0.99).id, 'c');
	});

	test('un azar que devuelve 1 no deja el popup sin imagen', () => {
		// Math.random() nunca devuelve 1, pero depender de eso es innecesario.
		const dos = [promo({ id: 'a' }), promo({ id: 'b' })];
		assert.ok(paraElPopup(dos, RESTO, MARTES, () => 1));
	});

	test('la zona horaria es la del restaurante, no la de quien mira', () => {
		// Un turista con el celular en otro huso vería la carta de una hora que
		// no es. La referencia es el mismo instante; cambia la zona del negocio.
		const martes = [promo({ programacion: { activo: true, dias: [2] } })];
		const enBogota = { atributos: {} };
		const enMadrid = { atributos: { zona_horaria: 'Europe/Madrid' } };
		const instante = new Date('2026-09-08T23:30:00-05:00');  // martes en Bogotá, miércoles en Madrid
		assert.ok(paraElPopup(martes, enBogota, instante), 'en Bogotá es martes');
		assert.equal(paraElPopup(martes, enMadrid, instante), null, 'en Madrid ya es miércoles');
	});
});

// ═══════════════════════════════════════════════════════════════
describe('paraLaCartelera · entran todas, en su orden', () => {
	const RESTO = { atributos: {} };
	const MARTES = new Date('2026-09-08T19:00:00-05:00');
	const promo = (extra = {}) => Object.assign({
		activa: true, imagen_url: 'https://x/a.jpg',
		en_popup: false, en_tv: true, programacion: {}, orden: 0,
	}, extra);

	test('salen todas las vigentes, no una', () => {
		// Es la diferencia con el popup: la cartelera da vueltas todo el
		// servicio, así que repetirse no molesta — es el objetivo.
		const r = paraLaCartelera([promo({ id: 'a' }), promo({ id: 'b' })], RESTO, MARTES);
		assert.equal(r.length, 2);
	});

	test('en el orden guardado', () => {
		const r = paraLaCartelera(
			[promo({ id: 'b', orden: 2 }), promo({ id: 'a', orden: 1 })], RESTO, MARTES);
		assert.equal(r.map(p => p.id).join(' '), 'a b');
	});

	test('y los dos niveles también aplican aquí', () => {
		const r = paraLaCartelera([
			promo({ id: 'fondo' }),
			promo({ id: 'martes', programacion: { activo: true, dias: [2] } }),
		], RESTO, MARTES);
		assert.equal(r.map(p => p.id).join(' '), 'martes');
	});
});
