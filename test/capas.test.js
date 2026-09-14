// Las capas cerradas no pueden quedarse en el recorrido del teclado (V6 en
// adminmenus_restaurantes/docs/revision-ux.md). Se esconden con opacidad o
// sacándolas de la pantalla, y ninguna de las dos cosas saca sus botones del
// Tab: con todo cerrado, Malparados tenía unos 25 controles tabulables sin ver.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Sin comentarios: el que explica esto menciona «transition: all» y no es una regla.
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8')
	.replace(/\/\*[\s\S]*?\*\//g, '');
const menu = fs.readFileSync(new URL('../core/menu.js', import.meta.url), 'utf8');

// Cuerpo de la primera regla cuyo selector es exactamente `selector`.
function regla(selector) {
	const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const m = html.match(new RegExp(`^[ \\t]*${esc}\\s*\\{([^}]*)\\}`, 'm'));
	assert.ok(m, `no se encontró la regla ${selector}`);
	return m[1];
}

const CAPAS = [
	['.sidebar', '.sidebar.open'],
	['.cart-sidebar', '.cart-sidebar.open'],
	['.checkout-overlay', '.checkout-overlay.open'],
	['.custom-overlay', '.custom-overlay.open'],
	['.modal-overlay', '.modal-overlay.open'],
	['.lightbox', '.lightbox.open'],
	['.promo-overlay', '.promo-overlay.open'],
	['.scroll-top', '.scroll-top.visible'],
	['.exp-searchbar', '.exp-searchbar.open'],
	['.exp-filterpanel', '.exp-filterpanel.open'],
	['.exp-modal', '.exp-modal.open'],
];

describe('las capas cerradas salen del Tab', () => {
	for (const [cerrada, abierta] of CAPAS) {
		test(`${cerrada}: oculta al cerrar cuando acaba de irse, visible al instante al abrir`, () => {
			const c = regla(cerrada);
			assert.match(c, /visibility:\s*hidden/);
			// El retraso deja terminar el fundido o el deslizamiento de salida.
			assert.match(c, /visibility 0s linear [0-9.]+s/);
			const a = regla(abierta);
			assert.match(a, /visibility:\s*visible/);
			// Sin esto, al abrir también esperaría, y el foco no podría entrar.
			assert.match(a, /transition-delay:\s*0s/);
		});
	}

	test('ninguna «transition: all» anima la visibilidad heredada', () => {
		// Un hijo con transition: all heredaba el cambio a visible con retraso y
		// seguía oculto justo cuando se le daba el foco. Visto en el lateral.
		const todas = html.match(/transition:\s*all[^;]*;/g) || [];
		assert.ok(todas.length > 0);
		for (const t of todas) assert.match(t, /, visibility 0s/, t);
	});

	test('las flechas de la ficha no se imponen a la ficha cerrada', () => {
		// Un 'visible' en línea gana a lo heredado: la flecha seguía en el Tab.
		assert.doesNotMatch(menu, /style\.visibility\s*=[^;]*'visible'/);
		assert.match(menu, /next\.style\.visibility = currentProductIndex === total - 1 \? 'hidden' : ''/);
	});
});
