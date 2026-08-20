// ── REPRODUCCIÓN DE VIDEO ─────────────────────────────────────
// Lo que cuesta trabajo de pintar video en una carta, compartido por las
// plantillas que lo hacen: la de video horizontal y la vertical.
//
// Se sacó aquí en cuanto hubo una segunda. Copiarlo habría significado que el
// día que se arregle un fallo de reproducción se arregle en una y no en la
// otra — que es literalmente lo que pasó con el escapado de HTML antes de que
// existiera core/html.js.
//
// Las tres cosas que hay que hacer bien:
//
// 1. El peso. Un video ronda los 700 KB y una categoría puede tener doce
//    platos. Aquí NADA se descarga hasta que el plato se acerca a la
//    pantalla: los <video> nacen con preload="none" y sin src, solo con su
//    portada.
//
// 2. El arranque. Un observador que llame a play() y pause() más rápido de lo
//    que el navegador tarda en arrancar deja el video congelado con la
//    portada puesta — el famoso "AbortError: play() interrupted by pause()".
//
// 3. La carga del aparato. Se mueve un solo video a la vez, el que más se ve.
//    Dos decodificaciones de 720p a la vez mientras el dedo arrastra atascan
//    un móvil de gama media, que es con lo que va a mirar la carta media sala.

import { noImgHtml } from './menu.js';
import { esc, escUrl } from './html.js';

// Si el visitante pidió menos movimiento en su sistema, no le arrancamos seis
// videos en la cara: se queda la portada y los controles nativos para quien
// quiera darle play.
export const menosMovimiento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// El video y su portada los deja el worker en atributos cuando termina
// de procesar, como un objeto { url, portada, duracion } — no como dos
// campos sueltos. La ruta del master no está aquí a propósito: ese
// archivo es interno y la carta pública lee atributos entero.
//
// Mientras no haya video, el plato cae a su imagen normal, así que la
// carta se puede montar y ver antes de subir un solo video.
export function mediaDe(p) {
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

export function activarVideos() {
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
