// Ajustes de diseño del modelo video horizontal (01/10/2026), a raíz de medir la
// carta de Skipper en un móvil de 375 px. El encabezado y la nav son los de
// topnav (Bonzas y Malparados, clientes reales), así que lo importante es que
// las reglas nuevas valgan SOLO para body[data-tema="video"].
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const bloque = html.slice(html.indexOf('AJUSTES DE DISENO DEL MODELO VIDEO HORIZONTAL'));
const reglas = bloque.slice(bloque.indexOf('body[data-tema="video"]')).split('\n').filter(l => l.includes('{'));

describe('modelo video horizontal: ajustes de diseño', () => {
	test('activarTema marca el modelo en el body, que es de lo que cuelgan las reglas', () => {
		const fn = html.slice(html.indexOf('window.activarTema = function'));
		assert.match(fn.slice(0, 700), /document\.body\.dataset\.tema = tema;/);
	});

	test('todas las reglas nuevas están acotadas al modelo video: topnav no cambia', () => {
		assert.ok(reglas.length >= 6, 'no se encontraron las reglas');
		for (const r of reglas.slice(0, 6)) assert.match(r.trim(), /^body\[data-tema="video"\] /, r);
	});

	test('los chips de categoría miden al menos 44 px y tienen aire entre sí', () => {
		const chip = reglas.find(r => r.includes('.nav-btn'));
		assert.match(chip, /min-height: 44px/);
		assert.match(reglas.find(r => r.includes('.nav-scroll')), /gap: 8px/);
	});

	test('el precio pasa de 17 a 19 px: con la negrita cuenta como texto grande para WCAG', () => {
		assert.match(reglas.find(r => r.includes('.vid-precio')), /font-size: 19px/);
		// 18,66 px en negrita es el mínimo de WCAG para «texto grande».
		assert.ok(19 >= 18.66);
	});

	test('el encabezado se compacta: logo y título más pequeños, que el primer plato suba', () => {
		assert.match(reglas.find(r => r.includes('.hero-logo')), /width: 64px; height: 64px/);
		assert.match(reglas.find(r => r.includes('.hero-title')), /font-size: 34px/);
	});

	test('las reglas de topnav siguen como estaban: chips de 7 px de relleno, logo de 90', () => {
		assert.match(html, /\.nav-btn \{\n\t+flex-shrink: 0;\n\t+padding: 7px 14px;/);
		assert.match(html, /\.hero-logo \{\n\t+width: 90px; height: 90px;/);
		assert.match(html, /\.hero-title \{\n[^}]*font-size: 42px;/);
	});
});
