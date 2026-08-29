// Todo lo que acaba en un src, un href o un poster tiene que pasar por
// escUrl(), no por esc(). No es lo mismo: esc() evita salirse del atributo,
// escUrl() además exige que el destino sea una URL de verdad.
//
// Esta prueba existe porque el fallo de este sistema no es escapar mal, es
// escapar en un archivo y no en el de al lado. Pasó con esc(), que vivía
// dentro de temas/explorar.js mientras los demás temas se quedaban sin él, y
// volvió a pasar al revés: explorar.js era el único que seguía usando esc()
// para los src de imagen.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escUrl, esc } from '../core/html.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

function archivosJs() {
	const salida = [];
	for (const carpeta of ['core', 'temas'])
		for (const f of readdirSync(join(RAIZ, carpeta)))
			if (f.endsWith('.js')) salida.push([`${carpeta}/${f}`, readFileSync(join(RAIZ, carpeta, f), 'utf8')]);
	return salida;
}

describe('escUrl · una sola puerta para las URLs', () => {
	test('ningún src, href ni poster usa esc() en su lugar', () => {
		// Se busca la forma exacta que tenía el fallo: un atributo de URL
		// interpolado con esc(). Si aparece una nueva, esta prueba la nombra.
		const culpables = [];
		for (const [nombre, src] of archivosJs())
			for (const m of src.matchAll(/(src|href|poster|data-src)\s*=\s*["']\$\{esc\(/g))
				culpables.push(`${nombre}: ${m[1]}`);
		assert.deepEqual(culpables, [], 'usa escUrl() en estos atributos');
	});

	test('escUrl desactiva lo que no es una URL de verdad', () => {
		// Lo que esc() NO hace: escapar evita salirse del atributo, pero deja
		// entrar un javascript: tal cual.
		assert.equal(escUrl('javascript:alert(1)'), '#');
		assert.equal(escUrl('data:text/html,<script>'), '#');
		assert.equal(escUrl('no soy una url'), '#');
		assert.ok(esc('javascript:alert(1)').startsWith('javascript:'), 'esc lo deja pasar, por eso no basta');
	});

	test('lo que sí es una URL pasa entera', () => {
		assert.equal(escUrl('/uploads/productos/foto.jpg'), '/uploads/productos/foto.jpg');
		assert.equal(escUrl('https://vmenus.co/x.png'), 'https://vmenus.co/x.png');
		assert.equal(escUrl(''), '', 'vacío es vacío, no "#"');
		assert.equal(escUrl(null), '');
	});

	test('una URL con comillas no se sale del atributo', () => {
		const salida = escUrl('/uploads/a".jpg" onerror="alert(1)');
		assert.ok(!salida.includes('"'), 'no puede quedar comilla que cierre el src');
	});
});
