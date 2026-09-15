// ── TEMA: SIDEBAR ─────────────────────────────────────────────
// Nav lateral que se abre con botón hamburguesa.
// Usado por: Malparados y restaurantes con header fijo.

import { categorias, productos } from '../core/menu.js';
import { llevarFocoA, devolverFoco, encerrarTab, soltarTab } from '../core/teclado.js';
import { activarCarrito, carritoEncendido } from '../core/carrito.js';

export function buildNav() {
	const nav = document.getElementById('sidebarNav');
	if (!nav) return;
	nav.innerHTML = '';

	categorias.forEach(cat => {
		const tieneProductos = productos.some(p => p.categoria_id === cat.id);
		if (!tieneProductos) return;

		const link = document.createElement('button');
		link.className = 'sidebar-link';
		link.textContent = `${cat.emoji || ''} ${cat.nombre}`.trim();
		link.onclick = () => {
			document.getElementById('sec-' + cat.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			closeSidebar();
		};
		nav.appendChild(link);
	});

	// Registrar eventos del sidebar
	document.getElementById('menuToggle')?.addEventListener('click', openSidebar);
	document.getElementById('closeMenu')?.addEventListener('click', closeSidebar);
	document.getElementById('overlay')?.addEventListener('click', closeSidebar);

	// Escape cierra el lateral, igual que cierra las demás capas.
	//
	// El manejador global de core/menu.js ya atiende Escape y cierra la ficha
	// del plato, la lupa y la promoción. El lateral se quedaba fuera de esa
	// lista siendo la capa que tapa la pantalla entera en un móvil: enseñar
	// que la tecla sirve en tres sitios y que falle en el cuarto es peor que
	// no tenerla en ninguno.
	//
	// Va aquí y no en aquella línea a propósito: closeSidebar vive en este
	// módulo, y core/ no importa nunca de temas/ —el loader los carga con un
	// import dinámico—. Ponerlo allí ataría el núcleo a uno de los seis temas
	// y lo arrastraría también a los cinco que no tienen lateral.
	//
	// Se comprueba que esté abierto antes de tocar nada: closeSidebar limpia
	// body.style.overflow, y hacerlo con el lateral cerrado le devolvería el
	// scroll a la página por debajo de otra capa que sí lo tenía bloqueado.
	document.addEventListener('keydown', e => {
		if (e.key !== 'Escape') return;
		if (!document.getElementById('sidebar')?.classList.contains('open')) return;
		closeSidebar();
	});

	// Carrito desde el 15/09/2026, si el plan lo incluye y el restaurante lo
	// encendió. Sidebar sí tiene cabecera fija, así que el botón va ahí, en el
	// mismo sitio que en el modelo 'carrito'.
	//
	// Ese modelo reutiliza este buildNav y enciende el carrito por su cuenta
	// después. Llamar aquí a activarCarrito no lo duplica: solo actúa la primera
	// vez por página (ver core/carrito.js).
	if (!carritoEncendido()) return;
	activarCarrito();
	const boton = document.getElementById('cartBtn');
	if (boton) boton.style.display = 'flex';
}

// MD4: al abrir el lateral el foco se quedaba en el botón de fuera, y tabulando
// se recorría la carta de detrás con el lateral tapándola. Lo mismo que las
// fichas (core/teclado.js): el foco entra, el Tab no sale, y al cerrar vuelve
// al botón que lo abrió.
function openSidebar() {
	const lateral = document.getElementById('sidebar');
	lateral?.classList.add('open');
	document.getElementById('overlay')?.classList.add('open');
	document.body.style.overflow = 'hidden';
	document.getElementById('menuToggle')?.setAttribute('aria-expanded', 'true');
	if (!lateral) return;
	// El foco tiene que volver a SU botón al cerrar, y llevarFocoA recuerda lo que
	// estuviera enfocado. Tras un toque eso no es el botón: Safari no enfoca un
	// botón al pulsarlo, y un clic con el ratón tampoco lo deja siempre. Visto en
	// un navegador: al cerrar, el foco acababa en otra parte. Se enfoca antes de
	// entrar para que sea el botón lo que se recuerda.
	document.getElementById('menuToggle')?.focus({ preventScroll: true });
	// A la primera categoría, que es a lo que se viene; si no hay, a cerrar.
	llevarFocoA(lateral.querySelector('.sidebar-link') || document.getElementById('closeMenu'));
	encerrarTab(lateral);
}

function closeSidebar() {
	const lateral = document.getElementById('sidebar');
	const estabaAbierto = lateral?.classList.contains('open');
	lateral?.classList.remove('open');
	document.getElementById('overlay')?.classList.remove('open');
	document.body.style.overflow = '';
	document.getElementById('menuToggle')?.setAttribute('aria-expanded', 'false');
	soltarTab(lateral);
	// Al elegir una categoría la página se desplaza hasta ella: el foco vuelve al
	// botón sin mover la pantalla (llevarFocoA y devolverFoco usan preventScroll).
	if (estabaAbierto) devolverFoco();
}
