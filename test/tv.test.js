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

// La paleta neutra se saca del propio archivo y no se copia aquí: copiarla
// dejaría las pruebas pasando con unos colores mientras la pantalla enseña
// otros.
const NEUTRO = (() => {
	const i = GUION.indexOf('var NEUTRO = ');
	assert.notEqual(i, -1, 'no se encontró NEUTRO en tv.html');
	const ctx = vm.createContext({});
	vm.runInContext(GUION.slice(i, GUION.indexOf('\n};', i) + 3), ctx);
	return ctx.NEUTRO;
})();

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

// Las funciones que hacen falta para pintar una pantalla entera.
const PARA_PINTAR = ['nuevoNodo', 'canalHex', 'paletaCategoria', 'nombreCategoria',
	'urlSegura', 'config', 'aHex', 'rgba', 'aclarar', 'luminancia', 'contraste',
	'textoSobre', 'legibleSobre', 'fondoPagina', 'acento', 'paletaPagina', 'pintarSlide'];

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
		['config', 'canalHex', 'rgba', 'aclarar', 'luminancia', 'contraste',
		 'legibleSobre', 'fondoPagina', 'acento', 'paletaCategoria'],
		{
			NEUTRO,
			POR_DEFECTO: { tema: 'oscuro' },
			datos: { restaurante: { color_primario, atributos: {} } },
			Math, parseInt,
		}
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
		// Un color que ya se lee sobre el fondo llega intacto.
		assert.equal(paleta('marca', '#3dd68c').fondo, 'rgba(61, 214, 140, 0.9)');
	});

	test('es EL MISMO color que el precio, no el original', () => {
		// Con el azul marino de juanmar, la etiqueta salía en su azul y el
		// precio en otro más claro: dos azules en la misma pantalla se leen
		// como un fallo. Los dos salen ahora del acento ya aclarado.
		const etiqueta = paleta('marca', '#0a4380').fondo;
		const precio = extraer(
			['config', 'canalHex', 'aHex', 'rgba', 'aclarar', 'luminancia', 'contraste',
			 'textoSobre', 'legibleSobre', 'fondoPagina', 'acento', 'paletaPagina'],
			{
				NEUTRO,
				POR_DEFECTO: { tema: 'oscuro' },
				datos: { restaurante: { color_primario: '#0a4380',
				                        atributos: { tv: { tema: 'carta' } } } },
				Math, parseInt,
			}
		).paletaPagina().acento;
		const canales = precio.slice(1).match(/../g).map(h => parseInt(h, 16));
		assert.equal(etiqueta, `rgba(${canales[0]}, ${canales[1]}, ${canales[2]}, 0.9)`);
		assert.equal(/10, 67, 128/.test(etiqueta), false, 'y no es el original');
	});

	test('el texto se elige por brillo percibido, no fijo', () => {
		// Sobre verde menta o amarillo hay que escribir en negro; sobre morado
		// o azul, en blanco. Fijar uno de los dos deja media plataforma sin leer.
		assert.equal(paleta('marca', '#3dd68c').texto, '#14131c', 'verde claro');
		assert.equal(paleta('marca', '#ffd521').texto, '#14131c', 'amarillo');
		assert.equal(paleta('marca', '#a374af').texto, '#ffffff', 'morado');
		// Un color casi negro se aclara primero para que se lea sobre el fondo.
		// Acaba en un gris medio —rgb(122,122,131), brillo 123— así que encima
		// sigue yendo blanco. Medido, no supuesto: la primera versión de esta
		// prueba daba por hecho que acabaría claro y estaba equivocada.
		assert.equal(paleta('marca', '#101020').texto, '#ffffff', 'casi negro, ya aclarado');
		assert.equal(paleta('marca', '#101020').fondo, 'rgba(122, 122, 131, 0.9)');
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

	// Pinta una pantalla de dos platos y devuelve las etiquetas de categoría.
	function etiquetas(marcaDerecha, tv = {}) {
		const ctx = extraer(PARA_PINTAR, {
				document: domFalso(),
				marcaDerecha,
				NEUTRO,
				POR_DEFECTO: { por_slide: 2, segundos: 8, mostrar_categoria: true,
				               color_categoria: 'oscuro', tema: 'oscuro' },
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

describe('tv.html · la página con los colores del restaurante', () => {
	// El tema 'carta' toma los colores que el restaurante ya guardó para su
	// menú. Lo que se prueba es que nunca acabe ilegible: esto se cuelga en una
	// pared y nadie va a volver a mirarlo.
	const paleta = (tema, restaurante = {}) => extraer(
		['config', 'canalHex', 'aHex', 'rgba', 'aclarar', 'luminancia', 'contraste',
		 'textoSobre', 'legibleSobre', 'fondoPagina', 'acento', 'paletaPagina'],
		{
			NEUTRO,
			POR_DEFECTO: { tema: 'oscuro' },
			datos: { restaurante: Object.assign({ atributos: { tv: { tema } } }, restaurante) },
			Math, parseInt,
		}
	).paletaPagina();

	// Razón de contraste de la WCAG, calculada aquí a mano para no comprobar
	// el código con el propio código.
	const ratio = (a, b) => {
		const lum = hex => {
			const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
				.map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
			return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
		};
		const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
		return (x + 0.05) / (y + 0.05);
	};

	test('sin tema, la página es exactamente la de antes', () => {
		// Nadie que no lo pida debe ver su cartelera cambiar de aspecto.
		const p = paleta(undefined, { color_primario: '#0a4380' });
		assert.equal(p.fondo, NEUTRO.fondo);
		assert.equal(p.acento, NEUTRO.acento);
		assert.equal(p.degradado, '', 'sin lavado de color');
		assert.equal(p.borde, '', 'sin borde en las fotos');
	});

	test('con tema carta, el fondo sale de los atributos', () => {
		// Solo malparados los tiene puestos hoy; son estos.
		const p = paleta('carta', {
			color_primario: '#ffd521',
			atributos: { tv: { tema: 'carta' }, color_dark: '#0a0a0a', color_card: '#252525',
			             color_border: '#333333' },
		});
		assert.equal(p.fondo, '#0a0a0a');
		assert.equal(p.caja, '#252525');
		assert.match(p.borde, /51, 51, 51/);
	});

	test('sin atributos de superficie caen los mismos valores que en la carta', () => {
		// Ocho de los nueve restaurantes los tienen vacíos. Los valores por
		// defecto son los de applyStyles() en core/loader.js; si allí cambian y
		// aquí no, la cartelera y el menú dejan de parecerse.
		const p = paleta('carta', { color_primario: '#ffd521' });
		assert.equal(p.fondo, '#0a0a0f');
		assert.equal(p.caja, '#1a1825');
	});

	test('la cadena vacía cuenta como sin configurar, igual que el nulo', () => {
		// En la base hay cadenas vacías, no solo nulos: es lo que guarda el
		// panel cuando se borra el campo.
		const p = paleta('carta', {
			color_primario: '', color_secundario: '',
			atributos: { tv: { tema: 'carta' }, color_dark: '', color_card: '' },
		});
		assert.equal(p.fondo, '#0a0a0f');
		assert.equal(p.caja, '#1a1825');
	});

	test('un color oscuro se aclara hasta que se lee', () => {
		// juanmar tiene #0a4380 y sanjavier #3d568c. Puestos tal cual encima de
		// un fondo casi negro, el precio no se ve desde ninguna mesa.
		for (const crudo of ['#0a4380', '#3d568c']) {
			const p = paleta('carta', { color_primario: crudo });
			assert.ok(ratio(p.acento, p.fondo) >= 4.5,
				`${crudo} salió como ${p.acento}, contraste ${ratio(p.acento, p.fondo).toFixed(2)}`);
			assert.notEqual(p.acento, crudo, 'tuvo que aclararse');
		}
	});

	test('un color que ya se lee no se toca', () => {
		// Aclarar de más apaga el color: el amarillo de malparados tiene que
		// seguir siendo su amarillo.
		assert.equal(paleta('carta', { color_primario: '#ffd521' }).acento, '#ffd521');
		assert.equal(paleta('carta', { color_primario: '#cdfefe' }).acento, '#cdfefe');
	});

	test('los nueve colores reales acaban legibles', () => {
		const reales = ['#ffd521', '#cdfefe', '#b3a7ff', '#0a4380', '#ffd521',
		                '#ffd521', '#df2086', '#3d568c', '#e5b769'];
		for (const c of reales) {
			const p = paleta('carta', { color_primario: c });
			assert.ok(ratio(p.acento, p.fondo) >= 4.5, c + ' → ' + p.acento);
		}
	});

	test('sobre un fondo claro el texto se pone oscuro', () => {
		// Hoy los nueve fondos son oscuros, pero el panel deja cambiarlos, y
		// blanco sobre blanco no lo salva nada.
		const p = paleta('carta', {
			color_primario: '#0a4380',
			atributos: { tv: { tema: 'carta' }, color_dark: '#f5f2ea' },
		});
		assert.equal(p.texto, '#14131c');
		assert.ok(ratio(p.acento, p.fondo) >= 4.5, 'y el acento también se lee');
	});

	test('el aclarado termina aunque el objetivo sea imposible', () => {
		// Sobre blanco puro no hay forma de llegar a 4,5 aclarando. Sin tope,
		// el bucle deja el televisor colgado en una pantalla en blanco.
		const p = paleta('carta', {
			color_primario: '#eeeeee',
			atributos: { tv: { tema: 'carta' }, color_dark: '#ffffff' },
		});
		assert.match(p.acento, /^#[0-9a-f]{6}$/, 'devolvió un color, no se colgó');
	});

	test('el color de fondo va aparte del degradado', () => {
		// Si el televisor no entendiera el degradado, tiene que quedarse el
		// color liso y no una pantalla en blanco.
		const p = paleta('carta', { color_primario: '#ffd521', color_secundario: '#f5a623' });
		assert.match(p.fondo, /^#[0-9a-f]{6}$/);
		assert.match(p.degradado, /linear-gradient/);
		assert.match(p.degradado, /255, 213, 33/, 'lleva el color primario');
		assert.match(p.degradado, /245, 166, 35/, 'y el secundario');
	});

	test('un color inservible no rompe la página', () => {
		const p = paleta('carta', { color_primario: 'azul marino', color_secundario: null });
		assert.equal(p.acento, '#cdfefe', 'cae en el mismo defecto que la carta');
	});
});

describe('tv.html · la promoción a pantalla completa', () => {
	// Fase 3. La promoción se intercala cada N pantallas y ocupa el slide
	// entero: esas piezas se diseñan para verse solas.

	const restaurante = (extra = {}) => Object.assign({
		id: 'r1',
		promo_activa: true,
		promo_imagen_url: 'https://x/promo.jpg',
		promo_en_tv: true,
		promo_cada: 2,
		atributos: { tv: { activa: true, por_slide: 1 } },
	}, extra);

	const productos = n => Array.apply(null, { length: n }).map((_, i) => ({
		id: 'p' + i, nombre: 'Plato ' + i, precio: '$1', categoria_id: 'c1',
		imagen_url: 'https://x/' + i + '.jpg', disponible: true,
	}));

	function ciclo(r, cuantos = 4) {
		const ctx = extraer(
			['config', 'tvActiva', 'urlSegura', 'categoriaVisible', 'platosElegidos',
			 'barajar', 'construirSlides'],
			{
				POR_DEFECTO: { activa: true, por_slide: 1, segundos: 8, modo: 'todos',
				               categoria_id: null, productos: [], aleatorio: false },
				datos: { restaurante: r, categorias: [{ id: 'c1', nombre: 'Cat' }],
				         productos: productos(cuantos) },
				slides: [], Math, parseInt, String,
			}
		);
		ctx.construirSlides();
		return ctx.slides;
	}

	test('se intercala cada N pantallas', () => {
		const s = ciclo(restaurante({ promo_cada: 2 }), 4);
		// 4 platos de uno en uno = 4 pantallas, más una promo tras la 2.ª y la 4.ª
		assert.equal(s.length, 6);
		assert.ok(!s[0].promo && !s[1].promo);
		assert.ok(s[2].promo, 'la promo entra tras la segunda');
		assert.ok(s[5].promo, 'y tras la cuarta');
	});

	test('la promo lleva imagen, nombre y precio, no solo la imagen', () => {
		// Cambió de ser una cadena a ser un objeto al llegar la fase 3. Si
		// construirSlides se quedara atrás, pintarSlide reventaría al leer
		// .imagen de una cadena.
		const s = ciclo(restaurante({ promo_nombre: '2x1 en hamburguesas',
		                             promo_precio: '$ 30.000' }), 2);
		const promo = s.filter(x => x.promo)[0].promo;
		assert.equal(promo.imagen, 'https://x/promo.jpg');
		assert.equal(promo.nombre, '2x1 en hamburguesas');
		assert.equal(promo.precio, '$ 30.000');
	});

	test('sin promo_en_tv no se intercala nada', () => {
		// Es lo que separa "tengo una promo en la carta" de "quiero que salga
		// en el televisor". Son dos decisiones distintas.
		assert.equal(ciclo(restaurante({ promo_en_tv: false }), 4).length, 4);
		assert.equal(ciclo(restaurante({ promo_activa: false }), 4).length, 4);
	});

	test('sin imagen no hay promo, aunque esté encendida', () => {
		// El slide es la imagen. Un nombre y un precio sueltos a pantalla
		// completa sobre negro no es una promoción, es un error.
		assert.equal(ciclo(restaurante({ promo_imagen_url: null,
		                                promo_nombre: 'Algo' }), 4).length, 4);
		assert.equal(ciclo(restaurante({ promo_imagen_url: 'javascript:alert(1)' }), 4).length, 4);
	});

	test('un promo_cada sin sentido no rompe el ciclo', () => {
		// Un 0 haría que la promo entrara entre todas las pantallas.
		for (const cada of [0, -3, null, 'a']) {
			const s = ciclo(restaurante({ promo_cada: cada }), 8);
			assert.equal(s.length, 10, 'cae en cada 4: ' + cada);
		}
	});

	// Pintar la pantalla de promoción, ya construida.
	function pintarPromo(promo, tv = {}) {
		const ctx = extraer(PARA_PINTAR, {
			document: domFalso(),
			marcaDerecha: false,
			NEUTRO,
			POR_DEFECTO: { por_slide: 1, segundos: 8, tema: 'oscuro', color_categoria: 'oscuro' },
			datos: { restaurante: { color_primario: '#ffd521', atributos: { tv } },
			         categorias: [] },
			Math, parseInt, String,
		});
		return todos(ctx.pintarSlide({ promo }));
	}

	test('la pantalla de promoción lleva la imagen', () => {
		const foto = pintarPromo({ imagen: 'https://x/p.jpg', nombre: '', precio: '' })
			.filter(n => n.className === 'promo-foto')[0];
		assert.ok(foto, 'hay un nodo para la foto');
		assert.match(foto.style.backgroundImage, /https:\/\/x\/p\.jpg/);
	});

	test('sin nombre ni precio no se pinta la franja de texto', () => {
		// Casi todas las piezas ya llevan el texto dibujado dentro. Repetirlo
		// debajo, o peor, dejar una franja vacía, se ve como un fallo.
		const n = pintarPromo({ imagen: 'https://x/p.jpg', nombre: '', precio: '' });
		assert.equal(n.filter(x => x.className === 'promo-texto').length, 0);
	});

	test('con nombre y precio sí, y el precio lleva el acento', () => {
		const n = pintarPromo({ imagen: 'https://x/p.jpg', nombre: '2x1', precio: '$ 30.000' },
		                      { tema: 'carta' });
		assert.equal(n.filter(x => x.className === 'promo-nombre')[0].textContent, '2x1');
		const precio = n.filter(x => x.className === 'promo-precio')[0];
		assert.equal(precio.textContent, '$ 30.000');
		assert.equal(precio.style.color, '#ffd521', 'el color de la carta');
	});

	test('solo el precio, sin nombre, también vale', () => {
		const n = pintarPromo({ imagen: 'https://x/p.jpg', nombre: '', precio: '$ 30.000' });
		assert.equal(n.filter(x => x.className === 'promo-texto').length, 1);
		assert.equal(n.filter(x => x.className === 'promo-nombre').length, 0);
	});

	test('sin platos que enseñar tampoco sale la promo sola', () => {
		// Una pantalla que solo enseña la promoción una y otra vez es el caso
		// de "puse la tele y no salen mis platos".
		assert.equal(ciclo(restaurante(), 0).length, 0);
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

describe('tv.html · la tipografía que eligió el restaurante', () => {
	// La cartelera llevaba Helvetica fija: el restaurante elegía su letra, la
	// veía en la carta del QR y en el televisor salía otra. La misma marca
	// contándose de dos formas dentro del mismo local.

	const montar = (atributos) => {
		const puestos = [];
		const reglas = { textContent: '' };
		const cuerpo = { style: {}, className: '' };
		const ctx = extraer(['nombreDeFuenteSeguro', 'aplicarFuentes'], {
			String, RegExp,
			datos: { restaurante: { atributos } },
			document: {
				createElement: () => ({ rel: '', href: '' }),
				getElementById: () => reglas,
				head: { appendChild(e) { puestos.push(e); } },
				body: cuerpo,
			},
		});
		ctx.fuentesPuestas = '';
		ctx.aplicarFuentes();
		return { puestos, reglas, cuerpo, ctx };
	};

	test('pide a Google las dos familias elegidas', () => {
		const { puestos } = montar({ fuente_titulo: 'Bebas Neue', fuente_cuerpo: 'Poppins' });
		assert.equal(puestos.length, 1);
		assert.match(puestos[0].href, /family=Bebas\+Neue/);
		assert.match(puestos[0].href, /family=Poppins/);
	});

	test('con la letra de reserva activada', () => {
		// Es lo que hace viable esto en un televisor: el texto se ve desde el
		// primer momento con Helvetica y cambia cuando llega la buena. El peor
		// caso —sin internet— es exactamente lo que se veía antes.
		const { puestos } = montar({ fuente_titulo: 'Anton' });
		assert.match(puestos[0].href, /display=swap/);
	});

	test('los títulos van a su regla y el cuerpo al body', () => {
		const { reglas, cuerpo } = montar({ fuente_titulo: 'Anton', fuente_cuerpo: 'Inter' });
		assert.match(reglas.textContent, /\.nombre[^{]*\{[^}]*Anton/);
		assert.match(cuerpo.style.fontFamily, /Inter/);
	});

	test('y siempre con Helvetica detrás', () => {
		// Si Google no contesta, el televisor no puede quedarse sin letra.
		const { reglas, cuerpo } = montar({ fuente_titulo: 'Anton', fuente_cuerpo: 'Inter' });
		assert.match(reglas.textContent, /Helvetica/);
		assert.match(cuerpo.style.fontFamily, /Helvetica/);
	});

	test('sin fuentes elegidas no se pide nada', () => {
		// Es el caso de siete de los nueve restaurantes: se quedan como estaban.
		const { puestos, reglas } = montar({});
		assert.equal(puestos.length, 0);
		assert.equal(reglas.textContent, '');
	});

	test('no se piden dos veces si no cambió nada', () => {
		// aplicar() corre en cada cambio de configuración y el sondeo lo llama
		// cada cinco minutos: sin el freno, un enlace por hora.
		const { ctx, puestos } = montar({ fuente_titulo: 'Anton' });
		ctx.aplicarFuentes();
		ctx.aplicarFuentes();
		assert.equal(puestos.length, 1);
	});

	// ── UN NOMBRE DE FUENTE ACABA DENTRO DE UNA REGLA CSS ─────
	// Y ahí un texto cualquiera se sale de su sitio y escribe reglas nuevas.
	// Hoy solo lo pone el superadmin desde una lista cerrada, pero eso es una
	// costumbre del panel, no una garantía del dato.

	test('un nombre con sintaxis de CSS no se usa', () => {
		const { ctx } = montar({});
		assert.equal(ctx.nombreDeFuenteSeguro("x'; } body { background: url(malo) } .z {"), '');
		assert.equal(ctx.nombreDeFuenteSeguro('Anton; }'), '');
		assert.equal(ctx.nombreDeFuenteSeguro('<script>'), '');
	});

	test('y entonces la cartelera se queda con la suya', () => {
		const { puestos, reglas } = montar({ fuente_titulo: 'malo; } body {' });
		assert.equal(puestos.length, 0, 'ni se le pide a Google');
		assert.equal(reglas.textContent, '');
	});

	test('los nombres de verdad sí pasan', () => {
		const { ctx } = montar({});
		assert.equal(ctx.nombreDeFuenteSeguro('Playfair Display'), 'Playfair Display');
		assert.equal(ctx.nombreDeFuenteSeguro('Roboto'), 'Roboto');
		assert.equal(ctx.nombreDeFuenteSeguro(''), '');
		assert.equal(ctx.nombreDeFuenteSeguro(null), '');
	});
});

describe('tv.html · las fotos de la pantalla siguiente se piden antes', () => {
	// Se pedían al enseñarlas: se creaba el nodo con su background-image y el
	// navegador empezaba a descargar justo cuando ya tenía que verse. Con la
	// transición de entrada, la pantalla enseñaba el marco vacío con el nombre
	// y el precio flotando encima.
	//
	// Dura poco —las fotos llevan caché de un año, así que tras una vuelta
	// entera ya están todas— pero esa primera vuelta es al encender el
	// televisor por la mañana, delante de los primeros clientes del día.

	const montar = () => {
		const pedidas = [];
		const ctx = extraer(['urlSegura', 'urlsDelSlide', 'precargar'], {
			String,
			Image: class { set src(u) { pedidas.push(u); } },
		});
		// 'yaPedidas' vive fuera de las funciones, así que no viaja con ellas.
		ctx.yaPedidas = {};
		return { ctx, pedidas };
	};

	const plato = n => ({ imagen_url: 'https://x.co/' + n + '.jpg' });

	test('saca las fotos de los platos de un slide', () => {
		const { ctx } = montar();
		// join() y no deepEqual: los arrays nacen dentro del contexto de la VM,
		// así que son de otro realm y deepEqual los ve distintos aunque digan
		// lo mismo.
		assert.equal(ctx.urlsDelSlide({ platos: [plato('a'), plato('b')] }).join('|'),
			'https://x.co/a.jpg|https://x.co/b.jpg');
	});

	test('y la de una promoción, que va sola', () => {
		const { ctx } = montar();
		assert.equal(ctx.urlsDelSlide({ promo: { imagen: 'https://x.co/p.jpg' } }).join('|'),
			'https://x.co/p.jpg');
	});

	test('una URL que no vale no se pide', () => {
		// Misma puerta que al pintar: pedirla no rompería nada, pero deja el
		// filtro en un solo sitio.
		const { ctx } = montar();
		assert.equal(ctx.urlsDelSlide({ platos: [{ imagen_url: 'javascript:x' }] }).length, 0);
	});

	test('un slide vacío o inexistente no revienta', () => {
		// Pasa al final del ciclo si la lista quedó vacía entre dos sondeos.
		const { ctx } = montar();
		assert.equal(ctx.urlsDelSlide(null).length, 0);
		assert.equal(ctx.urlsDelSlide({ platos: [] }).length, 0);
	});

	test('precargar las pide de verdad', () => {
		const { ctx, pedidas } = montar();
		ctx.precargar({ platos: [plato('a'), plato('b')] });
		// 'pedidas' se llena desde el Image de mentira, que es de este lado, así
		// que aquí sí vale deepEqual.
		assert.deepEqual(pedidas, ['https://x.co/a.jpg', 'https://x.co/b.jpg']);
	});

	test('no pide dos veces la misma foto', () => {
		// La última pantalla se corre hacia atrás para no quedar coja, así que
		// repite platos de la anterior. Y con la promoción intercalada pasa
		// otro tanto. Volver a pedirlas sería trabajo tirado en una pantalla
		// que va a estar encendida todo el día.
		const { ctx, pedidas } = montar();
		ctx.precargar({ platos: [plato('a'), plato('b')] });
		ctx.precargar({ platos: [plato('b'), plato('c')] });
		assert.deepEqual(pedidas, ['https://x.co/a.jpg', 'https://x.co/b.jpg', 'https://x.co/c.jpg']);
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
