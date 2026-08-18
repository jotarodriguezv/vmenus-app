// ── TEMA: CARRITO ─────────────────────────────────────────────
// Header fijo + sidebar (igual que temas/sidebar.js) + cuadrícula de platos
// donde tocar una tarjeta la suma al carrito en vez de abrir su ficha.
// Se activa cuando atributos.nav = 'carrito'.
//
// La maquinaria del carrito ya no vive aquí: está en core/carrito.js, para
// que el modelo de video —y cualquier otro— pueda encenderla sin copiarla.

import { restaurante, categorias, productos } from '../core/menu.js';
import { buildNav as buildSidebarNav } from './sidebar.js';
import { trackClic } from '../core/analytics.js';
import { esc, escUrl } from '../core/html.js';
import { activarCarrito, agregarSimple, openCustomModal, tienePersonalizacion } from '../core/carrito.js';

// ── NAV (reutiliza el sidebar + enciende el carrito) ───────────
export function buildNav() {
	buildSidebarNav();
	activarCarrito();
}

// ── MENÚ (grid propio: click = agregar/personalizar, no info) ──
export function buildMenu() {
	const main = document.getElementById('mainContent');
	if (!main) return;
	main.innerHTML = '';

	categorias.forEach(cat => {
		const prods = productos.filter(p => p.categoria_id === cat.id);
		if (!prods.length) return;

		const section = document.createElement('div');
		section.className = 'category-section';
		section.id = 'sec-' + cat.id;
		section.innerHTML = `
		<div class="category-header">
			<div class="category-title">${esc(cat.emoji || '')} ${esc(cat.nombre)}</div>
			<div class="category-line"></div>
		</div>`;

		const grid = document.createElement('div');
		grid.className = 'products-grid';

		prods.forEach(p => {

			const tieneOpciones = tienePersonalizacion(p);

			// Sin imagen asignada: fila compacta, sin caja de foto (como una categoría "sin fotos")
			if (!p.imagen_url) {
				const row = document.createElement('div');
				row.className = 'product-noimg';
				row.innerHTML = `
				<div>
					<div class="card-name">${esc(p.nombre)}</div>
					${tieneOpciones ? '<div class="card-hint">Toca para personalizar</div>' : ''}
				</div>
				<div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
					<div class="card-price">${esc(p.precio)}</div>
					<span class="noimg-add-indicator">+</span>
				</div>`;
				row.onclick = () => {
					trackClic(restaurante?.id, p.id);
					if (tieneOpciones) {
						openCustomModal(p.id);
					} else {
						agregarSimple(p);
						const ind = row.querySelector('.noimg-add-indicator');
						if (ind) {
							ind.textContent = '✓';
							setTimeout(() => { ind.textContent = '+'; }, 800);
						}
					}
				};
				grid.appendChild(row);
				return;
			}

			const card = document.createElement('div');
			card.className = 'product-card has-img';
			card.innerHTML = `
			<div class="card-img-wrap">
				<img class="card-img" src="${escUrl(p.imagen_url)}" alt="${esc(p.nombre)}" loading="lazy" onerror="this.parentNode.innerHTML=window.vmNoImg()">
				<button class="card-add-btn" title="${tieneOpciones ? 'Personalizar' : 'Agregar'}">+</button>
			</div>
			<div class="card-body">
				<div class="card-name">${esc(p.nombre)}</div>
				<div class="card-price">${esc(p.precio)}</div>
				${tieneOpciones ? '<div class="card-hint">Toca para personalizar</div>' : ''}
			</div>`;

			card.onclick = () => {
				trackClic(restaurante?.id, p.id);
				if (tieneOpciones) {
					openCustomModal(p.id);
				} else {
					agregarSimple(p);
					const btn = card.querySelector('.card-add-btn');
					if (btn) {
						btn.textContent = '✓';
						setTimeout(() => { btn.textContent = '+'; }, 800);
					}
				}
			};

			grid.appendChild(card);
		});

		section.appendChild(grid);
		main.appendChild(section);
	});
}
