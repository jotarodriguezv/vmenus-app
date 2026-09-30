// La pantalla de lista del modelo Vertical (30/09/2026). Los platos sin foto ni
// video se agrupan en una pantalla de filas. Llevaba 70 px de relleno solo a la
// derecha para esquivar el WhatsApp y el carrito, y la tarjeta quedaba corrida a
// la izquierda. Esa columna flotante solo estorba abajo, así que el espacio se
// reserva abajo y a los lados queda simétrico. Esto vigila que no vuelva.
//
// Se lee el CSS del archivo porque no hay navegador aquí; la comprobación de que
// se ve centrada se hizo a mano en el navegador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// El cuerpo de una regla, por su selector exacto.
function regla(selector) {
	const i = css.indexOf(selector + ' {');
	assert.ok(i >= 0, `no está la regla ${selector}`);
	return css.slice(i, css.indexOf('}', i));
}

test('el contenido de la lista no lleva relleno a un solo lado', () => {
	assert.doesNotMatch(regla('.ver-lista-contenido'), /padding(-right|-left)?\s*:/);
});

test('el espacio para el carrito y el WhatsApp se reserva abajo, no a un lado', () => {
	const pantalla = regla('.ver-plato.ver-lista-sin-media');
	const m = pantalla.match(/padding:\s*(\d+)px\s+(\d+)px\s+calc\((\d+)px/);
	assert.ok(m, 'la pantalla de lista declara su relleno como arriba / lados / abajo');
	const [, arriba, lados, abajo] = m.map(Number);
	// El carrito mide 56 px y flota a 18 del borde; el WhatsApp va encima.
	assert.ok(abajo >= 100, `abajo debe dejar libre la columna flotante (hoy ${abajo}px)`);
	assert.ok(arriba >= 54, `arriba debe librar la barra de categorías (hoy ${arriba}px)`);
	assert.ok(lados <= 24, 'a los lados, un margen normal y simétrico');
});
