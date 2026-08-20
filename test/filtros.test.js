// Los filtros. El restaurante define cuáles ofrece y cada plato dice cuáles
// cumple; esto decide qué se enseña. Vivía dentro de temas/explorar.js, así
// que era el único modelo que podía filtrar aunque los datos estuvieran ahí
// para todos.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const { setRestaurante, setProductos } = await import('../core/menu.js');
const { filtrosMap, filtrosEnUso, pasaFiltros } = await import('../core/filtros.js');

const CATALOGO = [
	{ id: 'veg',    label: 'Vegetariano', emoji: '🌱' },
	{ id: 'gluten', label: 'Sin gluten',  emoji: '🌾' },
	{ id: 'picante',label: 'Picante',     emoji: '🌶' },
];
const P = (id, filtros) => ({ id, nombre: id, atributos: filtros ? { filtros } : {} });

beforeEach(() => {
	setRestaurante({ id: 'r1', slug: 'pruebas', atributos: { filtros_disponibles: CATALOGO } });
	setProductos([]);
});

describe('filtrosEnUso · solo se enseña lo que sirve de algo', () => {
	test('un filtro que ningún plato cumple no se enseña', () => {
		// Un chip que al pulsarlo vacía la carta es peor que no tenerlo.
		setProductos([P('a', ['veg'])]);
		assert.deepEqual(filtrosEnUso().map(f => f.id), ['veg']);
	});

	test('no se repite aunque lo cumplan varios platos', () => {
		setProductos([P('a', ['veg']), P('b', ['veg']), P('c', ['gluten'])]);
		assert.deepEqual(filtrosEnUso().map(f => f.id).sort(), ['gluten', 'veg']);
	});

	test('un plato que nombra un filtro que ya no existe no lo resucita', () => {
		// El restaurante quitó 'picante' del catálogo pero el plato lo sigue
		// nombrando. No puede aparecer: no tiene ni etiqueta ni emoji.
		setRestaurante({ id: 'r1', slug: 'pruebas', atributos: { filtros_disponibles: [CATALOGO[0]] } });
		setProductos([P('a', ['veg', 'picante'])]);
		assert.deepEqual(filtrosEnUso().map(f => f.id), ['veg']);
	});

	test('sin catálogo no hay filtros', () => {
		setRestaurante({ id: 'r1', slug: 'pruebas', atributos: {} });
		setProductos([P('a', ['veg'])]);
		assert.deepEqual(filtrosEnUso(), []);
	});
});

describe('pasaFiltros · con varios activos se exigen todos', () => {
	test('sin filtros activos pasa todo', () => {
		assert.equal(pasaFiltros(P('a'), new Set()), true);
		assert.equal(pasaFiltros(P('a'), null), true, 'y si no le pasan nada tampoco estorba');
	});

	test('un filtro activo deja fuera al que no lo cumple', () => {
		assert.equal(pasaFiltros(P('a', ['veg']), new Set(['veg'])), true);
		assert.equal(pasaFiltros(P('b', ['gluten']), new Set(['veg'])), false);
	});

	test('dos activos exigen los dos, no cualquiera', () => {
		// Quien marca "vegetariano" y "sin gluten" busca algo que cumpla las
		// dos cosas. Darle lo que cumple una sola es lo contrario de lo que
		// pidió, y con alérgenos de por medio eso importa.
		const activos = new Set(['veg', 'gluten']);
		assert.equal(pasaFiltros(P('a', ['veg', 'gluten']), activos), true);
		assert.equal(pasaFiltros(P('b', ['veg']), activos), false);
		assert.equal(pasaFiltros(P('c', ['gluten']), activos), false);
	});

	test('un plato sin filtros no pasa ninguno', () => {
		assert.equal(pasaFiltros(P('a'), new Set(['veg'])), false);
	});
});

describe('filtrosMap · el catálogo indexado', () => {
	test('conserva etiqueta y emoji de cada uno', () => {
		const m = filtrosMap();
		assert.equal(m.veg.label, 'Vegetariano');
		assert.equal(m.gluten.emoji, '🌾');
	});
});
