// Las sedes: la URL, los datos del negocio por encima, y los precios y platos de
// cada local. Son funciones puras (core/sedes.js): aquí no hay navegador ni base.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
	leerRuta, sedeDeLaUrl, restauranteDeLaSede, productosDeLaSede,
	reordenarSiEsPorPrecio, categoriasDeLaSede, rutaDeSede, CLAVES_DE_SEDE,
	recordarEleccionDeSede, vieneDelSelector,
} from '../core/sedes.js';

describe('leerRuta · el restaurante y la sede en la URL', () => {
	test('con la ruta: /restaurante y /restaurante/sede', () => {
		assert.deepEqual(leerRuta('menu.vmenus.co', '/bonzas'), { slug: 'bonzas', sedeSlug: '' });
		assert.deepEqual(leerRuta('menu.vmenus.co', '/enchulados/bucaramanga'), { slug: 'enchulados', sedeSlug: 'bucaramanga' });
		assert.deepEqual(leerRuta('menu.vmenus.co', '/enchulados/bucaramanga/'), { slug: 'enchulados', sedeSlug: 'bucaramanga' });
	});
	test('con el subdominio: la sede es el primer trozo de la ruta', () => {
		assert.deepEqual(leerRuta('bonzas.vmenus.co', '/'), { slug: 'bonzas', sedeSlug: '' });
		assert.deepEqual(leerRuta('enchulados.vmenus.co', '/bucaramanga'), { slug: 'enchulados', sedeSlug: 'bucaramanga' });
	});
	test('localhost, IP y dominio desnudo: solo queda la ruta', () => {
		assert.deepEqual(leerRuta('localhost', '/demo/sede'), { slug: 'demo', sedeSlug: 'sede' });
		assert.deepEqual(leerRuta('127.0.0.1', '/demo'), { slug: 'demo', sedeSlug: '' });
		assert.deepEqual(leerRuta('vmenus.co', '/demo'), { slug: 'demo', sedeSlug: '' });
	});
	test('un subdominio reservado cuenta como la plataforma, no como restaurante', () => {
		for (const h of ['menu', 'www', 'admin', 'app', 'api'])
			assert.deepEqual(leerRuta(`${h}.vmenus.co`, '/x/y'), { slug: 'x', sedeSlug: 'y' });
	});
	test('sin ruta no hay restaurante', () => {
		assert.deepEqual(leerRuta('menu.vmenus.co', '/'), { slug: '', sedeSlug: '' });
	});
});

describe('rutaDeSede · el enlace conserva la forma de la URL', () => {
	test('por ruta y por subdominio', () => {
		assert.equal(rutaDeSede('menu.vmenus.co', 'enchulados', 'piedecuesta'), '/enchulados/piedecuesta');
		assert.equal(rutaDeSede('enchulados.vmenus.co', 'enchulados', 'piedecuesta'), '/piedecuesta');
		assert.equal(rutaDeSede('localhost', 'demo', 'a'), '/demo/a');
	});
});

describe('sedeDeLaUrl', () => {
	const sedes = [{ id: '1', slug: 'piedecuesta' }, { id: '2', slug: 'bucaramanga' }];
	test('encuentra la que dice la URL, sin importar mayúsculas', () => {
		assert.equal(sedeDeLaUrl(sedes, 'bucaramanga').id, '2');
		assert.equal(sedeDeLaUrl(sedes, 'Bucaramanga').id, '2');
	});
	test('sin trozo, con uno que no es de ninguna o sin sedes: null (hay que elegir)', () => {
		assert.equal(sedeDeLaUrl(sedes, ''), null);
		assert.equal(sedeDeLaUrl(sedes, 'cali'), null);
		assert.equal(sedeDeLaUrl([], 'bucaramanga'), null);
		assert.equal(sedeDeLaUrl(undefined, 'bucaramanga'), null);
	});
});

describe('restauranteDeLaSede · los datos del negocio de cada local', () => {
	const restaurante = {
		id: 'r', nombre: 'Demo', slug: 'demo', color_primario: '#f00',
		atributos: { direccion: 'Calle 1', whatsapp_negocio: '3001111111', correo: 'a@b.co', css_custom: 'body{}' },
	};
	test('sin sede devuelve el mismo restaurante', () => {
		assert.equal(restauranteDeLaSede(restaurante, null), restaurante);
	});
	test('lo que la sede trae manda; lo que no trae se hereda', () => {
		const r = restauranteDeLaSede(restaurante, { id: 's', slug: 'b', nombre: 'Bucaramanga', atributos: { direccion: 'Carrera 2', whatsapp_negocio: '3002222222' } });
		assert.equal(r.atributos.direccion, 'Carrera 2');
		assert.equal(r.atributos.whatsapp_negocio, '3002222222');
		assert.equal(r.atributos.correo, 'a@b.co');
		assert.equal(r.color_primario, '#f00');
	});
	test("un '' de la sede se respeta: es «no hay», no «heredar»", () => {
		const r = restauranteDeLaSede(restaurante, { id: 's', slug: 'b', nombre: 'B', atributos: { correo: '' } });
		assert.equal(r.atributos.correo, '');
	});
	test('una sede no puede pisar lo que no es dato del negocio', () => {
		const r = restauranteDeLaSede(restaurante, { id: 's', slug: 'b', nombre: 'B', atributos: { css_custom: 'x{}', color_dark: '#000', direccion: 'Z' } });
		assert.equal(r.atributos.css_custom, 'body{}');
		assert.equal(r.atributos.color_dark, undefined);
		assert.equal(r.atributos.direccion, 'Z');
	});
	test('el nombre lleva la sede, y no se toca el original', () => {
		const r = restauranteDeLaSede(restaurante, { id: 's', slug: 'b', nombre: 'Bucaramanga', atributos: {} });
		assert.equal(r.nombre, 'Demo · Bucaramanga');
		assert.deepEqual(r.sede, { id: 's', slug: 'b', nombre: 'Bucaramanga' });
		assert.equal(restaurante.nombre, 'Demo');
		assert.equal(restaurante.atributos.direccion, 'Calle 1');
	});
	test('las claves permitidas son las del negocio', () => {
		assert.deepEqual(CLAVES_DE_SEDE.slice().sort(), [
			'correo', 'direccion', 'horario_atencion', 'mapa_url', 'resena_url', 'whatsapp_boton', 'whatsapp_negocio',
		]);
	});
});

describe('productosDeLaSede · precio y disponibilidad por local', () => {
	const base = [
		{ id: 'a', nombre: 'Nachos', precio: '$ 26.000', precio_numerico: 26000, categoria_id: 'c1', oferta_activa: true, oferta_precio_numerico: 20000 },
		{ id: 'b', nombre: 'Soda', precio: '$ 9.000', precio_numerico: 9000, categoria_id: 'c2' },
		{ id: 'c', nombre: 'Gaseosa', precio: '$ 5.000', precio_numerico: 5000, categoria_id: 'c2' },
	];
	test('sin filas, la carta es la base', () => {
		assert.deepEqual(productosDeLaSede(base, []), base);
		assert.deepEqual(productosDeLaSede(base, undefined), base);
	});
	test('con precio propio, manda sobre el base (número y texto)', () => {
		const r = productosDeLaSede(base, [{ producto_id: 'a', precio: '$ 31.000', precio_numerico: '31000' }]);
		assert.equal(r[0].precio_numerico, 31000);
		assert.equal(r[0].precio, '$ 31.000');
		assert.equal(r[1], base[1], 'los demás no se copian siquiera');
	});
	test('el texto se arma del número si la fila no lo trae', () => {
		const r = productosDeLaSede(base, [{ producto_id: 'b', precio_numerico: 11000 }]);
		assert.equal(r[1].precio, '$ 11.000');
	});
	test('disponible=false quita el plato de la sede', () => {
		const r = productosDeLaSede(base, [{ producto_id: 'c', disponible: false }]);
		assert.deepEqual(r.map(p => p.id), ['a', 'b']);
	});
	test('disponible=null hereda: el plato sigue', () => {
		const r = productosDeLaSede(base, [{ producto_id: 'c', disponible: null }]);
		assert.equal(r.length, 3);
	});
	test('la oferta se apaga si la sede cambia el precio, y se conserva si no', () => {
		const cambia = productosDeLaSede(base, [{ producto_id: 'a', precio_numerico: 31000 }]);
		assert.equal(cambia[0].oferta_activa, false);
		const igual = productosDeLaSede(base, [{ producto_id: 'a', disponible: null }]);
		assert.equal(igual[0].oferta_activa, true);
	});
	test('un precio que no es número se ignora: se queda el base', () => {
		const r = productosDeLaSede(base, [{ producto_id: 'a', precio_numerico: 'abc' }]);
		assert.equal(r[0].precio_numerico, 26000);
	});
	test('no modifica la lista de entrada', () => {
		const copia = JSON.parse(JSON.stringify(base));
		productosDeLaSede(base, [{ producto_id: 'a', precio_numerico: 99 }, { producto_id: 'b', disponible: false }]);
		assert.deepEqual(base, copia);
	});
});

describe('reordenarSiEsPorPrecio', () => {
	const lista = [{ id: 1, precio_numerico: 30 }, { id: 2, precio_numerico: 10 }, { id: 3, precio_numerico: 20 }];
	test('por defecto y asc: de menor a mayor', () => {
		assert.deepEqual(reordenarSiEsPorPrecio(lista).map(p => p.id), [2, 3, 1]);
		assert.deepEqual(reordenarSiEsPorPrecio(lista, 'precio_asc').map(p => p.id), [2, 3, 1]);
	});
	test('desc: de mayor a menor', () => {
		assert.deepEqual(reordenarSiEsPorPrecio(lista, 'precio_desc').map(p => p.id), [1, 3, 2]);
	});
	test('alfabético y manual no dependen del precio: no se tocan', () => {
		assert.equal(reordenarSiEsPorPrecio(lista, 'nombre_az'), lista);
		assert.equal(reordenarSiEsPorPrecio(lista, 'personalizado'), lista);
	});
	test('los empates conservan el orden que traían', () => {
		const e = [{ id: 'x', precio_numerico: 5 }, { id: 'y', precio_numerico: 5 }];
		assert.deepEqual(reordenarSiEsPorPrecio(e).map(p => p.id), ['x', 'y']);
	});
});

describe('categoriasDeLaSede', () => {
	const cats = [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }];
	const base = [{ id: 'a', categoria_id: 'c1' }, { id: 'b', categoria_id: 'c2' }];
	test('se quita la categoría que la sede dejó sin platos', () => {
		const sede = [{ id: 'a', categoria_id: 'c1' }];
		assert.deepEqual(categoriasDeLaSede(cats, base, sede).map(c => c.id), ['c1', 'c3']);
	});
	test('una categoría que ya estaba vacía antes se queda como estaba', () => {
		assert.ok(categoriasDeLaSede(cats, base, base).some(c => c.id === 'c3'));
	});
});

describe('no repetir la bienvenida al elegir sede', () => {
	const almacenFalso = () => {
		const d = new Map();
		return { setItem: (k, v) => d.set(k, v), getItem: k => (d.has(k) ? d.get(k) : null), removeItem: k => d.delete(k) };
	};
	test('lo que se eligió se reconoce una sola vez', () => {
		const a = almacenFalso();
		recordarEleccionDeSede('enchulados', 'bucaramanga', a);
		assert.equal(vieneDelSelector('enchulados', 'bucaramanga', a), true);
		assert.equal(vieneDelSelector('enchulados', 'bucaramanga', a), false, 'recargar vuelve a enseñar la bienvenida');
	});
	test('otra sede u otro restaurante no se salta nada', () => {
		const a = almacenFalso();
		recordarEleccionDeSede('enchulados', 'bucaramanga', a);
		assert.equal(vieneDelSelector('enchulados', 'piedecuesta', a), false);
		recordarEleccionDeSede('enchulados', 'bucaramanga', a);
		assert.equal(vieneDelSelector('bonzas', 'bucaramanga', a), false);
	});
	test('sin nota previa, no viene del selector', () => {
		assert.equal(vieneDelSelector('enchulados', 'bucaramanga', almacenFalso()), false);
	});
	test('un almacenamiento bloqueado no rompe nada', () => {
		const roto = { setItem() { throw new Error('bloqueado'); }, getItem() { throw new Error('bloqueado'); }, removeItem() { throw new Error('bloqueado'); } };
		assert.doesNotThrow(() => recordarEleccionDeSede('a', 'b', roto));
		assert.equal(vieneDelSelector('a', 'b', roto), false);
	});
});

describe('el carrito y las sedes', () => {
	const src = readFileSync(new URL('../core/carrito.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

	test('el carrito guardado es por sede: un restaurante sin sede conserva su clave de siempre', () => {
		const m = src.match(/function storageKey\(\) \{\s*return (`[^`]*`);/);
		assert.ok(m, 'no se encontró storageKey()');
		const clave = (restaurante) => new Function('restaurante', 'return ' + m[1])(restaurante);
		assert.equal(clave({ slug: 'bonzas' }), 'bonzas_cart', 'sin sede, la clave no cambia: ningún carrito guardado se pierde');
		assert.equal(clave({ slug: 'enchulados', sede: { slug: 'bucaramanga' } }), 'enchulados_bucaramanga_cart');
		assert.equal(clave({ slug: 'enchulados', sede: { slug: 'piedecuesta' } }), 'enchulados_piedecuesta_cart');
		assert.notEqual(clave({ slug: 'enchulados', sede: { slug: 'bucaramanga' } }), clave({ slug: 'enchulados', sede: { slug: 'piedecuesta' } }));
		assert.equal(clave(undefined), 'vmenus_cart');
	});

	test('el pedido que se registra lleva la sede solo si la hay', () => {
		assert.match(src, /\.\.\.\(restaurante\.sede\?\.id \? \{ sede_id: restaurante\.sede\.id \} : \{\}\),\s*cliente_nombre: name/);
	});
});
