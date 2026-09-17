// El buscador de platos. Vivía dentro de temas/explorar.js —era el único
// modelo que podía buscar— y el 17/09/2026 pasó a core/, como los filtros.
// Aquí se prueba lo que decide qué coincide y cuándo se ofrece; la caja de
// texto y dónde va la pone cada tema.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const { setRestaurante, setProductos } = await import('../core/menu.js');
const {
	coincideBusqueda, normalizar, buscadorEncendido, hayQueOfrecerBuscador,
	fijarTermino, terminoBusqueda, textoSinResultados, MINIMO_PLATOS_BUSCADOR,
} = await import('../core/buscador.js');

const P = (nombre, extra = {}) => ({ id: nombre, nombre, ...extra });
const platos = n => Array.from({ length: n }, (_, i) => P('plato' + i));

beforeEach(() => {
	setRestaurante({ id: 'r1', slug: 'pruebas', atributos: {} });
	setProductos([]);
	fijarTermino('');
});

describe('coincideBusqueda · encontrar el plato como se escribe de verdad', () => {
	test('sin nada escrito pasa todo', () => {
		assert.equal(coincideBusqueda(P('Arepa'), ''), true);
		assert.equal(coincideBusqueda(P('Arepa'), '   '), true, 'y unos espacios no son una búsqueda');
	});

	test('no distingue mayúsculas', () => {
		assert.equal(coincideBusqueda(P('Arepa de queso'), 'AREPA'), true);
	});

	test('encuentra sin acentos, que es como se teclea en un móvil', () => {
		// No encontrar el jalapeño al escribir «jalapeno» se lee como que la
		// carta no lo tiene.
		assert.equal(coincideBusqueda(P('Jalapeño relleno'), 'jalapeno'), true);
		assert.equal(coincideBusqueda(P('Piña colada'), 'pina'), true);
		assert.equal(coincideBusqueda(P('Jalapeno relleno'), 'jalapeño'), true, 'y al revés');
	});

	test('busca también en las descripciones', () => {
		// «picante» puede estar solo en la descripción, y quien lo busca lo
		// busca igual.
		assert.equal(coincideBusqueda(P('Alitas', { descripcion: 'Bien picantes' }), 'picante'), true);
		assert.equal(coincideBusqueda(P('Alitas', { descripcion_avanzada: 'Con salsa BBQ' }), 'bbq'), true);
	});

	test('con dos palabras se exigen las dos, en cualquier orden', () => {
		// «pollo arroz» tiene que encontrar «Arroz con pollo»: exigir el orden
		// haría fallar la mitad de las búsquedas de dos palabras.
		assert.equal(coincideBusqueda(P('Arroz con pollo'), 'pollo arroz'), true);
		assert.equal(coincideBusqueda(P('Arroz con pollo'), 'arroz camarones'), false);
	});

	test('un plato sin descripciones no revienta', () => {
		assert.equal(coincideBusqueda({ nombre: 'Arepa' }, 'arepa'), true);
		assert.equal(coincideBusqueda({}, 'arepa'), false);
	});

	test('sin segundo argumento usa lo que se escribió', () => {
		fijarTermino('arepa');
		assert.equal(terminoBusqueda(), 'arepa');
		assert.equal(coincideBusqueda(P('Arepa de queso')), true);
		assert.equal(coincideBusqueda(P('Empanada')), false);
	});

	test('normalizar deja el texto comparable', () => {
		assert.equal(normalizar('Ñoquis Gratén'), 'noquis graten');
		assert.equal(normalizar(null), '');
	});
});

describe('cuándo se ofrece el buscador', () => {
	test('una carta corta no lo necesita', () => {
		// Seis platos se leen de un vistazo; la caja ocuparía el sitio de uno.
		setProductos(platos(MINIMO_PLATOS_BUSCADOR - 1));
		assert.equal(hayQueOfrecerBuscador(), false);
		setProductos(platos(MINIMO_PLATOS_BUSCADOR));
		assert.equal(hayQueOfrecerBuscador(), true);
	});

	test('el restaurante puede apagarlo, y ausente es encendido', () => {
		// Igual que los filtros: nadie tiene que ir a encenderlo para tenerlo.
		assert.equal(buscadorEncendido(), true);
		setRestaurante({ id: 'r1', slug: 'pruebas', atributos: { buscador: false } });
		setProductos(platos(20));
		assert.equal(buscadorEncendido(), false);
		assert.equal(hayQueOfrecerBuscador(), false);
	});
});

describe('lo que se dice cuando no queda nada', () => {
	test('con una palabra escrita se repite la palabra', () => {
		fijarTermino('sushi');
		assert.match(textoSinResultados(false), /«sushi»/);
	});

	test('con palabra y filtros se nombran las dos cosas', () => {
		// «Sin resultados» a secas no dice cuál de las dos hay que quitar.
		fijarTermino('sushi');
		assert.match(textoSinResultados(true), /«sushi»/);
		assert.match(textoSinResultados(true), /filtros/);
	});

	test('solo con filtros no se inventa una búsqueda', () => {
		assert.equal(textoSinResultados(true), 'Ningún plato cumple los filtros que marcaste.');
	});
});
