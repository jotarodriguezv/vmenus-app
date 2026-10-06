// En iPhone, 100vh es el alto con la barra del navegador ESCONDIDA: un panel que mide 100vh deja su pie
// —«Hacer Pedido» en el carrito— debajo de la barra, y hay que subir la página para pulsarlo. dvh sigue a
// la barra. El vh de antes se queda como respaldo para los navegadores que no conocen dvh.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('el panel del carrito y las ventanas que salen de abajo miden con dvh', () => {
	assert.match(html, /max-width: 350px; height: 100vh; height: 100dvh;/, 'el panel del carrito');
	assert.match(html, /padding: 20px; max-height: 90vh; max-height: 90dvh;/, 'el checkout');
	assert.match(html, /max-width: 480px; max-height: 88vh; max-height: 88dvh;/, 'la personalización');
	assert.match(html, /\.modal-sheet \{\s*width: 100%; max-height: 88vh; max-height: 88dvh;/, 'la ficha compartida');
});

test('el pie del carrito deja sitio al borde inferior del teléfono', () => {
	assert.match(html, /\.cart-footer \{ padding: 16px 16px calc\(16px \+ env\(safe-area-inset-bottom, 0px\)\);/);
});
