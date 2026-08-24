// La vista previa (?preview=...) la puede armar cualquiera: es una URL, no
// una sesión del panel. Estas pruebas fijan la única regla que la hace
// segura — puede cambiar cómo se ve la carta, nunca a dónde apunta.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarPreview, CLAVES_APARIENCIA } from '../core/preview.js';

// Un restaurante como el que devuelve Supabase, con lo que de verdad importa:
// el teléfono al que el carrito manda los pedidos.
const bonzas = () => ({
	id: 'r1',
	nombre: 'Bonzas',
	color_primario: '#3dd68c',
	color_secundario: '#a374af',
	atributos: {
		nav: 'topnav',
		whatsapp_pedidos: '573001112233',
		metodos_pago: ['efectivo'],
		social_whatsapp: '573001112233',
		color_card: '#1a1825',
	},
});

describe('aplicarPreview · lo que un enlace preparado NO puede cambiar', () => {
	test('no puede desviar el WhatsApp de pedidos', () => {
		// El ataque concreto: se reparte el enlace de la carta de verdad, con
		// su logo y sus precios, y los pedidos llegan a otro teléfono. El
		// comensal no tiene forma de notarlo.
		const r = aplicarPreview(bonzas(), {
			atributos: { whatsapp_pedidos: '573009998877' },
		});
		assert.equal(r.atributos.whatsapp_pedidos, '573001112233');
	});

	test('no puede cambiar los métodos de pago ni las redes', () => {
		const r = aplicarPreview(bonzas(), {
			atributos: {
				metodos_pago: ['transferencia a esta cuenta'],
				social_whatsapp: '573009998877',
			},
		});
		assert.deepEqual(r.atributos.metodos_pago, ['efectivo']);
		assert.equal(r.atributos.social_whatsapp, '573001112233');
	});

	test('ninguna clave de destino está en la lista de apariencia', () => {
		// Guardia para el futuro: la lista se amplía con el tiempo y es fácil
		// colar una de estas sin caer en lo que abre.
		for (const prohibida of ['whatsapp_pedidos', 'metodos_pago',
			'social_whatsapp', 'social_facebook', 'social_instagram',
			'social_tiktok', 'toppings_platino', 'toppings_premium', 'salsas'])
			assert.ok(!CLAVES_APARIENCIA.includes(prohibida),
				`${prohibida} no puede venir de la URL`);
	});

	test('una clave desconocida se ignora en vez de colarse', () => {
		const r = aplicarPreview(bonzas(), { atributos: { inventada: 'sí' } });
		assert.equal(r.atributos.inventada, undefined);
	});
});

describe('aplicarPreview · lo que sí tiene que seguir funcionando', () => {
	test('los colores y el modelo se previsualizan', () => {
		// Es para lo que existe: ver la apariencia antes de guardarla.
		const r = aplicarPreview(bonzas(), {
			color_primario: '#ff0000',
			atributos: { nav: 'vertical', estilo: 'intenso', color_card: '#000000' },
		});
		assert.equal(r.color_primario, '#ff0000');
		assert.equal(r.atributos.nav, 'vertical');
		assert.equal(r.atributos.estilo, 'intenso');
		assert.equal(r.atributos.color_card, '#000000');
	});

	test('lo que no se previsualiza se conserva, no se borra', () => {
		// El draft del panel manda solo apariencia; el resto del restaurante
		// tiene que seguir estando o la carta se vería a medias.
		const r = aplicarPreview(bonzas(), { atributos: { color_card: '#111' } });
		assert.equal(r.atributos.whatsapp_pedidos, '573001112233');
		assert.equal(r.nombre, 'Bonzas');
	});

	test('no se toca el restaurante original', () => {
		const r = bonzas();
		aplicarPreview(r, { color_primario: '#ff0000', atributos: { nav: 'vertical' } });
		assert.equal(r.color_primario, '#3dd68c');
		assert.equal(r.atributos.nav, 'topnav');
	});
});

describe('aplicarPreview · entradas rotas', () => {
	test('un draft que no es un objeto no rompe la carta', () => {
		// El parámetro llega de la URL: puede ser cualquier cosa.
		for (const basura of [null, undefined, 'texto', 42, []])
			assert.equal(aplicarPreview(bonzas(), basura).atributos.nav, 'topnav');
	});

	test('un "atributos" que no es un objeto se ignora entero', () => {
		for (const basura of ['x', 5, ['nav'], null]) {
			const r = aplicarPreview(bonzas(), { atributos: basura });
			assert.equal(r.atributos.nav, 'topnav');
			assert.equal(r.atributos.whatsapp_pedidos, '573001112233');
		}
	});

	test('colores que no son cadenas no se aplican', () => {
		const r = aplicarPreview(bonzas(), { color_primario: { malicia: 1 } });
		assert.equal(r.color_primario, '#3dd68c');
	});
});
