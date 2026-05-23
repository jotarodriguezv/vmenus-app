// ── TEMA: TOPNAV ─────────────────────────────────────────────
// Nav horizontal sticky con scroll spy.
// Usado por: Bonzas y restaurantes con header hero.

import { categorias, productos } from '../core/menu.js';

export function buildNav() {
	const nav = document.getElementById('navScroll');
	if (!nav) return;
	nav.innerHTML = '';
	let firstBtn = true;

	categorias.forEach(cat => {
		const tieneProductos = productos.some(p => p.categoria_id === cat.id);
		if (!tieneProductos) return;
	
		const btn = document.createElement('button');
		btn.className = 'nav-btn' + (firstBtn ? ' active' : '');
		btn.textContent = `${cat.emoji || ''} ${cat.nombre}`.trim();
		btn.dataset.cat = cat.id;
		btn.onclick = () => {
			document.getElementById('sec-' + cat.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		};
		nav.appendChild(btn);
		firstBtn = false;
	});

	initScrollSpy();
}

function initScrollSpy() {
	const observer = new IntersectionObserver(entries => {
		entries.forEach(entry => {
			if (entry.isIntersecting) {
				const catId = entry.target.id.replace('sec-', '');
				document.querySelectorAll('.nav-btn').forEach(btn => {
					btn.classList.toggle('active', btn.dataset.cat === catId);
				});
				const activeBtn = document.querySelector(`.nav-btn[data-cat="${catId}"]`);
				activeBtn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
			}
		});
	}, { rootMargin: '-40% 0px -55% 0px' });

	document.querySelectorAll('.category-section').forEach(sec => observer.observe(sec));
}
