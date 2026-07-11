// ── ESTADO GLOBAL ─────────────────────────────────────────────
export let restaurante = null;
export let categorias = [];
export let productos = [];
let currentCategoryProducts = [];
let currentProductIndex = 0;

export function setRestaurante(r) {restaurante = r;}
export function setCategorias(c) {categorias = c;}
export function setProductos(p) {productos = p;}

// ── LOADING ───────────────────────────────────────────────────
export function showLoading(show, targetId = 'mainContent') {
	let el = document.getElementById('loadingMsg');
	if (show && !el) {
		el = document.createElement('div');
		el.id = 'loadingMsg';
		el.style.cssText = 'text-align:center;padding:60px 20px;color:var(--text-muted);font-size:14px;letter-spacing:2px';
		el.textContent = 'Cargando menú...';
		document.getElementById(targetId)?.appendChild(el);
	} else if (!show && el) {
		el.remove();
	}
}

// ── PLACEHOLDER SIN IMAGEN ────────────────────────────────────
export function noImgHtml() {
	return `<div class="no-img-placeholder">
		<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1">
			<rect x="3" y="3" width="18" height="18" rx="2"/>
			<circle cx="8.5" cy="8.5" r="1.5"/>
			<polyline points="21,15 16,10 5,21"/>
		</svg>
	</div>`;
}

// ── CONSTRUIR MENÚ ────────────────────────────────────────────
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
			<div class="category-title">${cat.emoji || ''} ${cat.nombre}</div>
			<div class="category-line"></div>
		</div>
		`;

		if (cat.sin_fotos) {
			// ── VISTA LISTA (sin fotos) ──
			const list = document.createElement('div');
			list.className = 'products-list';
			prods.forEach(p => {
				const item = document.createElement('div');
				item.className = 'list-item';
				item.onclick = () => openModal(cat.id, prods.indexOf(p));
				item.innerHTML = `
				<span class="list-name">
					${p.nombre}
					${p.descripcion_avanzada
				? `<span class="list-desc-avanzada">${p.descripcion_avanzada}</span>`
					: ''}
				</span>
				<span class="list-price">${p.precio}</span>
				`;
				list.appendChild(item);
			});
			section.appendChild(list);
		} else {
			// ── VISTA GRID (con fotos) ──
			const grid = document.createElement('div');
			grid.className = 'products-grid';
			prods.forEach((p, idx) => {
				// Sin imagen asignada: fila compacta, sin caja de foto (como una categoría "sin fotos")
				if (!p.imagen_url) {
					const row = document.createElement('div');
					row.className = 'product-noimg';
					row.onclick = () => openModal(cat.id, idx);
					row.innerHTML = `
					<div class="card-name">${p.nombre}</div>
					<div class="card-price">${p.precio}</div>
					`;
					grid.appendChild(row);
					return;
				}
				const card = document.createElement('div');
				card.className = 'product-card has-img';
				card.onclick = () => openModal(cat.id, idx);
				card.innerHTML = `
				<div class="card-img-wrap">
					<img class="card-img" src="${p.imagen_url}" alt="${p.nombre}" loading="lazy"
						onerror="this.parentNode.innerHTML=window.vmNoImg()">
				</div>
				<div class="card-body">
				<div class="card-name">${p.nombre}</div>
				<div class="card-price">${p.precio}</div>
					</div>
					`;
					grid.appendChild(card);
				});
				section.appendChild(grid);
			}
			main.appendChild(section);
		});
	}

	// ── MODAL ─────────────────────────────────────────────────────
	export function openModal(catId, idx) {
		currentCategoryProducts = productos.filter(p => p.categoria_id === catId);
		currentProductIndex = idx;
		renderModal();
		document.getElementById('modalOverlay')?.classList.add('open');
		document.body.style.overflow = 'hidden';
	}

	export function renderModal() {
		const p = currentCategoryProducts[currentProductIndex];
		const wrap = document.getElementById('modalImgWrap');
		if (!wrap) return;

		// Construir array de imágenes: principal + adicionales (carrusel opcional)
		const imgs = [];
		if (p.imagen_url) imgs.push(p.imagen_url);
			(p.atributos?.imagenes || []).forEach(u => {
			if (u && !imgs.includes(u)) imgs.push(u);
		});

		// Limpiar contenido previo (mantener botones)
		wrap.querySelectorAll('.modal-carousel, .modal-img, .no-img-placeholder, .modal-no-img')
		.forEach(el => el.remove());

		if (imgs.length === 0) {
			// Sin imagen
			wrap.insertAdjacentHTML('afterbegin', `<div class="modal-no-img">${noImgHtml()}</div>`);

		} else if (imgs.length === 1) {
			// Imagen simple
			const img = document.createElement('img');
			img.className = 'modal-img';
			img.src = imgs[0];
			img.alt = p.nombre;
			img.onclick = () => openLightbox(imgs[0]);
			img.onerror = () => {
				img.remove();
				wrap.insertAdjacentHTML('afterbegin', `<div class="modal-no-img">${noImgHtml()}</div>`);
			};
			wrap.insertAdjacentElement('afterbegin', img);

		} else {
			// Carrusel (múltiples imágenes)
			let currentSlide = 0;
			const carousel  = document.createElement('div');
			carousel.className = 'modal-carousel';
			const track = document.createElement('div');
			track.className = 'carousel-track';

			imgs.forEach(url => {
				const slide = document.createElement('div');
				slide.className = 'carousel-slide';
				const img = document.createElement('img');
				img.src = url;
				img.alt = p.nombre;
				img.onclick = () => openLightbox(url);
				slide.appendChild(img);
				track.appendChild(slide);
			});

			const dotsWrap = document.createElement('div');
			dotsWrap.className = 'carousel-dots';
			const dots = imgs.map((_, i) => {
				const dot = document.createElement('div');
				dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
				dot.onclick = () => goToSlide(i);
				dotsWrap.appendChild(dot);
				return dot;
			});

			function goToSlide(idx) {
				currentSlide = idx;
				track.style.transform = `translateX(-${idx * 100}%)`;
				dots.forEach((d, i) => d.classList.toggle('active', i === idx));
			}

			// Swipe independiente del swipe de navegación entre productos
			let startX = 0;
			carousel.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
			carousel.addEventListener('touchend', e => {
				const diff = startX - e.changedTouches[0].clientX;
				if (Math.abs(diff) > 40) {
					if (diff > 0 && currentSlide < imgs.length - 1) goToSlide(currentSlide + 1);
					if (diff < 0 && currentSlide > 0)               goToSlide(currentSlide - 1);
				}
				e.stopPropagation();
			});

			carousel.appendChild(track);
			carousel.appendChild(dotsWrap);
			wrap.insertAdjacentElement('afterbegin', carousel);
		}

		// Datos del producto
		document.getElementById('modalName').textContent = p.nombre;
		document.getElementById('modalPrice').textContent = p.precio;
		document.getElementById('modalDesc').textContent = p.descripcion || '';

		const da = document.getElementById('modalDescAvanzada');
		if (da) {
			da.textContent   = p.descripcion_avanzada || '';
			da.style.display = p.descripcion_avanzada ? 'block' : 'none';
		}

		const total = currentCategoryProducts.length;
		const counter = document.getElementById('modalCounter');
		if (counter) counter.textContent = `${currentProductIndex + 1} / ${total}`;

		const prev = document.getElementById('modalPrev');
		const next = document.getElementById('modalNext');
		if (prev) prev.style.visibility = currentProductIndex === 0 ? 'hidden' : 'visible';
		if (next) next.style.visibility = currentProductIndex === total - 1 ? 'hidden' : 'visible';
	}

	export function navigateModal(dir) {
		const next = currentProductIndex + dir;
		if (next >= 0 && next < currentCategoryProducts.length) {
			currentProductIndex = next;
			renderModal();
		}
	}

	export function closeModal() {
		document.getElementById('modalOverlay')?.classList.remove('open');
		document.body.style.overflow = '';
	}

	export function handleOverlayClick(e) {
		if (e.target.id === 'modalOverlay') closeModal();
	}

	// ── LIGHTBOX ──────────────────────────────────────────────────
		export function openLightbox(src) {
		const img = document.getElementById('lightboxImg');
		if (img) img.src = src;
		document.getElementById('lightbox')?.classList.add('open');
	}

	export function closeLightbox() {
		document.getElementById('lightbox')?.classList.remove('open');
	}

	// ── PROMO ─────────────────────────────────────────────────────
	export function openPromo() {
		if (!restaurante?.promo_imagen_url) return;
		const img = document.querySelector('.promo-img');
		if (img) img.src = restaurante.promo_imagen_url;
		document.getElementById('promoOverlay')?.classList.add('open');
		document.body.style.overflow = 'hidden';
	}

	export function closePromo() {
		document.getElementById('promoOverlay')?.classList.remove('open');
		document.body.style.overflow = '';
	}

	// ── BARRA SOCIAL (opcional) ───────────────────────────────────
	export function buildSocialBar() {
	const at = restaurante?.atributos || {};
	if (!at.social_bar) return;

	const links = [];
	if (at.social_instagram) links.push({
		href: at.social_instagram,
		label: 'Instagram',
		icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
			<rect x="2" y="2" width="20" height="20" rx="5"/>
			<circle cx="12" cy="12" r="5"/>
			<circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
		</svg>`
	});
	if (at.social_tiktok) links.push({
		href: at.social_tiktok,
		label: 'TikTok',
		icon: `<svg viewBox="0 0 24 24" fill="currentColor">
			<path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V9.05a8.16 8.16 0 0 0 4.77 1.52V7.14a4.85 4.85 0 0 1-1-.45z"/>
		</svg>`
	});
	if (at.social_whatsapp) links.push({
		href: `https://wa.me/${at.social_whatsapp}`,
		label: 'WhatsApp',
		icon: `<svg viewBox="0 0 24 24" fill="currentColor">
			<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
		</svg>`
	});

	if (!links.length) return;

	const bar = document.createElement('div');
	bar.className = 'social-bar';
	bar.id = 'socialBar';
	bar.innerHTML = links.map(l => `
    <a class="social-btn" href="${l.href}" target="_blank" rel="noopener">
		${l.icon}
		<span>${l.label}</span>
    </a>
	`).join('');
	document.body.appendChild(bar);
}

// ── SCROLL TOP ────────────────────────────────────────────────
export function initScrollTop() {
	const btn = document.getElementById('scrollTop');
	if (!btn) return;
	window.addEventListener('scroll', () => {
		btn.classList.toggle('visible', window.scrollY > 300);
	}, { passive: true });
	btn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── TECLADO Y SWIPE GLOBAL ────────────────────────────────────
export function initGlobalEvents() {
	document.addEventListener('keydown', e => {
		if (e.key === 'Escape') { closeModal(); closeLightbox(); closePromo(); }
		if (document.getElementById('modalOverlay')?.classList.contains('open')) {
			if (e.key === 'ArrowRight') navigateModal(1);
			if (e.key === 'ArrowLeft')  navigateModal(-1);
		}
	});

	let touchStartX = 0;
	document.getElementById('modalSheet')?.addEventListener('touchstart', e => {
		touchStartX = e.touches[0].clientX;
	}, { passive: true });
	document.getElementById('modalSheet')?.addEventListener('touchend', e => {
		const diff = touchStartX - e.changedTouches[0].clientX;
		if (Math.abs(diff) > 50) navigateModal(diff > 0 ? 1 : -1);
	});
}
