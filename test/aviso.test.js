// El aviso de vista previa es lo único que separa una vista previa de una
// carta real a ojos del comensal, y la vista previa la puede armar cualquiera
// con una URL. Estas pruebas fijan lo que lo hace intocable.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { blindarAnfitrion, BLINDAJE_AVISO } from '../core/aviso.js';

// Un elemento de mentira que apunta cada setProperty con su prioridad.
const elementoFalso = () => {
	const puestas = [];
	return {
		puestas,
		style: { setProperty: (prop, valor, prioridad) => puestas.push({ prop, valor, prioridad }) },
	};
};

describe('blindarAnfitrion · el aviso no se puede tapar con CSS', () => {
	test('TODAS las propiedades van con !important', () => {
		// Es la prueba que importa. El contenido del aviso está en un shadow
		// root cerrado, pero el <div> que lo sostiene vive en el DOM normal:
		// sin !important, un `div{display:none!important}` en css_custom le
		// gana al estilo en línea y el aviso desaparece. Comprobado en un
		// navegador de verdad antes de arreglarlo.
		const el = elementoFalso();
		blindarAnfitrion(el);

		assert.ok(el.puestas.length > 0, 'algo tiene que ponerse');
		const flojas = el.puestas.filter(p => p.prioridad !== 'important');
		assert.deepEqual(flojas, [], 'ninguna puede quedarse sin prioridad');
	});

	test('cubre las formas conocidas de esconder un elemento', () => {
		// Cada una tumbaba el aviso antes del arreglo. Quitar una de aquí
		// vuelve a abrir esa puerta, así que la lista es la prueba.
		for (const prop of ['display', 'opacity', 'visibility', 'transform',
		                    'height', 'max-height', 'overflow', 'filter', 'clip-path'])
			assert.ok(prop in BLINDAJE_AVISO, `falta blindar '${prop}'`);
	});

	test('se queda arriba del todo y por encima de la carta', () => {
		assert.equal(BLINDAJE_AVISO.position, 'fixed');
		assert.equal(BLINDAJE_AVISO['z-index'], '2147483647', 'el máximo entero de 32 bits');
	});

	test('devuelve el mismo elemento, para poder encadenarlo', () => {
		const el = elementoFalso();
		assert.equal(blindarAnfitrion(el), el);
	});
});
