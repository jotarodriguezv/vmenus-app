// El lateral del modelo Sidebar. Lo reutiliza también el modelo Carrito
// (temas/carrito.js importa su buildNav), así que un fallo aquí sale en dos.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// DOM mínimo: solo lo que buildNav() toca de verdad.
function nodoFalso() {
	return {
		innerHTML: '', className: '', textContent: '', onclick: null,
		oyentes: {},
		appendChild(h) { return h; },
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
};

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
