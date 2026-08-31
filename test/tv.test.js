// La cartelera del televisor tiene una regla que el resto del repositorio no
// tiene: corre en navegadores que nadie puede depurar. Un error de sintaxis
// aquí no degrada nada — deja la pantalla negra en la pared de un restaurante
// durante todo un servicio.
//
// Estas pruebas son sobre todo un guardián de esa regla.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = readFileSync(join(RAIZ, 'tv.html'), 'utf8');
const GUION = HTML.slice(HTML.indexOf('<script>') + 8, HTML.indexOf('</script>'));

// Se escanea EL TEXTO EN CRUDO, sin quitar comentarios ni cadenas.
//
// La primera versión sí los quitaba, para evitar falsos positivos. Fue peor:
// una expresión regular del propio guion contiene dos barras seguidas, eso
// disparaba el borrador de comentarios de línea, y al descuadrarse las comillas
// el borrador de cadenas se llevó por delante el 94 % del código — de 15.540
// caracteres a 988. La prueba pasaba porque no quedaba nada que mirar.
//
// Comprobado inyectando encadenamiento opcional en tv.html: con el despojado
// la prueba seguía en verde; en crudo se pone roja.
//
// El precio es que los comentarios de tv.html tampoco pueden citar la sintaxis
// prohibida. Es un precio barato por un guardián que no se puede engañar.
const CODIGO = GUION;

// Saca una función suelta del guion para poder probarla. Se evalúa el código
// que se despliega, no una copia — una copia se queda atrás sin avisar.
function extraer(nombres, contexto = {}) {
	const ctx = vm.createContext(contexto);
	for (const n of nombres) {
		const i = GUION.indexOf('function ' + n + '(');
		assert.notEqual(i, -1, `no se encontró ${n}() en tv.html — ¿se renombró?`);
		// Hasta la línea que cierra la función en la columna 0 del bloque.
		const fin = GUION.indexOf('\n}', i);
		vm.runInContext(GUION.slice(i, fin + 2), ctx);
	}
	return ctx;
}

describe('tv.html · nada de sintaxis que un televisor viejo no entienda', () => {
	// Cada entrada estuvo a punto de colarse o se coló en el resto del código.
	const PROHIBIDO = [
		[/\?\./g,            'encadenamiento opcional ?.', 'Chrome 80, 2020'],
		[/\?\?/g,            'coalescencia ??',            'Chrome 80, 2020'],
		[/=>/g,              'función flecha',             'Chrome 45, 2015'],
		[/`/g,               'plantilla de cadena',        'Chrome 41, 2015'],
		[/\bconst\b/g,       'const',                      'Chrome 49, 2016'],
		[/\blet\b/g,         'let',                        'Chrome 49, 2016'],
		[/\basync\b/g,       'async',                      'Chrome 55, 2016'],
		[/\bawait\b/g,       'await',                      'Chrome 55, 2016'],
		[/\bclass\s+\w/g,    'class',                      'Chrome 49, 2016'],
		[/\.\.\./g,          'propagación ...',            'Chrome 60, 2017'],
		[/Object\.entries/g, 'Object.entries',             'Chrome 54, 2016'],
		[/Object\.assign/g,  'Object.assign',              'Chrome 45, 2015'],
		[/Array\.from/g,     'Array.from',                 'Chrome 45, 2015'],
		[/\.includes\(/g,    'includes()',                 'Chrome 41/47'],
		[/\bfetch\(/g,       'fetch',                      'Chrome 42, 2015'],
		[/\bPromise\b/g,     'Promise',                    'Chrome 32, 2014'],
	];

	for (const [patron, nombre, desde] of PROHIBIDO) {
		test(`sin ${nombre} (${desde})`, () => {
			const n = (CODIGO.match(patron) || []).length;
			assert.equal(n, 0,
				`${n} uso(s) de ${nombre}. En un televisor anterior a ${desde} esto no ` +
				`degrada: da error de sintaxis y la pantalla se queda negra.`);
		});
	}

	test('no importa nada de core/ ni de temas/', () => {
		// Compartir código con el menú es justo lo que no se puede hacer aquí:
		// todo core/ usa módulos ES y '?.'.
		assert.equal(/\bimport\b|\brequire\(/.test(CODIGO), false);
		assert.equal(HTML.includes('type="module"'), false);
	});

	test('el HTML no construye marcado a partir de datos', () => {
		// Se usa createElement + textContent. Además de compatible, así no hay
		// nada que escapar: el problema de inyección no existe.
		assert.equal(/innerHTML/.test(CODIGO), false, 'usa textContent');
	});
});

describe('tv.html · la configuración no puede dejar la pantalla inservible', () => {
	const conTv = tv => extraer(['config'], {
		POR_DEFECTO: { activa: true, orientacion: 'horizontal', por_slide: 2,
		               segundos: 8, modo: 'todos', categoria_id: null,
		               productos: [], aleatorio: false },
		datos: { restaurante: { atributos: { tv } } },
		Math,
		parseInt,
	}).config();

	test('los segundos se acotan entre 4 y 60', () => {
		// Con 1 la pantalla parpadea y marea a quien come debajo; con una hora
		// parece congelada y el restaurante cree que se rompió.
		assert.equal(conTv({ segundos: 1 }).segundos, 4);
		assert.equal(conTv({ segundos: 3600 }).segundos, 60);
		assert.equal(conTv({ segundos: 12 }).segundos, 12);
	});

	test('los platos por slide se acotan entre 1 y 4', () => {
		assert.equal(conTv({ por_slide: 9 }).por_slide, 4, 'más no caben legibles');
		assert.equal(conTv({ por_slide: 0 }).por_slide, 1);
	});

	test('un valor sin sentido cae en el de por defecto, no en cero', () => {
		// Un 0 aquí significaría un carrusel sin platos o un intervalo nulo.
		assert.equal(conTv({ segundos: 'abc', por_slide: null }).segundos, 8);
		assert.equal(conTv({ por_slide: 'x' }).por_slide, 1);
	});

	test('una orientación desconocida cae en horizontal', () => {
		// Girar la pantalla por error deja la carta ilegible de lado.
		assert.equal(conTv({ orientacion: 'diagonal' }).orientacion, 'horizontal');
		assert.equal(conTv({ orientacion: 'vertical' }).orientacion, 'vertical');
	});

	test('sin configuración ninguna, valores usables', () => {
		const c = conTv({});
		assert.equal(c.segundos, 8);
		assert.equal(c.por_slide, 2);
		assert.equal(c.orientacion, 'horizontal');
	});
});

describe('tv.html · el color de la etiqueta de categoría', () => {
	// Reutiliza el color que el restaurante ya guardó para su carta. Lo que se
	// prueba aquí es sobre todo que nunca acabe ilegible: esto se cuelga en una
	// pared y nadie va a volver a mirarlo.
	const paleta = (color_categoria, color_primario) => extraer(
		['canalHex', 'paletaCategoria'],
		{ datos: { restaurante: { color_primario } } }
	).paletaCategoria({ color_categoria });

	const OSCURO = 'rgba(10, 10, 15, 0.62)';

	test('por defecto, el oscuro que se lee sobre cualquier foto', () => {
		assert.equal(paleta('oscuro', '#3dd68c').fondo, OSCURO);
		assert.equal(paleta(undefined, '#3dd68c').fondo, OSCURO);
	});

	test('el claro invierte también el texto, no solo el fondo', () => {
		// Un fondo claro con el texto claro de antes sería invisible.
		const p = paleta('claro', '#3dd68c');
		assert.match(p.fondo, /255, 255, 255/);
		assert.equal(p.texto, '#14131c');
	});

	test('con la marca, el fondo es el color guardado del restaurante', () => {
		assert.equal(paleta('marca', '#3dd68c').fondo, 'rgba(61, 214, 140, 0.9)');
	});

	test('el texto se elige por brillo percibido, no fijo', () => {
		// Sobre verde menta o amarillo hay que escribir en negro; sobre morado
		// o azul, en blanco. Fijar uno de los dos deja media plataforma sin leer.
		assert.equal(paleta('marca', '#3dd68c').texto, '#14131c', 'verde claro');
		assert.equal(paleta('marca', '#ffd521').texto, '#14131c', 'amarillo');
		assert.equal(paleta('marca', '#a374af').texto, '#ffffff', 'morado');
		assert.equal(paleta('marca', '#101020').texto, '#ffffff', 'casi negro');
	});

	test('sin color guardado no se inventa uno: vuelve al oscuro', () => {
		// Hay restaurantes con la columna vacía. Antes de esto, el fondo salía
		// como 'rgba(NaN, NaN, NaN)' y el navegador lo descartaba entero,
		// dejando la etiqueta transparente encima de la foto.
		assert.equal(paleta('marca', null).fondo, OSCURO);
		assert.equal(paleta('marca', '').fondo, OSCURO);
		assert.equal(paleta('marca', 'azul').fondo, OSCURO);
		assert.equal(paleta('marca', '#12345').fondo, OSCURO);
		assert.equal(paleta('marca', { r: 1 }).fondo, OSCURO);
	});

	test('acepta el hexadecimal corto', () => {
		// El selector del panel siempre escribe seis dígitos, pero el color se
		// puede haber puesto a mano en la base de datos.
		assert.equal(paleta('marca', '#3d8').fondo, 'rgba(51, 221, 136, 0.9)');
	});

	test('un valor desconocido no deja la etiqueta sin color', () => {
		const c = extraer(['config'], {
			POR_DEFECTO: { color_categoria: 'oscuro' },
			datos: { restaurante: { atributos: { tv: { color_categoria: 'fucsia' } } } },
			Math,
			parseInt,
		}).config();
		assert.equal(c.color_categoria, 'oscuro');
	});
});

describe('tv.html · la etiqueta no se pelea con el logo del negocio', () => {
	// El logo del negocio se dibuja ENCIMA de la primera foto, y la etiqueta de
	// categoría vivía siempre en el mismo rincón de esa misma foto. Con el logo
	// a la izquierda, uno tapaba al otro. Ahora la etiqueta se va a la esquina
	// contraria — y el logo cambia de lado en cada pantalla, así que esto no se
	// puede fijar: hay que recalcularlo en cada slide.

	// Un DOM de juguete. Solo lo que pintarSlide() toca de verdad.
	function domFalso() {
		return {
			createElement() {
				return {
					className: '', textContent: '', style: {}, hijos: [],
					appendChild(h) { this.hijos.push(h); return h; },
				};
			},
		};
	}

	function todos(nodo, salida = []) {
		salida.push(nodo);
		for (const h of nodo.hijos || []) todos(h, salida);
		return salida;
	}

	// Pinta una pantalla de dos platos y devuelve las etiquetas de categoría.
	function etiquetas(marcaDerecha, tv = {}) {
		const ctx = extraer(
			['nuevoNodo', 'canalHex', 'paletaCategoria', 'nombreCategoria',
			 'urlSegura', 'config', 'pintarSlide'],
			{
				document: domFalso(),
				marcaDerecha,
				POR_DEFECTO: { por_slide: 2, segundos: 8, mostrar_categoria: true,
				               color_categoria: 'oscuro' },
				datos: {
					restaurante: { color_primario: '#3dd68c', atributos: { tv } },
					categorias: [{ id: 'c1', nombre: 'Hamburguesas' }],
				},
				Math, parseInt, String,
			}
		);
		const platos = [
			{ nombre: 'La Descarada', precio: '$28.000', imagen_url: 'https://x/1.jpg', categoria_id: 'c1' },
			{ nombre: 'Pepito',       precio: '$24.000', imagen_url: 'https://x/2.jpg', categoria_id: 'c1' },
		];
		return todos(ctx.pintarSlide({ platos }))
			.filter(n => /\bcategoria\b/.test(n.className || ''));
	}

	test('con el logo a la izquierda, las etiquetas se van a la derecha', () => {
		const e = etiquetas(false, { mostrar_categoria: true });
		assert.equal(e.length, 2, 'una por plato');
		for (const n of e) {
			assert.match(n.className, /derecha/,
				'el logo ocupa la esquina izquierda de la primera foto');
		}
	});

	test('con el logo a la derecha, vuelven a la izquierda', () => {
		const e = etiquetas(true, { mostrar_categoria: true });
		assert.equal(e.length, 2);
		for (const n of e) assert.doesNotMatch(n.className, /derecha/);
	});

	test('todas las de una pantalla van del mismo lado', () => {
		// Mover solo la del plato que estorba deja una etiqueta descolocada y
		// se lee como un fallo. O todas, o ninguna.
		const e = etiquetas(false, { mostrar_categoria: true });
		assert.equal(new Set(e.map(n => n.className)).size, 1);
	});

	test('el lado se decide antes de pintar, no después', () => {
		// El orden importa: si el volteo de marcaDerecha vuelve al final de
		// avanzar(), las etiquetas se pintan con el lado de la pantalla ANTERIOR
		// y aterrizan justo encima del logo. Es el error que se corrigió.
		const cuerpo = GUION.slice(GUION.indexOf('function avanzar('));
		const volteo = cuerpo.indexOf('marcaDerecha = !marcaDerecha');
		const pintado = cuerpo.indexOf('pintarSlide(');
		assert.notEqual(volteo, -1);
		assert.notEqual(pintado, -1);
		assert.ok(volteo < pintado,
			'avanzar() debe voltear marcaDerecha antes de llamar a pintarSlide()');
	});

	test('el nombre de la categoría no se puede apagar por accidente', () => {
		assert.equal(etiquetas(false, { mostrar_categoria: false }).length, 0);
	});

	test('la etiqueta lleva el color elegido, no el del CSS', () => {
		const [e] = etiquetas(false, { mostrar_categoria: true, color_categoria: 'marca' });
		assert.equal(e.style.background, 'rgba(61, 214, 140, 0.9)');
		assert.equal(e.style.color, '#14131c');
	});

	test('nunca baja del suelo de legibilidad', () => {
		// Con cuatro platos el nombre baja a 2,4vmin y la etiqueta, proporcional,
		// caía por debajo de lo que se lee desde la mesa del fondo.
		const [e] = etiquetas(false, { mostrar_categoria: true });
		assert.ok(parseFloat(e.style.fontSize) >= 1.9, e.style.fontSize);
	});
});

describe('tv.html · qué URL se acepta como imagen', () => {
	const { urlSegura } = extraer(['urlSegura'], { String });

	test('solo http y https', () => {
		assert.equal(urlSegura('https://x.co/a.jpg'), 'https://x.co/a.jpg');
		assert.equal(urlSegura('http://x.co/a.jpg'), 'http://x.co/a.jpg');
		assert.equal(urlSegura('javascript:alert(1)'), '');
		assert.equal(urlSegura('data:image/svg+xml,<svg onload=x>'), '');
		assert.equal(urlSegura(''), '');
		assert.equal(urlSegura(null), '');
		assert.equal(urlSegura(undefined), '');
	});
});

describe('tv.html · el orden aleatorio no puede repetir al cerrar el ciclo', () => {
	const { barajar } = extraer(['barajar'], { Math });

	test('no repite el último del ciclo anterior', () => {
		// El punto de vuelta es justo donde se nota la repetición: si el ciclo
		// nuevo empieza por el plato que acaba de salir, parece que se colgó.
		const lista = [1,2,3,4,5,6].map(n => ({ id: 'p' + n }));
		for (let i = 0; i < 200; i++) {
			const previo = lista[Math.floor(Math.random() * lista.length)];
			assert.notEqual(barajar(lista, previo)[0].id, previo.id);
		}
	});

	test('no pierde ni inventa platos', () => {
		const lista = [1,2,3,4,5].map(n => ({ id: 'p' + n }));
		const r = barajar(lista, null);
		assert.equal(r.length, 5);
		assert.deepEqual(r.map(x => x.id).sort(), ['p1','p2','p3','p4','p5']);
	});

	test('no toca la lista original', () => {
		const lista = [1,2,3].map(n => ({ id: 'p' + n }));
		barajar(lista, null);
		assert.deepEqual(lista.map(x => x.id), ['p1','p2','p3']);
	});

	test('con un solo plato no se cuelga buscando otro', () => {
		// Un restaurante con una sola foto: el bucle de intercambio no tiene a
		// quién elegir y no debe entrar en bucle infinito.
		const uno = [{ id: 'p1' }];
		assert.equal(barajar(uno, { id: 'p1' })[0].id, 'p1');
	});
});

describe('tv.html · horarios de categoría', () => {
	const { aMinutos } = extraer(['aMinutos'], { RegExp, String, parseInt });

	test('lee las horas bien escritas', () => {
		assert.equal(aMinutos('11:00'), 660);
		assert.equal(aMinutos('9:30'), 570);
		assert.equal(aMinutos('00:00'), 0);
	});

	test('lo inválido devuelve null, y eso significa "mostrar"', () => {
		// Ante una configuración rota se enseña de más, nunca menos: una
		// pantalla vacía por una hora mal escrita es el peor resultado.
		for (const malo of ['25:00', '10:70', 'once', '', null, undefined, '11:0'])
			assert.equal(aMinutos(malo), null, `con ${JSON.stringify(malo)}`);
	});
});
