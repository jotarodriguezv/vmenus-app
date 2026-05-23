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
