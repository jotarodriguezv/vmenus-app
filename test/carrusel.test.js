// Carrusel de fotos de producto. Lo comparten el modal de topnav/sidebar y
// el de explorar, así que un fallo aquí sale en tres modelos a la vez.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// El módulo crea elementos con document.createElement. Se monta un DOM mínimo
// antes de importarlo: solo lo que el carrusel usa de verdad.
function nodoFalso(etiqueta) {
	const hijos = [];
	return {
		etiqueta, hijos, className: '', src: '', alt: '', style: {}, onclick: null,
		oyentes: {},
		appendChild(h) { hijos.push(h); return h; },
		addEventListener(ev, fn) { (this.oyentes[ev] ||= []).push(fn); },
		classList: {
			_c: new Set(),
			toggle(c, on) { on ? this._c.add(c) : this._c.delete(c); },
			contains(c) { return this._c.has(c); },
		},
	};
}
globalThis.document = { createElement: nodoFalso };

const { fotosDe, construirCarrusel } = await import('../core/carrusel.js');

const conFotos = (principal, extras) => ({
	nombre: 'HAMBURGUESA',
	imagen_url: principal,
	atributos: extras ? { imagenes: extras } : {},
});

describe('fotosDe', () => {
	test('la principal va primero y luego las adicionales', () => {
		assert.deepEqual(fotosDe(conFotos('/a.jpg', ['/b.jpg', '/c.jpg'])),
			['/a.jpg', '/b.jpg', '/c.jpg']);
	});

	test('no repite una foto que esté en los dos sitios', () => {
		// Es fácil que el panel deje la principal también entre las
		// adicionales; se vería la misma imagen dos veces al deslizar.
		assert.deepEqual(fotosDe(conFotos('/a.jpg', ['/a.jpg', '/b.jpg'])), ['/a.jpg', '/b.jpg']);
	});

	test('descarta las entradas vacías', () => {
		assert.deepEqual(fotosDe(conFotos('/a.jpg', ['', null, '/b.jpg'])), ['/a.jpg', '/b.jpg']);
	});

	test('un producto sin fotos da una lista vacía', () => {
		assert.deepEqual(fotosDe({ nombre: 'X', atributos: {} }), []);
		assert.deepEqual(fotosDe(null), []);
	});

	test('sin principal pero con adicionales, esas valen', () => {
		assert.deepEqual(fotosDe({ imagen_url: null, atributos: { imagenes: ['/b.jpg'] } }), ['/b.jpg']);
	});
});

describe('construirCarrusel', () => {
	test('con menos de dos fotos no construye nada', () => {
		// Con una sola no hay nada que deslizar, y cada tema la pinta a su
		// manera: devolver null es lo que les deja hacerlo.
		assert.equal(construirCarrusel([]), null);
		assert.equal(construirCarrusel(['/a.jpg']), null);
		assert.equal(construirCarrusel(null), null);
		assert.equal(construirCarrusel('no es una lista'), null);
	});

	test('con dos o más construye pista y puntos', () => {
		const c = construirCarrusel(['/a.jpg', '/b.jpg', '/c.jpg'], { alt: 'HAMBURGUESA' });
		assert.equal(c.className, 'modal-carousel');

		const pista = c.hijos.find(h => h.className === 'carousel-track');
		const puntos = c.hijos.find(h => h.className === 'carousel-dots');
		assert.equal(pista.hijos.length, 3, 'una diapositiva por foto');
		assert.equal(puntos.hijos.length, 3, 'un punto por foto');
		assert.equal(puntos.hijos[0].className, 'carousel-dot active', 'el primero arranca activo');
		assert.equal(puntos.hijos[1].className, 'carousel-dot');
	});

	test('cada foto lleva su URL y el texto alternativo', () => {
		const c = construirCarrusel(['/a.jpg', '/b.jpg'], { alt: 'HAMBURGUESA' });
		const imgs = c.hijos.find(h => h.className === 'carousel-track').hijos.map(d => d.hijos[0]);
		assert.deepEqual(imgs.map(i => i.src), ['/a.jpg', '/b.jpg']);
		assert.ok(imgs.every(i => i.alt === 'HAMBURGUESA'));
	});

	test('sin visor de imagen las fotos no prometen ampliarse', () => {
		// explorar no tiene visor: si se dejara el cursor de zoom, el cliente
		// pulsaría esperando algo que no pasa.
		const c = construirCarrusel(['/a.jpg', '/b.jpg']);
		const img = c.hijos.find(h => h.className === 'carousel-track').hijos[0].hijos[0];
		assert.equal(img.style.cursor, 'default');
		assert.equal(img.onclick, null);
	});

	test('con visor de imagen sí se pueden ampliar', () => {
		const ampliadas = [];
		const c = construirCarrusel(['/a.jpg', '/b.jpg'], { alAmpliar: u => ampliadas.push(u) });
		const imgs = c.hijos.find(h => h.className === 'carousel-track').hijos.map(d => d.hijos[0]);
		assert.equal(imgs[0].style.cursor, 'zoom-in');
		imgs[1].onclick();
		assert.deepEqual(ampliadas, ['/b.jpg'], 'amplía la foto que se pulsó, no la primera');
	});

	test('pulsar un punto mueve la pista y marca el activo', () => {
		const c = construirCarrusel(['/a.jpg', '/b.jpg', '/c.jpg']);
		const pista = c.hijos.find(h => h.className === 'carousel-track');
		const puntos = c.hijos.find(h => h.className === 'carousel-dots').hijos;

		puntos[2].onclick();
		assert.equal(pista.style.transform, 'translateX(-200%)', 'tercera foto');
		assert.ok(puntos[2].classList.contains('active'));
		assert.ok(!puntos[0].classList.contains('active'));
	});

	test('el deslizamiento pasa de foto y no se propaga', () => {
		// Si el gesto subiera, los temas que lo usan para pasar de producto o
		// cerrar la ficha reaccionarían también.
		const c = construirCarrusel(['/a.jpg', '/b.jpg']);
		const pista = c.hijos.find(h => h.className === 'carousel-track');
		let sePropago = true;

		c.oyentes.touchstart[0]({ touches: [{ clientX: 300 }] });
		c.oyentes.touchend[0]({ changedTouches: [{ clientX: 200 }], stopPropagation: () => { sePropago = false; } });

		assert.equal(pista.style.transform, 'translateX(-100%)', 'avanza una foto');
		assert.equal(sePropago, false, 'el gesto se detiene en el carrusel');
	});

	test('un deslizamiento corto no cuenta', () => {
		const c = construirCarrusel(['/a.jpg', '/b.jpg']);
		const pista = c.hijos.find(h => h.className === 'carousel-track');
		c.oyentes.touchstart[0]({ touches: [{ clientX: 300 }] });
		c.oyentes.touchend[0]({ changedTouches: [{ clientX: 280 }], stopPropagation() {} });
		assert.equal(pista.style.transform, undefined, '20px es un roce, no un gesto');
	});

	test('no se pasa de la última ni antes de la primera', () => {
		const c = construirCarrusel(['/a.jpg', '/b.jpg']);
		const pista = c.hijos.find(h => h.className === 'carousel-track');
		const deslizar = (desde, hasta) => {
			c.oyentes.touchstart[0]({ touches: [{ clientX: desde }] });
			c.oyentes.touchend[0]({ changedTouches: [{ clientX: hasta }], stopPropagation() {} });
		};
		deslizar(300, 100);   // a la segunda
		deslizar(300, 100);   // intenta pasar de la última
		assert.equal(pista.style.transform, 'translateX(-100%)', 'se queda en la última');
		deslizar(100, 300);   // vuelve a la primera
		deslizar(100, 300);   // intenta ir antes de la primera
		assert.equal(pista.style.transform, 'translateX(-0%)', 'se queda en la primera');
	});
});
