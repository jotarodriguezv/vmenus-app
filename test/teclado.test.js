// La carta sin puntero: V1 y V2 en adminmenus_restaurantes/docs/revision-ux.md.
// La ficha del plato ya sabía de teclado por dentro (Escape, ←/→), pero la
// tarjeta que la abre era un <div> que el tabulador se saltaba.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function nodo() {
	const oyentes = {};
	return {
		tabIndex: -1, atributos: {}, clics: 0, enfocado: 0, isConnected: true,
		setAttribute(k, v) { this.atributos[k] = String(v); },
		addEventListener(ev, fn) { (oyentes[ev] ||= []).push(fn); },
		click() { this.clics++; },
		focus() { this.enfocado++; globalThis.document.activeElement = this; },
		pulsar(key, target = this) {
			let evitado = false;
			const e = { key, target, preventDefault() { evitado = true; } };
			(oyentes.keydown || []).forEach(fn => fn(e));
			return evitado;
		},
	};
}

globalThis.document = { body: {}, activeElement: null };
document.activeElement = document.body;
const { hacerActivable, llevarFocoA, devolverFoco } = await import('../core/teclado.js');

describe('una tarjeta activable', () => {
	test('entra en el orden del tabulador y se anuncia como botón', () => {
		const t = hacerActivable(nodo());
		assert.equal(t.tabIndex, 0);
		assert.equal(t.atributos.role, 'button');
	});

	test('Enter y Espacio la abren; Espacio sin desplazar la página', () => {
		const t = hacerActivable(nodo());
		t.pulsar('Enter');
		const evitado = t.pulsar(' ');
		assert.equal(t.clics, 2);
		assert.equal(evitado, true, 'Espacio abriría la ficha y además bajaría la página');
	});

	test('otras teclas no la abren', () => {
		const t = hacerActivable(nodo());
		t.pulsar('Tab'); t.pulsar('a');
		assert.equal(t.clics, 0);
	});

	test('Enter en un botón de dentro no la abre también a ella', () => {
		// El evento sube desde el botón, que ya hace lo suyo: abrir la tarjeta
		// además serían dos acciones con una tecla.
		const t = hacerActivable(nodo());
		const evitado = t.pulsar('Enter', {});
		assert.equal(t.clics, 0);
		assert.equal(evitado, false);
	});
});

describe('el foco al abrir y cerrar la ficha', () => {
	beforeEach(() => { devolverFoco(); document.activeElement = document.body; });

	test('al cerrar vuelve a la tarjeta de la que salió', () => {
		const tarjeta = nodo(), cerrar = nodo();
		tarjeta.focus();
		llevarFocoA(cerrar);
		assert.equal(document.activeElement, cerrar);
		devolverFoco();
		assert.equal(document.activeElement, tarjeta);
	});

	test('un origen que quedó colgado no manda el foco a otro plato', () => {
		// Visto en el navegador: una ficha cerrada sin pasar por devolverFoco
		// dejó guardada una tarjeta, y el siguiente cierre volvió a esa.
		const vieja = nodo(), nueva = nodo(), cerrar = nodo();
		vieja.focus();
		llevarFocoA(cerrar);          // se abre y se cierra por otro camino
		nueva.focus();
		llevarFocoA(cerrar);
		devolverFoco();
		assert.equal(document.activeElement, nueva);
	});

	test('pasar de plato con las flechas no vuelve a abrir la ficha', () => {
		// Es lo que permite no preocuparse de ese caso en llevarFocoA.
		const src = fs.readFileSync(new URL('../core/menu.js', import.meta.url), 'utf8');
		const navegar = src.match(/export function navigateModal\(dir\) \{[\s\S]*?\n\t\}/)[0];
		assert.doesNotMatch(navegar, /openModal|llevarFocoA/);
	});

	test('si la tarjeta ya no está en la página, no se intenta enfocar', () => {
		const tarjeta = nodo(), cerrar = nodo();
		tarjeta.focus();
		llevarFocoA(cerrar);
		tarjeta.isConnected = false;
		const antes = tarjeta.enfocado;
		devolverFoco();
		assert.equal(tarjeta.enfocado, antes);
	});
});

describe('dónde se usa', () => {
	const leer = f => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

	test('la carta deja ampliar con los dedos', () => {
		const meta = leer('index.html').match(/<meta name="viewport"[^>]*>/)[0];
		assert.doesNotMatch(meta, /user-scalable\s*=\s*no/);
		assert.doesNotMatch(meta, /maximum-scale/);
	});

	test('cada <div> que abre un plato es activable con teclado', () => {
		// Un onclick nuevo sobre una tarjeta sin hacerActivable al lado es cómo
		// vuelve este fallo. Se cuentan los dos en los archivos que pintan platos.
		const casos = {
			'core/menu.js': /(item|row|card)\.onclick = \(\) => openModal/g,
			'temas/explorar.js': /div\.onclick = \(\) => openExpModal/g,
			'temas/carrito.js': /(row|card)\.onclick = \(\) => \{/g,
		};
		for (const [f, re] of Object.entries(casos)) {
			const src = leer(f);
			const abridores = [...src.matchAll(re)].map(m => m[1] || 'div');
			assert.ok(abridores.length > 0, `${f}: no se encontraron tarjetas`);
			// Se cuentan, no basta con que aparezca: Explorar tiene dos tarjetas
			// que se llaman igual, y quitar una pasaría desapercibido.
			for (const nombre of new Set(abridores)) {
				const tarjetas = abridores.filter(n => n === nombre).length;
				const activables = src.split(`hacerActivable(${nombre})`).length - 1;
				assert.ok(activables >= tarjetas, `${f}: ${tarjetas} «${nombre}» abren un plato y solo ${activables} son activables`);
			}
		}
	});

	test('quien usa las funciones de teclado las importa', () => {
		// Pasó al aplicar V2: temas/carrito.js llamaba a hacerActivable sin
		// importarla, y la carta del modelo Carrito entera dejaba de cargar con
		// «No se pudo cargar el menú». La prueba de arriba lee el texto y no lo
		// vio; se cazó abriendo la carta en un navegador.
		const archivos = ['core/menu.js', 'core/carrusel.js', 'temas/carrito.js', 'temas/explorar.js',
			'temas/sidebar.js', 'temas/topnav.js', 'temas/vertical.js', 'temas/video.js'];
		for (const f of archivos) {
			const src = leer(f);
			const importacion = src.match(/import \{([^}]*)\} from '\.{1,2}\/(core\/)?teclado\.js'/);
			const importadas = importacion ? importacion[1].split(',').map(s => s.trim()) : [];
			for (const fn of ['hacerActivable', 'llevarFocoA', 'devolverFoco']) {
				if (new RegExp(`\\b${fn}\\(`).test(src)) {
					assert.ok(importadas.includes(fn), `${f} llama a ${fn} sin importarla`);
				}
			}
		}
	});

	test('cerrar la ficha devuelve el foco solo si estaba abierta', () => {
		// Escape llama a closeModal esté abierta o no; sin la guarda, cada
		// Escape en cualquier parte de la carta movería el foco.
		const menu = leer('core/menu.js').match(/export function closeModal\(\) \{[\s\S]*?\n\t\}/)[0];
		assert.match(menu, /if \(estabaAbierta\) devolverFoco\(\)/);
		const exp = leer('temas/explorar.js').match(/function closeExpModal\(\) \{[\s\S]*?\n\}/)[0];
		assert.match(exp, /if \(estabaAbierta\) devolverFoco\(\)/);
	});

	test('la ficha de Explorar se cierra con Escape, solo si está abierta', () => {
		const src = leer('temas/explorar.js');
		assert.match(src, /e\.key === 'Escape' && modal\.classList\.contains\('open'\)\) closeExpModal\(\)/);
	});
});
