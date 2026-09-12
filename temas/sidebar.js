// ── TEMA: SIDEBAR ─────────────────────────────────────────────
// Nav lateral que se abre con botón hamburguesa.
// Usado por: Malparados y restaurantes con header fijo.

import { categorias, productos } from '../core/menu.js';

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
}

function openSidebar() {
	document.getElementById('sidebar')?.classList.add('open');
	document.getElementById('overlay')?.classList.add('open');
	document.body.style.overflow = 'hidden';
}

function closeSidebar() {
	document.getElementById('sidebar')?.classList.remove('open');
	document.getElementById('overlay')?.classList.remove('open');
	document.body.style.overflow = '';
}
