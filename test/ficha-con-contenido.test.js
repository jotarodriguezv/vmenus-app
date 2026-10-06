// ¿Una ficha tendría algo que enseñar además del nombre y el precio? (fichaTieneQueMostrar)
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { fichaTieneQueMostrar } from '../core/carrusel.js';

const plato = (extra = {}, atributos = {}) => ({ nombre: 'X', atributos, ...extra });

describe('fichaTieneQueMostrar', () => {
	test('un plato pelado no tiene qué mostrar', () => {
		assert.equal(fichaTieneQueMostrar(plato()), false);
		assert.equal(fichaTieneQueMostrar(plato({ descripcion: '   ' })), false);
		assert.equal(fichaTieneQueMostrar(null), false);
	});

	test('foto, descripción, descripción larga, filtros, etiquetas o presentaciones bastan', () => {
		assert.equal(fichaTieneQueMostrar(plato({ imagen_url: '/a.jpg' })), true);
		assert.equal(fichaTieneQueMostrar(plato({}, { imagenes: ['/b.jpg'] })), true);
		assert.equal(fichaTieneQueMostrar(plato({ descripcion: 'Rico' })), true);
		assert.equal(fichaTieneQueMostrar(plato({ descripcion_avanzada: 'Con detalle' })), true);
		assert.equal(fichaTieneQueMostrar(plato(), { nFiltros: 1 }), true);
		for (const k of ['popular', 'chef', 'nuevo']) assert.equal(fichaTieneQueMostrar(plato({}, { [k]: true })), true, k);
		assert.equal(fichaTieneQueMostrar(plato({}, { presentaciones: [{ nombre: '1X', precio_numerico: 1 }, { nombre: '2X', precio_numerico: 2 }] })), true);
	});

	test('la foto solo cuenta si el tema la enseña en su ficha', () => {
		assert.equal(fichaTieneQueMostrar(plato({ imagen_url: '/a.jpg' }), { conFoto: false }), false);
	});

	test('una sola presentación no es contenido; la personalización tampoco (ya la tiene el «+»)', () => {
		assert.equal(fichaTieneQueMostrar(plato({}, { presentaciones: [{ nombre: '1X', precio_numerico: 1 }] })), false);
		assert.equal(fichaTieneQueMostrar(plato({}, { personalizacion: { platino: ['t1'] } })), false);
	});
});
