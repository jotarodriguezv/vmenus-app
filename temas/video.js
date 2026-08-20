import { restaurante, categorias, productos } from '../core/menu.js';
import { esc } from '../core/html.js';
import { mediaDe, activarVideos } from '../core/reproduccion.js';
import { planDe } from '../core/planes.js';
import { montarChips, ocultarNoCoinciden } from '../core/filtros.js';
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

	// Los chips los pinta core/filtros.js; aquí solo se dice qué esconder.
	montarChips(() => ocultarNoCoinciden('.vid-plato'));

	if (!conCarrito()) return;
	activarCarrito();
	// Este tema no tiene cabecera fija donde colgar el botón del carrito, así
	// que usa el flotante. Enseñarlo es cosa del tema y no de la maquinaria:
	// cada uno lo lleva en un sitio distinto.
	const fab = document.getElementById('cartFab');
	if (fab) fab.style.display = 'block';
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
