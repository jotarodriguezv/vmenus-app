// El lateral del modelo Sidebar. Lo reutiliza también el modelo Carrito
// (temas/carrito.js importa su buildNav), así que un fallo aquí sale en dos.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// DOM mínimo: solo lo que buildNav() toca de verdad.
function nodoFalso() {
	return {
		innerHTML: '', className: '', textContent: '', onclick: null,
		oyentes: {}, atributos: {}, hijos: [], isConnected: true, enfocado: 0,
		setAttribute(k, v) { this.atributos[k] = String(v); },
		focus() { this.enfocado++; globalThis.document.activeElement = this; },
		querySelector(sel) { return sel === '.sidebar-link' ? (this.hijos[0] || null) : null; },
		appendChild(h) { this.hijos.push(h); return h; },
		addEventListener(ev, fn) { (this.oyentes[ev] ||= []).push(fn); },
		classList: {
			_c: new Set(),
			add(c) { this._c.add(c); }, remove(c) { this._c.delete(c); },
			contains(c) { return this._c.has(c); },
			toggle(c, on) { on ? this._c.add(c) : this._c.delete(c); },
		},
	};
}

const nodos = {};
const oyentesDoc = {};
globalThis.document = {
	getElementById: id => (nodos[id] ||= nodoFalso()),
	createElement: () => nodoFalso(),
	addEventListener(ev, fn) { (oyentesDoc[ev] ||= []).push(fn); },
	body: { style: {} },
	activeElement: null,
};
document.activeElement = document.body;

const { buildNav } = await import('../temas/sidebar.js');
buildNav();

const escape = () => oyentesDoc.keydown.forEach(fn => fn({ key: 'Escape' }));

// Se piden por getElementById y no por nodos.x: buildNav() solo toca cuatro
// ids, y '#sidebar' no nace hasta que alguien lo pide —dentro de openSidebar,
// que aquí no se llama—. El falso los crea al vuelo.
const lateral = () => document.getElementById('sidebar');
const velo    = () => document.getElementById('overlay');
const abrir = () => {
	lateral().classList.add('open');
	velo().classList.add('open');
	document.body.style.overflow = 'hidden';
};

describe('Escape cierra el lateral', () => {
	beforeEach(() => {
		lateral().classList.remove('open');
		velo().classList.remove('open');
		document.body.style.overflow = '';
	});

	test('se registró un oyente de teclado', () => {
		assert.ok(oyentesDoc.keydown?.length, 'buildNav no registró ningún keydown');
	});

	test('con el lateral abierto, Escape lo cierra', () => {
		// Es la capa que tapa la pantalla entera en un móvil, y hasta ahora era
		// la única que ignoraba la tecla que ya cierra la ficha del plato, la
		// lupa y la promoción.
		abrir();
		escape();
		assert.equal(lateral().classList.contains('open'), false);
		assert.equal(velo().classList.contains('open'), false, 'el velo se queda puesto');
		assert.equal(document.body.style.overflow, '', 'la página sigue sin poder desplazarse');
	});

	test('con el lateral cerrado, Escape no toca el scroll de la página', () => {
		// closeSidebar limpia body.style.overflow. Sin la guarda, un Escape
		// con el lateral cerrado le devolvería el scroll a la página por
		// debajo de otra capa —la ficha del plato, la promoción— que sí lo
		// tenía bloqueado a propósito.
		document.body.style.overflow = 'hidden';   // lo puso otra capa
		escape();
		assert.equal(document.body.style.overflow, 'hidden',
			'Escape con el lateral cerrado ha desbloqueado el scroll de otra capa');
	});

	test('otra tecla no cierra nada', () => {
		abrir();
		oyentesDoc.keydown.forEach(fn => fn({ key: 'a' }));
		assert.equal(lateral().classList.contains('open'), true);
	});
});

describe('el lateral con teclado y lector de pantalla', () => {
	// MD1 y MD4 en adminmenus_restaurantes/docs/revision-ux.md.
	const clic = id => document.getElementById(id).oyentes.click.forEach(fn => fn());
	const cerrarSiAbierto = () => { if (lateral().classList.contains('open')) clic('closeMenu'); };
	beforeEach(cerrarSiAbierto);

	test('al abrirlo el foco entra en el lateral y el botón dice que está abierto', () => {
		const boton = document.getElementById('menuToggle');
		boton.focus();
		clic('menuToggle');
		assert.notEqual(document.activeElement, boton, 'el foco se quedó en el botón de fuera');
		assert.equal(boton.atributos['aria-expanded'], 'true');
	});

	test('al cerrarlo el foco vuelve al botón que lo abrió', () => {
		const boton = document.getElementById('menuToggle');
		boton.focus();
		clic('menuToggle');
		clic('closeMenu');
		assert.equal(document.activeElement, boton);
		assert.equal(boton.atributos['aria-expanded'], 'false');
	});

	test('aunque el botón no tuviera el foco al pulsarlo, al cerrar vuelve a él', () => {
		// Un toque en Safari no enfoca el botón. Visto en un navegador: al cerrar,
		// el foco acababa donde estuviera antes, no en el botón del lateral.
		document.getElementById('otraCosa').focus();
		clic('menuToggle');
		clic('closeMenu');
		assert.equal(document.activeElement, document.getElementById('menuToggle'));
	});

	test('Escape también devuelve el foco al botón', () => {
		const boton = document.getElementById('menuToggle');
		boton.focus();
		clic('menuToggle');
		escape();
		assert.equal(document.activeElement, boton);
	});

	test('el marcado da nombre a los dos botones y al lateral', async () => {
		const fs = await import('node:fs');
		const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
		assert.match(html.match(/<button class="menu-toggle"[^>]*>/)[0], /aria-label="[^"]+"/);
		assert.match(html.match(/<button class="menu-toggle"[^>]*>/)[0], /aria-expanded="false"/);
		assert.match(html.match(/<button class="close-menu"[^>]*>/)[0], /aria-label="Cerrar el menú"/);
		assert.match(html.match(/<div class="sidebar" id="sidebar"[^>]*>/)[0], /role="dialog"/);
	});

	test('el Tab queda dentro del lateral mientras está abierto', async () => {
		const fs = await import('node:fs');
		const src = fs.readFileSync(new URL('../temas/sidebar.js', import.meta.url), 'utf8');
		assert.match(src.match(/function openSidebar\(\) \{[\s\S]*?\n\}/)[0], /encerrarTab\(lateral\)/);
		assert.match(src.match(/function closeSidebar\(\) \{[\s\S]*?\n\}/)[0], /soltarTab\(lateral\)/);
	});
});
