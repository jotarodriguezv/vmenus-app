import { categorias, productos, noImgHtml } from '../core/menu.js';
import { esc, escUrl } from '../core/html.js';

// ── TEMA: VIDEO ───────────────────────────────────────────────
// Carta en video. Una sola columna, un plato por fila, el video a
// sangre en 16:9 con la ficha pegada debajo.
//
// Es el primer tema que no pinta imágenes sino video, y eso cambia
// tres cosas respecto a los demás:
//
// 1. El peso. Un video ronda los 700 KB y una categoría puede tener
//    doce platos. Cargarlos todos al abrir son ocho megas sobre la
//    mesa de un restaurante con mala cobertura, así que aquí NADA se
//    descarga hasta que el plato se acerca a la pantalla: los <video>
//    nacen con preload="none" y sin src, solo con su portada.
//
// 2. El arranque. Un observador que llame a play() y pause() más
//    rápido de lo que el navegador tarda en arrancar deja el video
//    congelado — el famoso "AbortError: play() interrupted by pause()".
//    Por eso todo pasa por reproducir()/pausar(), que esperan a que la
//    promesa anterior se resuelva antes de hacer lo contrario.
//
// 3. El encuadre. El hueco es 16:9 fijo y el video va con object-fit
//    cover, no contain: si algún día entra un archivo con otra
//    proporción se recorta, pero la carta no se rompe con franjas
//    negras a los lados.

// Si el visitante pidió menos movimiento en su sistema, no le
// arrancamos seis videos en la cara: se queda la portada y los
// controles nativos para quien quiera darle play.
const menosMovimiento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

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
				<article class="vid-plato">
					<div class="vid-media">${mediaDe(p)}</div>
					<div class="vid-info">
						<div class="vid-fila">
							<h3 class="vid-nombre">${esc(p.nombre)}</h3>
							<span class="vid-precio">${esc(p.precio)}</span>
						</div>
						${p.descripcion_avanzada || p.descripcion
							? `<p class="vid-desc">${esc(p.descripcion_avanzada || p.descripcion)}</p>`
							: ''}
					</div>
				</article>
			`).join('')}
		`;

		lista.appendChild(seccion);
	});

	main.appendChild(lista);
	activarVideos();
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

	// Reproducción: solo se mueve lo que está de verdad en pantalla.
	const ioPlay = new IntersectionObserver(entradas => {
		entradas.forEach(e => {
			const v = e.target;
			if (e.isIntersecting) {
				if (!v.src && v.dataset.src) v.src = v.dataset.src;
				reproducir(v);
			} else {
				pausar(v);
			}
		});
	}, { threshold: 0.5 });

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
