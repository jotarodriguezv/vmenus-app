import { restaurante, categorias, productos } from '../core/menu.js';
import { esc, notaDe, htmlPrecio } from '../core/html.js';
import { mediaDe, activarVideos, tieneMultimedia } from '../core/reproduccion.js';
import { montarChips, ocultarNoCoinciden, filtrosEnUso, filtrosActivos } from '../core/filtros.js';
import { montarBuscador, hayQueOfrecerBuscador, terminoBusqueda } from '../core/buscador.js';
import { activarCarrito, agregarSimple, openCustomModal, tienePersonalizacion, carritoEncendido } from '../core/carrito.js';
import { tienePresentaciones } from '../core/presentaciones.js';

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

// La regla vive en core/carrito.js desde que topnav y sidebar también la usan.
const conCarrito = () => carritoEncendido();

// ── ESTILOS ───────────────────────────────────────────────────
// El mismo carrete con tres aspectos. NO son tres plantillas: cambia cómo se
// ve, no lo que se puede hacer, así que todo lo que los separa vive en el
// CSS y aquí solo se cuelga una clase del <body>.
//
// Copiarlo en tres archivos habría sido la quinta vez que tropezamos con lo
// mismo. El escapado de HTML, el carrusel, el carrito, los filtros y la
// reproducción acabaron todos en core/ después de que un fallo se arreglara
// en una copia y no en las otras. Un estilo nuevo son unas reglas de CSS y
// una opción en el desplegable del panel; nunca un archivo más.
//
// Los nombres describen lo que se ve y no la aplicación que recuerdan, que es
// de otra empresa y no tiene por qué aparecer dentro de este producto.
const ESTILOS = ['clasico', 'intenso', 'avance'];

function estiloDe() {
	const e = restaurante?.atributos?.estilo;
	return ESTILOS.includes(e) ? e : 'clasico';
}

// 'avance' es el único que enseña la barra de segmentos de arriba. Se
// construye igual en los tres —son unos pocos <i> vacíos— y el CSS decide si
// se ven: así el spy no tiene que preguntar por el estilo cada vez que pasa
// un plato, y encender el estilo no obliga a repintar la carta.
function pintarSegmentos() {
	const barra = document.getElementById('verSegmentos');
	if (!barra) return;
	const cuantos = [...document.querySelectorAll('.ver-plato')]
		.filter(el => el.style.display !== 'none').length;
	barra.innerHTML = '<i></i>'.repeat(cuantos);
}

// Categorías que de verdad tienen algo que enseñar. Se calcula una vez y la
// usan la barra de arriba y el carrete, para que no puedan discrepar.
function categoriasConPlatos() {
	return categorias.filter(c => productos.some(p => p.categoria_id === c.id));
}

// ── CHROME ────────────────────────────────────────────────────
// La barra flotante vive FUERA de #mainContent a propósito: buildMenu()
// vacía ese contenedor entero, y si estuviera dentro se iría con él.
//
// Una sola fila a la vista: las categorías y una lupa (30/09/2026). Antes eran
// tres —categorías, filtros y buscador— y se comían 148 px de 844, casi una
// sexta parte de una carta cuyo punto fuerte es el video a pantalla completa.
// El buscador y los filtros son lo mismo —acotar la carta— y se usan de vez en
// cuando, así que viven juntos detrás de la lupa. Dentro va primero el
// buscador y luego los chips: se lee de arriba abajo «busca o afina».
function montarChrome() {
	const main = document.getElementById('mainContent');
	if (!main) return null;

	let chrome = document.getElementById('verChrome');
	if (!chrome) {
		chrome = document.createElement('div');
		chrome.id = 'verChrome';
		chrome.className = 'ver-chrome';
		chrome.innerHTML = `
			<div class="ver-segmentos" id="verSegmentos"></div>
			<div class="ver-fila-cats">
				<div class="ver-cats" id="verCats"></div>
				<button class="ver-lupa" id="verLupa" type="button" hidden
					aria-label="Buscar y filtrar" aria-expanded="false" aria-controls="verBusqueda">
					<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
				</button>
			</div>
			<div class="ver-busqueda" id="verBusqueda" hidden>
				<div class="ver-buscador" id="verBuscador"></div>
				<div class="ver-filtros nav-filtros" id="verFiltros"></div>
			</div>`;
		main.insertAdjacentElement('beforebegin', chrome);
	}
	return chrome;
}

// La lupa solo existe si hay algo detrás: un buscador que se ofrece o al menos
// un filtro en uso. Y avisa cuando hay algo puesto con el panel cerrado: sin el
// punto, una carta acotada y escondida se vería como una carta a la que le
// faltan platos.
function actualizarLupa() {
	const lupa = document.getElementById('verLupa');
	if (!lupa) return;
	lupa.hidden = !(hayQueOfrecerBuscador() || filtrosEnUso().length);
	const enUso = filtrosActivos.size > 0 || terminoBusqueda().trim() !== '';
	lupa.classList.toggle('con-filtro', enUso);
	lupa.setAttribute('aria-label', enUso ? 'Buscar y filtrar (hay algo puesto)' : 'Buscar y filtrar');
}

function activarLupa() {
	const lupa = document.getElementById('verLupa');
	const panel = document.getElementById('verBusqueda');
	if (!lupa || !panel || lupa.dataset.listo) return;
	lupa.dataset.listo = '1';
	lupa.onclick = () => {
		const abrir = panel.hidden;
		panel.hidden = !abrir;
		lupa.setAttribute('aria-expanded', String(abrir));
		lupa.classList.toggle('abierta', abrir);
		// Quien toca la lupa quiere escribir: que el cursor ya esté dentro.
		if (abrir) document.getElementById('buscadorInput')?.focus();
	};
}

export function buildNav() {
	if (!montarChrome()) return;

	// El estilo va en el <body> y no en un contenedor del tema porque hay
	// piezas suyas que viven fuera: el carrito flotante y la barra social los
	// cuelga core/ de <body>, y desde una clase de aquí dentro no se llega.
	document.body.classList.add('estilo-' + estiloDe());

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
	// Al filtrar o buscar cambia cuántos platos quedan, así que la barra de
	// avance tiene que rehacerse: si no, marcaría posiciones de una carta que
	// ya no es la que se está viendo.
	const repintar = () => {
		ocultarNoCoinciden('.ver-plato:not(.ver-lista-sin-media), .ver-lista-fila');
		actualizarListasSinMedia();
		pintarSegmentos();
		actualizarLupa();
	};
	montarChips(repintar, document.getElementById('verFiltros'));
	// El buscador va en el mismo panel, por lo mismo: aquí no hay ninguna
	// barra donde meterlo, cada plato ocupa la pantalla entera. En su propio
	// contenedor y no en el de los chips porque montarChips vacía el suyo al
	// repintar, y se llevaría por delante lo que se estuviera escribiendo.
	montarBuscador(repintar, document.getElementById('verBuscador'));
	activarLupa();
	repintar();

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
		const conMultimedia = prods.filter(tieneMultimedia);
		const sinMultimedia = prods.filter(p => !tieneMultimedia(p));

		const seccion = document.createElement('section');
		// Clase e id compartidos con el resto de temas: el spy y el
		// escondido por filtros los buscan así en todos los modelos.
		seccion.className = 'category-section';
		seccion.id = 'sec-' + cat.id;

		const titulo = `${esc(cat.emoji || '')} ${esc(cat.nombre)}`.trim();

		// Aquí no hay cabecera de categoría: cada plato ocupa la pantalla. La nota
		// va en el PRIMER plato de la categoría, bajo su nombre, que es donde se
		// entra a ella; repetirla en cada uno taparía la comida.
		seccion.innerHTML = conMultimedia.map((p, i) => `
			<article class="ver-plato" data-plato="${esc(p.id)}" data-cat="${esc(cat.id)}">
				<div class="ver-media">${mediaDe(p)}</div>
				<div class="ver-velo"></div>
				<div class="ver-info">
					<div class="ver-cat">${titulo}</div>
					${i === 0 ? notaDe(cat, 'categoria-nota ver-nota') : ''}
					<h3 class="ver-nombre">${esc(p.nombre)}</h3>
					${p.descripcion_avanzada || p.descripcion
						? `<p class="ver-desc">${esc(p.descripcion_avanzada || p.descripcion)}</p>`
						: ''}
					<div class="ver-fila">
						<span class="ver-precio">${htmlPrecio(p)}</span>
						${hayCarrito ? botonAgregar(p) : ''}
					</div>
				</div>
			</article>
		`).join('') + gruposDe(sinMultimedia, 8).map((grupo, indice) => `
			<article class="ver-plato ver-lista-sin-media" data-cat="${esc(cat.id)}">
				<div class="ver-lista-contenido">
					<div class="ver-cat">${titulo}</div>
					${!conMultimedia.length && indice === 0 ? notaDe(cat, 'categoria-nota ver-nota') : ''}
					<div class="ver-lista-filas">
						${grupo.map(p => `
							<article class="ver-lista-fila" data-plato="${esc(p.id)}">
								<div class="ver-lista-fila-principal">
									<h3>${esc(p.nombre)}</h3>
									${p.descripcion_avanzada || p.descripcion
										? `<p>${esc(p.descripcion_avanzada || p.descripcion)}</p>`
										: ''}
								</div>
								<div class="ver-lista-fila-final">
									<span>${htmlPrecio(p)}</span>
									${hayCarrito ? botonAgregar(p) : ''}
								</div>
							</article>
						`).join('')}
					</div>
				</div>
			</article>
		`).join('');

		main.appendChild(seccion);
	});

	activarVideos();
	pintarSegmentos();
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
	const altas = [...scroller.querySelectorAll('.ver-info, .ver-lista-contenido')]
		.map(el => el.getBoundingClientRect().height);
	pista.style.bottom = `calc(${Math.round(Math.max(0, ...altas)) + 40}px + env(safe-area-inset-bottom, 0px))`;

	const quitar = () => {
		pista.classList.add('ida');
		setTimeout(() => pista.remove(), 400);
	};
	scroller.addEventListener('scroll', quitar, { once: true, passive: true });
	setTimeout(quitar, 6000);
}

// Cada lista ocupa una pantalla completa; partirla evita que una categoría
// grande fuerce un scroll interno y mantenga el gesto de reels consistente.
function gruposDe(lista, tamano) {
	return Array.from({ length: Math.ceil(lista.length / tamano) }, (_, indice) =>
		lista.slice(indice * tamano, (indice + 1) * tamano));
}

// Los filtros esconden filas, no la pantalla que las agrupa. Esta segunda
// pasada apaga la pantalla cuando ya no le queda ninguna fila visible.
function actualizarListasSinMedia() {
	document.querySelectorAll('.ver-lista-sin-media').forEach(lista => {
		const hayVisible = [...lista.querySelectorAll('.ver-lista-fila')]
			.some(fila => fila.style.display !== 'none');
		lista.style.display = hayVisible ? '' : 'none';
	});
}

// ── AGREGAR AL CARRITO ────────────────────────────────────────
// El botón es solo el signo «+» (decidido el 30/09/2026): con el carrito
// flotante al lado, que lleva la cuenta, el texto «Agregar» sobraba y el botón
// medía casi lo mismo que el precio. Como ya no dice qué hace, el nombre
// accesible lo dice por él, y el área de toque se mantiene en 44 px aunque el
// botón se vea de 40 (ver .ver-add::after en index.html).
function etiquetaAgregar(p) {
	if (tienePresentaciones(p)) return `Elegir presentación de ${p.nombre}`;
	return tienePersonalizacion(p) ? `Personalizar ${p.nombre}` : `Agregar ${p.nombre} al pedido`;
}

function botonAgregar(p) {
	return `<button class="ver-add" data-plato="${esc(p.id)}" aria-label="${esc(etiquetaAgregar(p))}">+</button>`;
}

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
		// Se restaura lo que dice el plato y no «lo de antes»: con dos toques
		// seguidos, «antes» ya sería la marca de agregado y el botón se quedaría con ella.
		btn.textContent = '✓';
		btn.classList.add('ver-add-ok');
		btn.setAttribute('aria-label', `${p.nombre} agregado al pedido`);
		clearTimeout(btn._restaurar);
		btn._restaurar = setTimeout(() => {
			btn.textContent = '+';
			btn.classList.remove('ver-add-ok');
			btn.setAttribute('aria-label', etiquetaAgregar(p));
		}, 900);
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

			// Y de paso el segmento. Se cuenta entre los que se ven, no entre
			// todos: con un filtro puesto, contar los escondidos dejaría la
			// barra marcando una posición que no existe en pantalla.
			//
			// Va aquí y no en un observador propio porque es exactamente el
			// mismo dato —qué plato se está viendo— y dos observadores para
			// una sola pregunta se contradicen el día que cambie el umbral.
			const visibles = [...scroller.querySelectorAll('.ver-plato')]
				.filter(el => el.style.display !== 'none');
			const donde = visibles.indexOf(entrada.target);
			document.querySelectorAll('#verSegmentos i').forEach((seg, i) => {
				seg.classList.toggle('visto', i <= donde);
			});
		});
	}, { root: scroller, threshold: 0.6 });

	scroller.querySelectorAll('.ver-plato').forEach(el => observer.observe(el));
}
