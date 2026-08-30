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
