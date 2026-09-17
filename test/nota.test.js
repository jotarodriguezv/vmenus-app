// La nota de una categoría (P4 en adminmenus_restaurantes/docs/revision-ux.md).
// Sustituye a los platos de $ 0 que se usaban como aviso.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { notaDe } from '../core/html.js';

const leer = ruta => fs.readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');

describe('notaDe', () => {
	test('pinta la nota escapada, con la clase pedida', () => {
		assert.equal(notaDe({ atributos: { nota: 'Todas van con papas' } }),
			'<p class="categoria-nota">Todas van con papas</p>');
		assert.equal(notaDe({ atributos: { nota: '<img src=x onerror=alert(1)>' } }, 'categoria-nota vid-nota'),
			'<p class="categoria-nota vid-nota">&lt;img src=x onerror=alert(1)&gt;</p>');
	});

	test('sin nota, vacía o sin atributos no pinta nada', () => {
		assert.equal(notaDe({ atributos: {} }), '');
		assert.equal(notaDe({ atributos: { nota: '   ' } }), '');
		assert.equal(notaDe({}), '');
		assert.equal(notaDe(null), '');
	});
});

describe('todos los modelos pintan la nota', () => {
	// Uno que se olvide deja el aviso fuera justo en las cartas de ese modelo.
	const MODELOS = {
		'core/menu.js': /<\/div>\s*\$\{notaDe\(cat\)\}/,
		'temas/explorar.js': /section\.appendChild\(header\);\s*section\.insertAdjacentHTML\('beforeend', notaDe\(cat\)\);/,
		'temas/video.js': /<div class="vid-cat">[^\n]*<\/div>\s*\$\{notaDe\(cat, 'categoria-nota vid-nota'\)\}/,
		'temas/vertical.js': /\$\{i === 0 \? notaDe\(cat, 'categoria-nota ver-nota'\) : ''\}/,
	};
	for (const [archivo, patron] of Object.entries(MODELOS)) {
		test(archivo, () => {
			const src = leer(archivo);
			assert.match(src, /import \{[^}]*\bnotaDe\b[^}]*\} from '[./]+(core\/)?html\.js'/);
			assert.match(src, patron);
		});
	}

	test('la nota tiene estilo en la carta', () => {
		assert.match(leer('index.html'), /\.categoria-nota \{[^}]*color: var\(--text-muted\)/);
	});
});
