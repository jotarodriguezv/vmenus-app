import { restaurante, categorias, productos } from '../core/menu.js';
import { esc } from '../core/html.js';
import { mediaDe, activarVideos } from '../core/reproduccion.js';
import { planDe } from '../core/planes.js';
import { montarChips, ocultarNoCoinciden } from '../core/filtros.js';
import { activarCarrito, agregarSimple, openCustomModal, tienePersonalizacion } from '../core/carrito.js';

// ── TEMA: VERTICAL ────────────────────────────────────────────
// La carta en video, pero a pantalla completa y de a un plato: se desliza
// hacia arriba y aparece el siguiente, como en un carrete de reels.
//
// Es hermana de temas/video.js, no su sustituta. Cambia el encuadre y la
// forma de moverse, no lo que se puede hacer: las dos leen los mismos
// productos, encienden el mismo carrito y los mismos filtros, y comparten
// entera la maquinaria de reproducción (core/reproduccion.js). Lo único
// que de verdad las separa es que aquí el video manda sobre la pantalla y
// el texto va encima, y allí el video es una tarjeta y el texto va debajo.
//
// Cuatro decisiones que conviene no deshacer sin saber por qué están:
//
// 1. El desplazamiento va por pasos (scroll-snap) y en un contenedor
//    propio, no en la página. Si el carrete fuera la página, en el móvil
//    la barra de direcciones del navegador se encogería al deslizar, la
//    altura de la ventana cambiaría a mitad de gesto y cada plato daría un
//    salto. Con contenedor propio la altura no cambia nunca.
//
// 2. El video va recortado a pantalla (cover) y sin franjas. Los archivos
//    que sirve esta carta ya vienen en 9:16 porque el worker los corta así
//    cuando el restaurante es vertical, pero un plato que todavía no tenga
//    video cae a su foto — normalmente apaisada — y tiene que seguir
//    llenando la pantalla igual.
//
// 3. Ningún video lleva sonido. No es que esté silenciado: el worker los
//    codifica sin pista de audio (-an). Por eso no hay botón de altavoz —
//    no habría nada que encender — y por eso los navegadores no bloquean
//    la reproducción automática.
//
// 4. La navegación flota sobre el video en vez de ocupar una barra. Una
//    carta a pantalla completa que reserva ochenta píxeles arriba para
//    categorías y otros cuarenta para filtros deja de ser pantalla
//    completa. El velo oscuro de detrás es lo que mantiene legible el
//    texto sobre cualquier fotograma.

function conCarrito() {
	return !!(planDe(restaurante).carrito && restaurante?.atributos?.carrito);
}

// Categorías que de verdad tienen algo que enseñar. Se calcula una vez y la
// usan la barra de arriba y el carrete, para que no puedan discrepar.
function categoriasConPlatos() {
	return categorias.filter(c => productos.some(p => p.categoria_id === c.id));
}

// ── CHROME ────────────────────────────────────────────────────
// La barra flotante vive FUERA de #mainContent a propósito: buildMenu()
// vacía ese contenedor entero, y si estuviera dentro se iría con él.
function montarChrome() {
	const main = document.getElementById('mainContent');
	if (!main) return null;

	let chrome = document.getElementById('verChrome');
	if (!chrome) {
		chrome = document.createElement('div');
		chrome.id = 'verChrome';
		chrome.className = 'ver-chrome';
		chrome.innerHTML = `
			<div class="ver-cats" id="verCats"></div>
			<div class="ver-filtros nav-filtros" id="verFiltros"></div>`;
		main.insertAdjacentElement('beforebegin', chrome);
	}
	return chrome;
}

export function buildNav() {
	if (!montarChrome()) return;

	const cats = document.getElementById('verCats');
	cats.innerHTML = '';

	let primera = true;
	categoriasConPlatos().forEach(cat => {
		const btn = document.createElement('button');
		btn.className = 'ver-cat-btn' + (primera ? ' active' : '');
		btn.textContent = `${cat.emoji || ''} ${cat.nombre}`.trim();
		btn.dataset.cat = cat.id;
		// Al primer plato de la categoría, no a la sección: la sección no
		// ocupa pantalla propia y el carrete pararía en el sitio equivocado.
		btn.onclick = () => {
			document.querySelector(`.ver-plato[data-cat="${cat.id}"]`)
				?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		};
		cats.appendChild(btn);
		primera = false;
	});

	// Los chips los pinta core/filtros.js. Aquí se le dice dónde ponerlos,
	// porque este modelo no tiene ninguna de las dos barras que busca solo.
	montarChips(
		() => ocultarNoCoinciden('.ver-plato'),
		document.getElementById('verFiltros')
	);

	if (!conCarrito()) return;
	activarCarrito();
	const fab = document.getElementById('cartFab');
	if (fab) fab.style.display = 'block';
}

export function buildMenu() {
	const main = document.getElementById('mainContent');
	if (!main) return;
	main.innerHTML = '';
	main.classList.add('ver-reels');

	const hayCarrito = conCarrito();
	const cats = categoriasConPlatos();

	if (!cats.length) {
		main.innerHTML = '<div class="ver-vacio">Esta carta todavía no tiene platos.</div>';
		return;
	}

	cats.forEach(cat => {
		const prods = productos.filter(p => p.categoria_id === cat.id);

		const seccion = document.createElement('section');
		// Clase e id compartidos con el resto de temas: el spy y el
		// escondido por filtros los buscan así en todos los modelos.
		seccion.className = 'category-section';
		seccion.id = 'sec-' + cat.id;

		const titulo = `${esc(cat.emoji || '')} ${esc(cat.nombre)}`.trim();

		seccion.innerHTML = prods.map(p => `
			<article class="ver-plato" data-plato="${esc(p.id)}" data-cat="${esc(cat.id)}">
				<div class="ver-media">${mediaDe(p)}</div>
				<div class="ver-velo"></div>
				<div class="ver-info">
					<div class="ver-cat">${titulo}</div>
					<h3 class="ver-nombre">${esc(p.nombre)}</h3>
					${p.descripcion_avanzada || p.descripcion
						? `<p class="ver-desc">${esc(p.descripcion_avanzada || p.descripcion)}</p>`
						: ''}
					<div class="ver-fila">
						<span class="ver-precio">${esc(p.precio)}</span>
						${hayCarrito ? `<button class="ver-add" data-plato="${esc(p.id)}">${
							tienePersonalizacion(p) ? '+ Personalizar' : '+ Agregar'
						}</button>` : ''}
					</div>
				</div>
			</article>
		`).join('');

		main.appendChild(seccion);
	});

	activarVideos();
	mostrarPista(main);
	if (hayCarrito) activarBotonesAgregar(main);
}

// ── PISTA DE DESLIZAR ─────────────────────────────────────────
// Una carta a pantalla completa no enseña que hay más debajo: no se ve el
// borde del siguiente plato asomando, que es lo que en una lista normal
// invita a seguir. La flecha lo dice una vez y se va en cuanto el visitante
// demuestra que ya lo sabe — o sola, por si nunca desliza y se queda ahí
// parpadeando encima de la comida.
function mostrarPista(scroller) {
	if (scroller.querySelectorAll('.ver-plato').length < 2) return;

	const pista = document.createElement('div');
	pista.className = 'ver-pista';
	pista.innerHTML = '<span>Desliza</span>';
	document.getElementById('verChrome')?.appendChild(pista);

	// A qué altura. Con un valor fijo en el CSS la pista caía encima del
	// nombre del plato, porque la ficha mide lo que midan su nombre y su
	// descripción y eso no se sabe hasta que está pintado. Se mide la más
	// alta de todas —la pista es fija y no se mueve con el carrete— y se
	// pone justo por encima.
	const altas = [...scroller.querySelectorAll('.ver-info')]
		.map(el => el.getBoundingClientRect().height);
	pista.style.bottom = `calc(${Math.round(Math.max(0, ...altas)) + 40}px + env(safe-area-inset-bottom, 0px))`;

	const quitar = () => {
		pista.classList.add('ida');
		setTimeout(() => pista.remove(), 400);
	};
	scroller.addEventListener('scroll', quitar, { once: true, passive: true });
	setTimeout(quitar, 6000);
}

// ── AGREGAR AL CARRITO ────────────────────────────────────────
// Un solo escuchador para todo el carrete, igual que en temas/video.js:
// con treinta platos son treinta escuchadores para el mismo comportamiento.
function activarBotonesAgregar(scroller) {
	scroller.addEventListener('click', e => {
		const btn = e.target.closest('.ver-add');
		if (!btn) return;

		const p = productos.find(x => x.id === btn.dataset.plato);
		if (!p) return;

		if (tienePersonalizacion(p)) return openCustomModal(p.id);

		agregarSimple(p);
		const antes = btn.textContent;
		btn.textContent = '✓ Agregado';
		setTimeout(() => { btn.textContent = antes; }, 900);
	});
}

// ── CATEGORÍA ACTIVA ──────────────────────────────────────────
// Se mira el plato, no la sección. Con pasos de pantalla completa siempre
// hay uno ocupándola casi entera, así que un umbral alto da una respuesta
// limpia: o estás en este plato o estás en el siguiente, sin medias tintas.
export function initScrollSpy() {
	const scroller = document.getElementById('mainContent');
	if (!scroller) return;

	const observer = new IntersectionObserver(entradas => {
		entradas.forEach(entrada => {
			if (!entrada.isIntersecting) return;
			const catId = entrada.target.dataset.cat;
			document.querySelectorAll('.ver-cat-btn').forEach(btn => {
				btn.classList.toggle('active', btn.dataset.cat === catId);
			});
			document.querySelector(`.ver-cat-btn[data-cat="${catId}"]`)
				?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
		});
	}, { root: scroller, threshold: 0.6 });

	scroller.querySelectorAll('.ver-plato').forEach(el => observer.observe(el));
}
