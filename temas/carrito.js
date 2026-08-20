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
import { montarChips, ocultarNoCoinciden } from '../core/filtros.js';

// ── NAV (reutiliza el sidebar + enciende el carrito) ───────────
// Aquí el carrito se enciende SIN preguntar, y es a propósito. En el modelo
// de video es un interruptor —planDe().carrito más atributos.carrito— porque
// allí es opcional: quitarlo deja una carta perfectamente buena.
//
// En este no. Toda la interacción de este modelo es el carrito: tocar una
// tarjeta suma el plato al pedido, no abre su ficha, porque no hay ficha.
// Apagárselo no daría una carta sin pedidos, daría una carta donde tocar un
// plato no hace nada.
//
// Tampoco se consulta el plan, por la misma razón por la que el panel avisa
// pero no impide usar un modelo fuera de plan: bajar de plan no le rompe la
// carta a un restaurante que está vendiendo. El cambio lo hace una persona a
// sabiendas, eligiendo otro modelo.
//
// Si alguien viene a "arreglar" esta diferencia, que sepa que apagaría
// carritos en producción.
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
				row.dataset.plato = p.id;
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
			card.dataset.plato = p.id;
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

	montarChips(() => ocultarNoCoinciden('.product-card, .product-noimg'));
}
