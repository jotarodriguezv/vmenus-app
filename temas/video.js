import { restaurante, categorias, productos, noImgHtml } from '../core/menu.js';
import { esc, escUrl } from '../core/html.js';
import { planDe } from '../core/planes.js';
import { filtrosEnUso, pasaFiltros } from '../core/filtros.js';
import { activarCarrito, agregarSimple, openCustomModal, tienePersonalizacion } from '../core/carrito.js';

// ── TEMA: VIDEO ───────────────────────────────────────────────
// Carta en video. Una sola columna, un plato por fila, el video a
// sangre en 16:9 con la ficha pegada debajo.
//
// Es el primer tema que no pinta imágenes sino video, y eso cambia
// cuatro cosas respecto a los demás:
//
// 1. El peso. Un video ronda los 700 KB y una categoría puede tener
//    doce platos. Cargarlos todos al abrir son ocho megas sobre la
//    mesa de un restaurante con mala cobertura, así que aquí NADA se
//    descarga hasta que el plato se acerca a la pantalla: los <video>
//    nacen con preload="none" y sin src, solo con su portada.
//
// 2. El arranque. Un observador que llame a play() y pause() más rápido
//    de lo que el navegador tarda en arrancar deja el video congelado
//    con la portada puesta — el famoso "AbortError: play() interrupted
//    by pause()". Por eso todo pasa por reproducir()/pausar(), que
//    esperan a que la promesa anterior se resuelva antes de hacer lo
//    contrario.
//
// 3. La carga del aparato. Se mueve un solo video a la vez, el que más
//    se ve. Dos decodificaciones de 720p a la vez mientras el dedo
//    arrastra atascan un móvil de gama media, que es con lo que va a
//    mirar la carta media sala.
//
// 4. El encuadre. El hueco es 16:9 fijo y el video va con object-fit
//    cover, no contain: si algún día entra un archivo con otra
//    proporción se recorta, pero la carta no se rompe con franjas
//    negras a los lados.

// Si el visitante pidió menos movimiento en su sistema, no le
// arrancamos seis videos en la cara: se queda la portada y los
// controles nativos para quien quiera darle play.
const menosMovimiento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ── CARRITO (opcional) ────────────────────────────────────────
// El carrito no es una plantilla aparte: es un interruptor. La maquinaria
// vive en core/carrito.js y este tema solo decide si la enciende, dónde
// pone el botón de agregar y cuál usa para abrir el pedido.
//
// Hacen falta las dos condiciones. El plan dice si el negocio puede
// tenerlo; el atributo, si lo quiere. Un restaurante con plan de sobra
// puede querer su carta sin pedidos.
function conCarrito() {
	return !!(planDe(restaurante).carrito && restaurante?.atributos?.carrito);
}

// ── FILTROS (opcional) ────────────────────────────────────────
// Se encienden solos: si el restaurante configuró filtros y algún plato los
// cumple, aparecen. No hay interruptor porque no hay nada que decidir —
// configurarlos ya es quererlos, y si no hay ninguno no se ve nada.
const filtrosActivos = new Set();

function pintarFiltros() {
	const fila = document.getElementById('navFiltros');
	if (!fila) return;
	fila.innerHTML = '';

	const disponibles = filtrosEnUso();
	if (!disponibles.length) return;   // :empty en el CSS lo hace desaparecer

	disponibles.forEach(f => {
		const chip = document.createElement('button');
		chip.className = 'filtro-chip' + (filtrosActivos.has(f.id) ? ' activo' : '');
		chip.textContent = `${f.emoji || ''} ${f.label}`.trim();
		chip.onclick = () => {
			if (filtrosActivos.has(f.id)) filtrosActivos.delete(f.id);
			else filtrosActivos.add(f.id);
			chip.classList.toggle('activo');
			aplicarFiltros();
		};
		fila.appendChild(chip);
	});
}

// Se esconden platos en vez de repintar la carta. Repintar recrearía los
// <video> y los observadores, y el que estuviera sonando volvería a empezar
// desde el principio con solo tocar un filtro.
function aplicarFiltros() {
	document.querySelectorAll('.vid-lista .category-section').forEach(seccion => {
		let visibles = 0;
		seccion.querySelectorAll('.vid-plato').forEach(art => {
			const p = productos.find(x => x.id === art.dataset.plato);
			const pasa = !p || pasaFiltros(p, filtrosActivos);
			art.style.display = pasa ? '' : 'none';
			if (pasa) visibles++;
		});
		// Una categoría sin nada que enseñar es un título suelto en mitad de
		// la carta: se va con sus platos.
		seccion.style.display = visibles ? '' : 'none';
	});
}

export function buildNav() {
	const nav = document.getElementById('navScroll');
	if (!nav) return;
	nav.innerHTML = '';
	let primero = true;

	categorias.forEach(cat => {
		if (!productos.some(p => p.categoria_id === cat.id)) return;

		const btn = document.createElement('button');
		btn.className = 'nav-btn' + (primero ? ' active' : '');
		btn.textContent = `${cat.emoji || ''} ${cat.nombre}`.trim();
		btn.dataset.cat = cat.id;
		btn.onclick = () => {
			document.getElementById('sec-' + cat.id)
				?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		};
		nav.appendChild(btn);
		primero = false;
	});

	pintarFiltros();

	if (!conCarrito()) return;
	activarCarrito();
	// Este tema no tiene cabecera fija donde colgar el botón del carrito, así
	// que usa el flotante. Enseñarlo es cosa del tema y no de la maquinaria:
	// cada uno lo lleva en un sitio distinto.
	const fab = document.getElementById('cartFab');
	if (fab) fab.style.display = 'block';
}

// El video y su portada los deja el worker en atributos cuando termina
// de procesar, como un objeto { url, portada, duracion } — no como dos
// campos sueltos. La ruta del master no está aquí a propósito: ese
// archivo es interno y la carta pública lee atributos entero.
//
// Mientras no haya video, el plato cae a su imagen normal, así que la
// carta se puede montar y ver antes de subir un solo video.
function mediaDe(p) {
	const v       = p.atributos?.video;
	const video   = v?.url;
	const portada = v?.portada || p.imagen_url;

	if (video) {
		return `<video class="vid-video"
			data-src="${escUrl(video)}"
			${portada ? `poster="${escUrl(portada)}"` : ''}
			muted loop playsinline preload="none"
			${menosMovimiento ? 'controls' : ''}></video>`;
	}
	if (p.imagen_url) {
		return `<img class="vid-img" src="${escUrl(p.imagen_url)}"
			alt="${esc(p.nombre)}" loading="lazy">`;
	}
	return noImgHtml();
}

export function buildMenu() {
	const main = document.getElementById('mainContent');
	if (!main) return;
	main.innerHTML = '';

	const lista = document.createElement('div');
	lista.className = 'vid-lista';
	const hayCarrito = conCarrito();

	categorias.forEach(cat => {
		const prods = productos.filter(p => p.categoria_id === cat.id);
		if (!prods.length) return;

		const seccion = document.createElement('section');
		// La clase y el id son los mismos que usa el resto de temas
		// para que el scroll spy compartido siga encontrándolos.
		seccion.className = 'category-section';
		seccion.id = 'sec-' + cat.id;

		seccion.innerHTML = `
			<div class="vid-cat">${esc(cat.emoji || '')} ${esc(cat.nombre)}</div>
			${prods.map(p => `
				<article class="vid-plato" data-plato="${esc(p.id)}">
					<div class="vid-media">${mediaDe(p)}</div>
					<div class="vid-info">
						<div class="vid-fila">
							<h3 class="vid-nombre">${esc(p.nombre)}</h3>
							<span class="vid-precio">${esc(p.precio)}</span>
						</div>
						${p.descripcion_avanzada || p.descripcion
							? `<p class="vid-desc">${esc(p.descripcion_avanzada || p.descripcion)}</p>`
							: ''}
						${hayCarrito ? `<div class="vid-accion">
							<button class="vid-add" data-plato="${esc(p.id)}">${
								tienePersonalizacion(p) ? '+ Personalizar' : '+ Agregar'
							}</button>
						</div>` : ''}
					</div>
				</article>
			`).join('')}
		`;

		lista.appendChild(seccion);
	});

	main.appendChild(lista);
	activarVideos();
	if (hayCarrito) activarBotonesAgregar();
}

// ── AGREGAR AL CARRITO ────────────────────────────────────────
// Un solo escuchador para toda la lista en vez de uno por plato: con
// treinta platos son treinta escuchadores que hay que crear y que el
// navegador tiene que mantener, y el comportamiento es idéntico.
function activarBotonesAgregar() {
	const lista = document.querySelector('.vid-lista');
	if (!lista) return;

	lista.addEventListener('click', e => {
		const btn = e.target.closest('.vid-add');
		if (!btn) return;

		const p = productos.find(x => x.id === btn.dataset.plato);
		if (!p) return;

		// Con toppings se abre el modal para elegirlos; sin ellos entra
		// directo. Lo decide el plato, no el restaurante: en una misma carta
		// la hamburguesa se personaliza y la gaseosa no.
		if (tienePersonalizacion(p)) return openCustomModal(p.id);

		agregarSimple(p);
		// Una confirmación que se ve sin sacar nada por encima: el propio
		// botón dice que sí y vuelve a su sitio.
		const antes = btn.textContent;
		btn.textContent = '✓ Agregado';
		setTimeout(() => { btn.textContent = antes; }, 900);
	});
}

// ── ARRANQUE Y PARADA DE LOS VIDEOS ───────────────────────────
// play() devuelve una promesa. Si se llama a pause() antes de que se
// resuelva, el navegador aborta la reproducción y el video se queda
// quieto con la portada puesta. Guardamos la promesa en el propio
// elemento para no pisarnos: no se arranca dos veces y no se pausa
// hasta que el arranque haya terminado.
function reproducir(v) {
	if (v._pendiente) return;
	v._pendiente = v.play()
		.catch(() => {})              // autoplay bloqueado: se queda la portada
		.finally(() => { v._pendiente = null; });
}

async function pausar(v) {
	if (v._pendiente) await v._pendiente;
	v.pause();
}

function activarVideos() {
	const videos = document.querySelectorAll('.vid-video');
	if (!videos.length) return;

	// Descarga: se le pone el src cuando el plato está a un par de
	// pantallas de distancia, no antes.
	const ioCarga = new IntersectionObserver(entradas => {
		entradas.forEach(e => {
			if (!e.isIntersecting) return;
			const v = e.target;
			if (!v.src && v.dataset.src) v.src = v.dataset.src;
			ioCarga.unobserve(v);
		});
	}, { rootMargin: '200% 0px' });

	videos.forEach(v => ioCarga.observe(v));

	if (menosMovimiento) return;

	// Reproducción: uno solo a la vez, el que más se vea.
	//
	// En una pantalla de móvil caben dos tarjetas a medias, y dejando que se
	// muevan las dos hay dos decodificaciones de 720p simultáneas mientras el
	// dedo arrastra. Un teléfono de gama media se atasca ahí — y la gama media
	// es la mitad de quienes van a mirar la carta sentados en la mesa.
	//
	// Hacen falta varios umbrales y no uno: con threshold único el navegador
	// solo avisa al cruzarlo, y aquí hay que saber cuál de los dos se ve más
	// en cada momento, no si se ven.
	const visibles = new Map();

	const ioPlay = new IntersectionObserver(entradas => {
		entradas.forEach(e => {
			if (e.isIntersecting) visibles.set(e.target, e.intersectionRatio);
			else visibles.delete(e.target);
		});

		let elegido = null, mejor = 0;
		for (const [v, cuanto] of visibles) {
			if (cuanto > mejor) { mejor = cuanto; elegido = v; }
		}

		videos.forEach(v => {
			if (v !== elegido) return pausar(v);
			if (!v.src && v.dataset.src) v.src = v.dataset.src;
			reproducir(v);
		});
	}, { threshold: [0, 0.25, 0.5, 0.75, 1] });

	videos.forEach(v => ioPlay.observe(v));

	// Con la pestaña en segundo plano no tiene sentido gastar batería
	// ni datos moviendo videos que nadie está viendo.
	document.addEventListener('visibilitychange', () => {
		if (document.hidden) videos.forEach(pausar);
	});
}

export function initScrollSpy() {
	const observer = new IntersectionObserver(entradas => {
		entradas.forEach(entrada => {
			if (!entrada.isIntersecting) return;
			const catId = entrada.target.id.replace('sec-', '');
			document.querySelectorAll('.nav-btn').forEach(btn => {
				btn.classList.toggle('active', btn.dataset.cat === catId);
			});
			document.querySelector(`.nav-btn[data-cat="${catId}"]`)
				?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
		});
	}, { rootMargin: '-40% 0px -55% 0px' });

	document.querySelectorAll('.category-section').forEach(sec => observer.observe(sec));
}
