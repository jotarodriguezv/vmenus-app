// Escapado de lo que escribe el restaurante. El menú se sirve desde el
// dominio de la plataforma, así que lo que se cuele aquí corre con su origen.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { esc, escUrl } from '../core/html.js';

describe('esc', () => {
	test('neutraliza los cinco caracteres que rompen el HTML', () => {
		assert.equal(esc('&'), '&amp;');
		assert.equal(esc('<'), '&lt;');
		assert.equal(esc('>'), '&gt;');
		assert.equal(esc('"'), '&quot;');
		assert.equal(esc("'"), '&#39;');
	});

	test('un nombre de plato con puntuación real se mantiene legible', () => {
		// Producto que existe de verdad en la carta de un cliente
		assert.equal(esc("PA' QUE NO JODA"), 'PA&#39; QUE NO JODA');
		assert.equal(esc('Combo "El Grande"'), 'Combo &quot;El Grande&quot;');
		assert.equal(esc('Salsa & Queso'), 'Salsa &amp; Queso');
	});

	test('un nombre normal no se toca', () => {
		assert.equal(esc('HAMBURGUESA DOBLE'), 'HAMBURGUESA DOBLE');
		assert.equal(esc('Pizza 🍕 grande'), 'Pizza 🍕 grande');
	});

	test('nulo y undefined dan cadena vacía, no la palabra "null"', () => {
		assert.equal(esc(null), '');
		assert.equal(esc(undefined), '');
		assert.equal(esc(0), '0');
	});

	test('no se forma ninguna etiqueta a partir de un nombre', () => {
		const salida = esc('<img src=x onerror=alert(1)>');
		assert.ok(!/<[a-zA-Z]/.test(salida), 'no debe quedar ninguna etiqueta');
		assert.ok(!salida.includes('"'), 'no debe quedar comilla que abra un atributo');
	});
});

describe('escUrl', () => {
	test('deja pasar intactas las URLs que la plataforma usa de verdad', () => {
		for (const u of [
			'https://adminvmenus.verificame.click/uploads/productos/1777475767911-4l4kilgtnnq.jpg',
			'https://tllpmdhkdlqoqpnqmuwn.supabase.co/storage/v1/object/public/vmenus-imagenes/logos/bonzas.png',
			'https://wa.me/573043632573',
			'/uploads/productos/foto.jpg',
			'./relativa.png',
		]) assert.equal(escUrl(u), u, `no debería alterar ${u}`);
	});

	test('bloquea los protocolos que ejecutan código', () => {
		assert.equal(escUrl('javascript:alert(1)'), '#');
		assert.equal(escUrl('data:text/html,<script>alert(1)</script>'), '#');
		assert.equal(escUrl('vbscript:msgbox(1)'), '#');
		assert.equal(escUrl('no es una url'), '#');
	});

	test('sin imagen devuelve vacío, para que actúe el sustituto', () => {
		assert.equal(escUrl(null), '');
		assert.equal(escUrl(''), '');
		assert.equal(escUrl('   '), '');
	});

	test('una imagen_url manipulada no puede colar un manejador', () => {
		// El ataque que era posible antes de escapar: cerrar el atributo src
		// y abrir un onerror propio.
		const salida = escUrl('" onerror="alert(document.cookie)" x="');
		assert.ok(!salida.includes('onerror="alert'), 'el manejador no debe sobrevivir');
	});

	test('mailto y tel siguen valiendo', () => {
		assert.equal(escUrl('mailto:hola@ejemplo.com'), 'mailto:hola@ejemplo.com');
		assert.equal(escUrl('tel:+573001234567'), 'tel:+573001234567');
	});
});
