// ── TEMA: EXPLORAR ────────────────────────────────────────────
// Modelo "editorial" inspirado en menús tipo revista:
//   - Portada a pantalla completa con nombre superpuesto
//   - Controles flotantes arriba: toggle lista/cuadrícula + búsqueda + filtros
//   - Cabecera de categoría con imagen (banner)
//   - Barra de categorías flotante abajo con scroll-sync
//   - Filtros dietéticos/nutricionales (los que el restaurante activó)
//   - Badges por producto (popular / chef / nuevo)
//   - Modal inferior con detalle del plato
//
// Es autónomo: construye todo su DOM (no reutiliza los bloques de los
// otros temas). loader.js lo invoca con buildNav() + buildMenu().

import { restaurante, categorias, productos } from '../core/menu.js';
import { trackClic } from '../core/analytics.js';

// ── ESTADO DEL TEMA ───────────────────────────────────────────
let viewMode = 'list';        // 'list' | 'grid'
let searchTerm = '';
let searchOpen = false;
const activeFilters = new Set(); // ids de filtros activos
let scrollSyncBound = false;

// Badges destacados (mismos ids que guarda el panel admin).
const BADGES = {
	popular: { label: 'Más popular', emoji: '⭐' },
	chef:    { label: 'Recomendación del chef', emoji: '👨‍🍳' },
	nuevo:   { label: 'Nuevo', emoji: '✨' },
};

// Mapa id→{label,emoji} de los filtros que el restaurante activó.
function filtrosMap() {
	const map = {};
	(restaurante?.atributos?.filtros_disponibles || []).forEach(f => { map[f.id] = f; });
	return map;
}

// Filtros que realmente aparecen en al menos un producto disponible.
function filtrosEnUso() {
	const map = filtrosMap();
	const usados = new Set();
	productos.forEach(p => (p.atributos?.filtros || []).forEach(id => { if (map[id]) usados.add(id); }));
	return [...usados].map(id => map[id]);
}

// ── SVG ICONS (inline, sin librerías) ─────────────────────────
const IC = {
	list: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><rect x="3" y="5" width="8" height="14" rx="1.5" fill="currentColor"/><line x1="14" y1="8" x2="21" y2="8"/><line x1="14" y1="12" x2="21" y2="12"/><line x1="14" y1="16" x2="19" y2="16"/></svg>',
	grid: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><rect x="4" y="4" width="16" height="9" rx="2"/><line x1="4" y1="17" x2="20" y2="17"/><line x1="4" y1="20" x2="14" y2="20"/></svg>',
	search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
	filter: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 5H3"/><path d="M12 19H3"/><path d="M14 3v4"/><path d="M16 17v4"/><path d="M21 12h-9"/><path d="M21 19h-5"/><path d="M21 5h-7"/><path d="M8 10v4"/><path d="M8 12H3"/></svg>',
	close: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
};

function esc(s) {
	return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ══════════════════════════════════════════════════════════════
// BUILD NAV — controles flotantes, portada y barra inferior
// ══════════════════════════════════════════════════════════════
export function buildNav() {
	document.body.classList.add('tema-explorar');

	const hayFiltros = filtrosEnUso().length > 0;

	// ── Controles superiores (fijos) ──
	const top = document.createElement('div');
	top.className = 'exp-top';
	top.innerHTML = `
		<div class="exp-top-left">
			<div class="exp-viewtoggle">
				<button class="exp-viewbtn active" data-view="list" aria-label="Vista lista">${IC.list}</button>
				<button class="exp-viewbtn" data-view="grid" aria-label="Vista cuadrícula">${IC.grid}</button>
			</div>
		</div>
		<div class="exp-top-right">
			<button class="exp-iconbtn" id="expSearchToggle" aria-label="Buscar">${IC.search}</button>
			${hayFiltros ? `<button class="exp-iconbtn" id="expFilterToggle" aria-label="Filtros">${IC.filter}</button>` : ''}
		</div>`;
	document.body.appendChild(top);

	// ── Barra de búsqueda desplegable (fija) ──
	const searchBar = document.createElement('div');
	searchBar.className = 'exp-searchbar';
	searchBar.id = 'expSearchBar';
	searchBar.innerHTML = `
		<div class="exp-search-wrap">
			${IC.search}
			<input type="text" id="expSearchInput" placeholder="Buscar platos…" autocomplete="off">
			<button class="exp-search-clear" id="expSearchClear" aria-label="Limpiar">${IC.close}</button>
		</div>`;
	document.body.appendChild(searchBar);

	// ── Panel de filtros (fijo, oculto por defecto) ──
	if (hayFiltros) {
		const panel = document.createElement('div');
		panel.className = 'exp-filterpanel';
		panel.id = 'expFilterPanel';
		const chips = filtrosEnUso().map(f =>
			`<button class="exp-filter-chip" data-filter="${esc(f.id)}"><span>${esc(f.emoji || '')}</span><span>${esc(f.label)}</span></button>`
		).join('');
		panel.innerHTML = `<div class="exp-filter-row">${chips}</div>`;
		document.body.appendChild(panel);
	}

	// ── Barra de categorías inferior (fija) ──
	const catNavWrap = document.createElement('div');
	catNavWrap.className = 'exp-catnav-wrap';
	catNavWrap.innerHTML = `<nav class="exp-catnav" id="expCatNav"></nav>`;
	document.body.appendChild(catNavWrap);

	// ── Modal de detalle (fijo) ──
	const modalBg = document.createElement('div');
	modalBg.className = 'exp-modal-bg';
	modalBg.id = 'expModalBg';
	document.body.appendChild(modalBg);
	const modal = document.createElement('div');
	modal.className = 'exp-modal';
	modal.id = 'expModal';
	modal.innerHTML = `<div class="exp-modal-handle"></div><div id="expModalContent"></div>`;
	document.body.appendChild(modal);

	// ── Eventos ──
	top.querySelectorAll('.exp-viewbtn').forEach(btn => {
		btn.onclick = () => setView(btn.dataset.view);
	});
	document.getElementById('expSearchToggle').onclick = toggleSearch;
	const searchInput = document.getElementById('expSearchInput');
	searchInput.oninput = () => { searchTerm = searchInput.value; renderDishes(); };
	document.getElementById('expSearchClear').onclick = () => { searchInput.value = ''; searchTerm = ''; searchInput.focus(); renderDishes(); };
	if (hayFiltros) document.getElementById('expFilterToggle').onclick = toggleFilterPanel;

	modalBg.onclick = closeExpModal;
	modal.addEventListener('touchstart', onModalTouchStart, { passive: true });
	modal.addEventListener('touchmove', onModalTouchMove, { passive: true });

	buildCatNav();
}

// ══════════════════════════════════════════════════════════════
// BUILD MENU — portada + secciones de categoría
// ══════════════════════════════════════════════════════════════
export function buildMenu() {
	const main = document.getElementById('mainContent');
	if (!main) return;
	main.classList.add('exp-main');
	main.innerHTML = '';

	// Portada
	const at = restaurante.atributos || {};
	const cover = document.createElement('div');
	// La portada es OPCIONAL y usa su propia imagen (portada_url), distinta
	// de la imagen de fondo del sitio. Solo se muestra grande si está
	// activada Y tiene imagen; si no, portada compacta (solo el nombre).
	const portadaOn = !!(at.portada_activa && at.portada_url);
	cover.className = 'exp-cover' + (portadaOn ? '' : ' exp-cover-compact');
	const bg = portadaOn
		? `<img class="exp-cover-img" src="${esc(at.portada_url)}" alt="" onerror="this.style.display='none'">`
		: '';
	const logo = restaurante.logo_url
		? `<div class="exp-cover-logo"><img src="${esc(restaurante.logo_url)}" alt="" onerror="this.parentNode.style.display='none'"></div>`
		: '';
	const sub = at.subtitulo ? `<p class="exp-cover-subtitle">${esc(at.subtitulo)}</p>` : '';
	cover.innerHTML = `
		${bg}
		<div class="exp-cover-overlay"></div>
		<div class="exp-cover-content">
			${logo}
			<h1 class="exp-cover-title">${esc(restaurante.nombre)}</h1>
			${sub}
		</div>`;
	main.appendChild(cover);

	// Contenedor de platos
	const content = document.createElement('div');
	content.className = 'exp-content';
	content.innerHTML = `<div id="expDishes"></div><div class="exp-footer" id="expFooter"></div>`;
	main.appendChild(content);

	renderDishes();
	renderFooter();

	if (!scrollSyncBound) {
		window.addEventListener('scroll', syncCatNavOnScroll, { passive: true });
		scrollSyncBound = true;
	}
}

// ── BARRA DE CATEGORÍAS INFERIOR ──────────────────────────────
function buildCatNav() {
	const nav = document.getElementById('expCatNav');
	if (!nav) return;
	nav.innerHTML = '';
	const conProductos = categorias.filter(c => productos.some(p => p.categoria_id === c.id));
	conProductos.forEach((cat, i) => {
		const btn = document.createElement('button');
		btn.className = 'exp-catnav-btn' + (i === 0 ? ' active' : '');
		btn.dataset.cat = cat.id;
		btn.textContent = `${cat.emoji || ''} ${cat.nombre}`.trim();
		btn.onclick = () => {
			document.querySelectorAll('.exp-catnav-btn').forEach(b => b.classList.remove('active'));
			btn.classList.add('active');
			btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
			const el = document.getElementById('exp-sec-' + cat.id);
			if (el) {
				const y = el.getBoundingClientRect().top + window.scrollY - 8;
				window.scrollTo({ top: y, behavior: 'smooth' });
			}
		};
		nav.appendChild(btn);
	});
}

// ── RENDER DE PLATOS (aplica búsqueda + filtros) ──────────────
function renderDishes() {
	const cont = document.getElementById('expDishes');
	if (!cont) return;
	cont.innerHTML = '';

	const term = searchTerm.toLowerCase().trim();
	const map = filtrosMap();

	const pasa = (p) => {
		if (term) {
			const hay = (p.nombre || '').toLowerCase().includes(term) ||
				(p.descripcion || '').toLowerCase().includes(term);
			if (!hay) return false;
		}
		if (activeFilters.size) {
			const pf = new Set(p.atributos?.filtros || []);
			for (const f of activeFilters) if (!pf.has(f)) return false; // AND
		}
		return true;
	};

	const visibles = productos.filter(pasa);

	if (!visibles.length) {
		cont.innerHTML = `
			<div class="exp-empty">
				<div class="exp-empty-icon">🔍</div>
				<p>Sin resultados${term ? ` para "<strong>${esc(searchTerm)}</strong>"` : ''}</p>
			</div>`;
		return;
	}

	categorias.forEach(cat => {
		const prods = visibles.filter(p => p.categoria_id === cat.id);
		if (!prods.length) return;

		const section = document.createElement('div');
		section.className = 'exp-section';
		section.id = 'exp-sec-' + cat.id;

		// Cabecera de categoría (banner con imagen o degradado)
		const imgCab = cat.atributos?.imagen_cabecera;
		const header = document.createElement('div');
		header.className = 'exp-cat-header';
		header.innerHTML = `
			${imgCab ? `<img class="exp-cat-header-img" src="${esc(imgCab)}" alt="" onerror="this.style.display='none'">` : `<div class="exp-cat-header-ph"></div>`}
			<div class="exp-cat-header-overlay"></div>
			<div class="exp-cat-header-label"><span>${esc((cat.emoji ? cat.emoji + ' ' : '') + cat.nombre)}</span></div>`;
		section.appendChild(header);

		const wrap = document.createElement('div');
		wrap.className = viewMode === 'list' ? 'exp-list' : 'exp-grid';
		prods.forEach(p => wrap.appendChild(viewMode === 'list' ? itemLista(p, cat, map) : itemCard(p, cat, map)));
		section.appendChild(wrap);

		cont.appendChild(section);
	});
}

// Chips pequeños de filtros de un producto (para vista lista).
function chipsFiltrosProducto(p, map) {
	const ids = (p.atributos?.filtros || []).filter(id => map[id]);
	if (!ids.length) return '';
	return `<div class="exp-item-filters">` +
		ids.map(id => `<span class="exp-fchip" title="${esc(map[id].label)}">${esc(map[id].emoji || '')} ${esc(map[id].label)}</span>`).join('') +
		`</div>`;
}

// Badges de un producto.
function badgesHtml(p) {
	const out = [];
	Object.keys(BADGES).forEach(k => {
		if (p.atributos?.[k]) out.push(`<span class="exp-badge exp-badge-${k}">${BADGES[k].emoji} ${esc(BADGES[k].label)}</span>`);
	});
	return out.join('');
}

function itemLista(p, cat, map) {
	const div = document.createElement('div');
	div.className = 'exp-item' + (!p.disponible ? ' exp-unavail' : '');
	const sinFoto = cat.sin_fotos;
	let thumb = '';
	if (!sinFoto) {
		thumb = p.imagen_url
			? `<div class="exp-thumb"><img src="${esc(p.imagen_url)}" alt="" loading="lazy" onerror="this.parentNode.innerHTML='<div class=\\'exp-thumb-ph\\'>${cat.emoji || '🍽'}</div>'"></div>`
			: `<div class="exp-thumb"><div class="exp-thumb-ph">${cat.emoji || '🍽'}</div></div>`;
	}
	div.innerHTML = `
		${thumb}
		<div class="exp-item-info">
			<div class="exp-item-row">
				<span class="exp-item-name">${esc(p.nombre)}</span>
				<span class="exp-item-price">${esc(p.precio)}</span>
			</div>
			${badgesHtml(p) ? `<div class="exp-badges">${badgesHtml(p)}</div>` : ''}
			${p.descripcion ? `<p class="exp-item-desc">${esc(p.descripcion)}</p>` : ''}
			${chipsFiltrosProducto(p, map)}
		</div>`;
	div.onclick = () => openExpModal(p, cat, map);
	return div;
}

function itemCard(p, cat, map) {
	const div = document.createElement('div');
	div.className = 'exp-card' + (!p.disponible ? ' exp-unavail' : '');
	const sinFoto = cat.sin_fotos;
	let img = '';
	if (!sinFoto) {
		img = p.imagen_url
			? `<img class="exp-card-img" src="${esc(p.imagen_url)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=\\'exp-card-ph\\'>${cat.emoji || '🍽'}</div>'">`
			: `<div class="exp-card-ph">${cat.emoji || '🍽'}</div>`;
	}
	// Un solo badge arriba (prioridad popular > chef > nuevo)
	let topBadge = '';
	for (const k of ['popular', 'chef', 'nuevo']) {
		if (p.atributos?.[k]) { topBadge = `<span class="exp-card-badge exp-badge-${k}">${BADGES[k].emoji}</span>`; break; }
	}
	div.innerHTML = `
		<div class="exp-card-imgwrap">${img}${topBadge}</div>
		<div class="exp-card-body">
			<div class="exp-card-name">${esc(p.nombre)}</div>
			${p.descripcion ? `<div class="exp-card-desc">${esc(p.descripcion)}</div>` : ''}
			<div class="exp-card-price">${esc(p.precio)}</div>
		</div>`;
	div.onclick = () => openExpModal(p, cat, map);
	return div;
}

// ── FOOTER con guía de filtros ────────────────────────────────
function renderFooter() {
	const foot = document.getElementById('expFooter');
	if (!foot) return;
	const enUso = filtrosEnUso();
	let guia = '';
	if (enUso.length) {
		guia = `<div class="exp-guide">
			<div class="exp-guide-title">Guía de filtros</div>
			<div class="exp-guide-grid">` +
			enUso.map(f => `<span class="exp-guide-item">${esc(f.emoji || '')} ${esc(f.label)}</span>`).join('') +
			`</div></div>`;
	}
	foot.innerHTML = `${guia}<div class="exp-footer-note">© ${new Date().getFullYear()} ${esc(restaurante.nombre)}</div>`;
}

// ── MODAL DE DETALLE ──────────────────────────────────────────
function openExpModal(p, cat, map) {
	trackClic(restaurante?.id, p.id);
	const cont = document.getElementById('expModalContent');
	const sinFoto = cat.sin_fotos;
	let img = '';
	if (!sinFoto) {
		img = p.imagen_url
			? `<img class="exp-modal-img" src="${esc(p.imagen_url)}" alt="" onerror="this.outerHTML='<div class=\\'exp-modal-ph\\'>${cat.emoji || '🍽'}</div>'">`
			: `<div class="exp-modal-ph">${cat.emoji || '🍽'}</div>`;
	}
	const ids = (p.atributos?.filtros || []).filter(id => map[id]);
	const filtrosBloque = ids.length
		? `<div class="exp-modal-filters">` + ids.map(id => `<span class="exp-fchip">${esc(map[id].emoji || '')} ${esc(map[id].label)}</span>`).join('') + `</div>`
		: '';
	cont.innerHTML = `
		${img}
		<div class="exp-modal-body">
			${badgesHtml(p) ? `<div class="exp-badges">${badgesHtml(p)}</div>` : ''}
			<div class="exp-modal-title">${esc(p.nombre)}</div>
			<div class="exp-modal-price">${esc(p.precio)}</div>
			${p.descripcion ? `<p class="exp-modal-desc">${esc(p.descripcion)}</p>` : ''}
			${p.descripcion_avanzada ? `<p class="exp-modal-desc-adv">${esc(p.descripcion_avanzada)}</p>` : ''}
			${filtrosBloque}
		</div>`;
	document.getElementById('expModalBg').classList.add('open');
	document.getElementById('expModal').classList.add('open');
	document.body.style.overflow = 'hidden';
}

function closeExpModal() {
	document.getElementById('expModalBg')?.classList.remove('open');
	document.getElementById('expModal')?.classList.remove('open');
	document.body.style.overflow = '';
}

let touchStartY = 0;
function onModalTouchStart(e) { touchStartY = e.touches[0].clientY; }
function onModalTouchMove(e) { if (e.touches[0].clientY - touchStartY > 60) closeExpModal(); }

// ── CONTROLES: VISTA / BÚSQUEDA / FILTROS ─────────────────────
function setView(mode) {
	viewMode = mode;
	document.querySelectorAll('.exp-viewbtn').forEach(b => b.classList.toggle('active', b.dataset.view === mode));
	renderDishes();
}

function toggleSearch() {
	searchOpen = !searchOpen;
	document.getElementById('expSearchBar').classList.toggle('open', searchOpen);
	document.getElementById('expSearchToggle').classList.toggle('active', searchOpen);
	if (searchOpen) {
		// cerrar panel de filtros si estaba abierto
		document.getElementById('expFilterPanel')?.classList.remove('open');
		document.getElementById('expFilterToggle')?.classList.remove('active');
		setTimeout(() => document.getElementById('expSearchInput').focus(), 80);
	} else {
		document.getElementById('expSearchInput').value = ''; searchTerm = ''; renderDishes();
	}
}

function toggleFilterPanel() {
	const panel = document.getElementById('expFilterPanel');
	const open = panel.classList.toggle('open');
	document.getElementById('expFilterToggle').classList.toggle('active', open);
	if (open) {
		// cerrar búsqueda si estaba abierta
		searchOpen = false;
		document.getElementById('expSearchBar')?.classList.remove('open');
		document.getElementById('expSearchToggle')?.classList.remove('active');
	}
	// Enlazar clics de los chips (una vez)
	if (!panel.dataset.bound) {
		panel.querySelectorAll('.exp-filter-chip').forEach(chip => {
			chip.onclick = () => {
				const id = chip.dataset.filter;
				if (activeFilters.has(id)) activeFilters.delete(id); else activeFilters.add(id);
				chip.classList.toggle('active');
				renderDishes();
			};
		});
		panel.dataset.bound = '1';
	}
}

// ── SCROLL-SYNC de la barra inferior ──────────────────────────
function syncCatNavOnScroll() {
	if (!document.body.classList.contains('tema-explorar')) return;
	const secs = document.querySelectorAll('.exp-section');
	let current = null;
	secs.forEach(s => { if (s.getBoundingClientRect().top < window.innerHeight * 0.4) current = s.id.replace('exp-sec-', ''); });
	if (!current) return;
	document.querySelectorAll('.exp-catnav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.cat === current));
}
