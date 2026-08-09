// Disponibilidad por horario. Todo se calcula en la zona del RESTAURANTE:
// un turista con el móvil en otro huso no debe ver un menú que no toca.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { zonaDe, ahoraEn, aMinutos, categoriaVisible, aplicarHorarios } from '../core/horarios.js';

const BOGOTA = 'America/Bogota';
// Un instante concreto para no depender de cuándo se ejecuten las pruebas.
const enBogota = (fecha, hora) => new Date(`${fecha}T${hora}:00-05:00`);
const conHorario = h => ({ id: 'c1', atributos: { horario: h } });

describe('zonaDe', () => {
	test('sin zona configurada cae en Bogotá', () => {
		assert.equal(zonaDe({}), BOGOTA);
		assert.equal(zonaDe(null), BOGOTA);
	});

	test('una zona inválida no tumba el menú', () => {
		// Intl lanza con una zona que no existe; si eso subiera, el menú
		// entero dejaría de cargar por un dato mal escrito en el panel.
		assert.equal(zonaDe({ atributos: { zona_horaria: 'Marte/Olympus' } }), BOGOTA);
	});

	test('una zona válida se respeta', () => {
		assert.equal(zonaDe({ atributos: { zona_horaria: 'Europe/Madrid' } }), 'Europe/Madrid');
	});
});

describe('aMinutos', () => {
	test('convierte HH:MM a minutos desde medianoche', () => {
		assert.equal(aMinutos('00:00'), 0);
		assert.equal(aMinutos('11:30'), 690);
		assert.equal(aMinutos('23:59'), 1439);
		assert.equal(aMinutos('9:05'), 545);   // una sola cifra en la hora
	});

	test('rechaza lo que no es una hora', () => {
		for (const v of ['24:00', '12:60', 'mediodía', '', null, undefined, '12', '12:5'])
			assert.equal(aMinutos(v), null, `debería rechazar ${JSON.stringify(v)}`);
	});
});

describe('ahoraEn', () => {
	test('devuelve día y minutos en la zona pedida, no en la del servidor', () => {
		// 15:30 en Bogotá es el mismo instante que 20:30 UTC
		const r = ahoraEn(BOGOTA, enBogota('2026-08-05', '15:30'));
		assert.equal(r.dia, 3);              // miércoles
		assert.equal(r.minutos, 15 * 60 + 30);
	});

	test('la medianoche cuenta como minuto 0, no como 1440', () => {
		// Con hour12:false algunos motores devuelven "24" para las 00:00
		const r = ahoraEn(BOGOTA, enBogota('2026-08-05', '00:00'));
		assert.equal(r.minutos, 0);
	});
});

describe('categoriaVisible', () => {
	test('sin horario configurado, siempre visible', () => {
		assert.equal(categoriaVisible({ id: 'c1' }, BOGOTA, new Date()), true);
		assert.equal(categoriaVisible(conHorario({ activo: false }), BOGOTA, new Date()), true);
	});

	test('franja normal: dentro se ve, fuera no', () => {
		const almuerzo = conHorario({ activo: true, dias: [1,2,3,4,5], desde: '11:00', hasta: '15:00' });
		assert.equal(categoriaVisible(almuerzo, BOGOTA, enBogota('2026-08-05', '12:00')), true,  'miércoles al mediodía');
		assert.equal(categoriaVisible(almuerzo, BOGOTA, enBogota('2026-08-05', '16:00')), false, 'miércoles a las 4');
		assert.equal(categoriaVisible(almuerzo, BOGOTA, enBogota('2026-08-08', '12:00')), false, 'sábado, día no incluido');
	});

	test('los bordes: desde incluido, hasta excluido', () => {
		const h = conHorario({ activo: true, dias: [3], desde: '11:00', hasta: '15:00' });
		assert.equal(categoriaVisible(h, BOGOTA, enBogota('2026-08-05', '11:00')), true,  'justo al abrir');
		assert.equal(categoriaVisible(h, BOGOTA, enBogota('2026-08-05', '14:59')), true,  'un minuto antes de cerrar');
		assert.equal(categoriaVisible(h, BOGOTA, enBogota('2026-08-05', '15:00')), false, 'justo al cerrar');
	});

	test('franja que cruza la medianoche: la madrugada es parte de la noche anterior', () => {
		// Viernes de 18:00 a 02:00. A la 1 a.m. del SÁBADO sigue siendo
		// "la noche del viernes", así que debe verse.
		const noche = conHorario({ activo: true, dias: [5], desde: '18:00', hasta: '02:00' });
		assert.equal(categoriaVisible(noche, BOGOTA, enBogota('2026-08-07', '20:00')), true,  'viernes a las 8 p.m.');
		assert.equal(categoriaVisible(noche, BOGOTA, enBogota('2026-08-08', '01:00')), true,  'sábado a la 1 a.m. (= noche del viernes)');
		assert.equal(categoriaVisible(noche, BOGOTA, enBogota('2026-08-08', '20:00')), false, 'sábado a las 8 p.m. (ya no es viernes)');
		assert.equal(categoriaVisible(noche, BOGOTA, enBogota('2026-08-07', '10:00')), false, 'viernes por la mañana');
	});

	test('ante configuración incompleta muestra de más, nunca de menos', () => {
		// Esconderle el menú a los clientes por un dato mal escrito sería
		// peor que enseñar una categoría fuera de su franja.
		for (const h of [
			{ activo: true, desde: '11:00' },                       // falta 'hasta'
			{ activo: true, desde: 'nada', hasta: '15:00' },        // hora inválida
			{ activo: true, desde: '11:00', hasta: '11:00' },       // franja vacía
		]) assert.equal(categoriaVisible(conHorario(h), BOGOTA, enBogota('2026-08-05', '23:00')), true,
			`debería verse con ${JSON.stringify(h)}`);
	});

	test('lista de días vacía significa todos los días', () => {
		const h = conHorario({ activo: true, dias: [], desde: '11:00', hasta: '15:00' });
		assert.equal(categoriaVisible(h, BOGOTA, enBogota('2026-08-08', '12:00')), true, 'sábado incluido');
	});
});

describe('aplicarHorarios', () => {
	test('filtra las categorías Y sus productos', () => {
		// Filtrar solo las categorías dejaría productos huérfanos que
		// seguirían saliendo en la búsqueda y en los contadores del nav.
		const cats = [
			{ id: 'almuerzo', atributos: { horario: { activo: true, dias: [3], desde: '11:00', hasta: '15:00' } } },
			{ id: 'siempre', atributos: {} },
		];
		const prods = [
			{ id: 'p1', categoria_id: 'almuerzo' },
			{ id: 'p2', categoria_id: 'siempre' },
		];
		const resto = { atributos: { zona_horaria: BOGOTA } };

		const dentro = aplicarHorarios(cats, prods, resto, enBogota('2026-08-05', '12:00'));
		assert.equal(dentro.categorias.length, 2);
		assert.equal(dentro.productos.length, 2);

		const fuera = aplicarHorarios(cats, prods, resto, enBogota('2026-08-05', '20:00'));
		assert.deepEqual(fuera.categorias.map(c => c.id), ['siempre']);
		assert.deepEqual(fuera.productos.map(p => p.id), ['p2'], 'el producto de almuerzo también desaparece');
	});
});
