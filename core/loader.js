// ── LOADER PRINCIPAL ──────────────────────────────────────────
// Orquesta el arranque completo del menú.
// 1. Lee el slug de la URL
// 2. Carga config del restaurante desde Supabase
// 3. Aplica estilos dinámicos (colores, fuente, fondo)
// 4. Carga el tema de nav correcto
// 5. Renderiza el menú
// 6. Activa features opcionales

import { sbFetch } from './supabase.js';
import {
	setRestaurante, setCategorias, setProductos,
	showLoading, buildMenu,
	buildSocialBar, initScrollTop, initGlobalEvents,
	openPromo, closePromo, closeLightbox, closeModal
} from './menu.js';

// ── 1. SLUG DESDE LA URL ──────────────────────────────────────
// vmenus.click/bonzas       → 'bonzas'
// vmenus.click/malparados   → 'malparados'
const slug = window.location.pathname.split('/').filter(Boolean)[0];

async function init() {
	if (!slug) {
		// Raíz del dominio sin slug → landing o mensaje
		showRootPage();
		return;
	}

	try {
		showLoading(true);

		// ── 2. DATOS DEL RESTAURANTE ─────────────────────────────
		const restData = await sbFetch('restaurantes', `slug=eq.${slug}&select=*`);
		if (!restData.length) throw new Error('Restaurante no encontrado');

		const restaurante = restData[0];
		setRestaurante(restaurante);

		// Restaurante inactivo (suspendido por impago, etc.)
		if (restaurante.activo === false) {
			showLoading(false);
			showInactivo();
			return;
		}

		// ── 3. ESTILOS DINÁMICOS ──────────────────────────────────
		applyStyles(restaurante);

		// ── 4. DATOS DE MENÚ ──────────────────────────────────────
		const [cats, prods] = await Promise.all([
			sbFetch('categorias', `restaurante_id=eq.${restaurante.id}&select=*&order=orden.asc`),
			sbFetch('productos', `restaurante_id=eq.${restaurante.id}&disponible=eq.true&select=*&order=precio_numerico.asc`)
		]);
		setCategorias(cats);
		setProductos(prods);

		showLoading(false);

		// ── 5. TEMA DE NAV ────────────────────────────────────────
		const tema = restaurante.atributos?.nav || 'topnav'; // 'topnav' | 'sidebar' | 'carrito'
		// Mostrar/ocultar bloques HTML según el tema
		window.activarTema?.(tema, restaurante);
		const temaModule = await import(`../temas/${tema}.js`);
		temaModule.buildNav();

		// ── 6. MENÚ ───────────────────────────────────────────────
		// El tema carrito tiene su propio render (agregar/personalizar en vez de modal de info)
		if (tema === 'carrito') temaModule.buildMenu();
		else buildMenu();

		// Scroll spy solo para topnav, después de que el DOM esté listo
		if (tema === 'topnav' && temaModule.initScrollSpy) {
  			requestAnimationFrame(() => temaModule.initScrollSpy());
		}

		// ── 7. FEATURES OPCIONALES ────────────────────────────────
		buildSocialBar();    // solo si atributos.social_bar = true
		initScrollTop();
		initGlobalEvents();

		// ── 8. PROMO ─────────────────────────────────────────────
		if (restaurante.promo_activa && restaurante.promo_imagen_url) {
			setTimeout(() => openPromo(), 700);
		}

		// ── 9. TÍTULO DE LA PÁGINA ────────────────────────────────
		document.title = `${restaurante.nombre} — Menú Digital`;

		// Favicon dinámico por restaurante
		if (restaurante.logo_url) {
		  	const link = document.createElement('link');
		  	link.rel  = 'icon';
		  	link.type = 'image/png';
			link.href = restaurante.logo_url;
 		 	document.head.appendChild(link);
		}

	} catch (err) {
		console.error('Error cargando menú:', err);
		showLoading(false);
		document.getElementById('mainContent').innerHTML = `
		<p style="text-align:center;padding:40px;color:var(--text-muted)">
			No se pudo cargar el menú. Intenta de nuevo.
		</p>`;
	}
}

// ── APLICAR ESTILOS DINÁMICOS ─────────────────────────────────
function applyStyles(r) {
	const at  = r.atributos || {};
	const css = document.documentElement.style;

	// Colores
	css.setProperty('--primary', r.color_primario   || '#cdfefe');
	css.setProperty('--secondary', r.color_secundario || '#a374af');
	css.setProperty('--accent', r.color_primario   || '#cdfefe');
	css.setProperty('--accent2', r.color_secundario || '#a374af');
	// RGB del primario, para poder usarlo en rgba() en el fondo sin depender
	// de color-mix() (compatibilidad de navegador más amplia)
	css.setProperty('--primary-rgb', hexToRgb(r.color_primario || '#cdfefe'));
	// Paleta de superficie (por defecto: valores de Bonzas)
	// Malparados los sobreescribe desde atributos
	css.setProperty('--dark', at.color_dark || '#0a0a0f');
	css.setProperty('--surface', at.color_surface || '#12111a');
	css.setProperty('--card', at.color_card || '#1a1825');
	css.setProperty('--card-hover', at.color_card_hover || '#221f30');
	css.setProperty('--border', at.color_border || '#2a2640');

	// Fuentes (Google Fonts cargadas dinámicamente)
	if (at.fuente_titulo || at.fuente_cuerpo) {
		const fuentes = [at.fuente_titulo, at.fuente_cuerpo].filter(Boolean);
		const link = document.createElement('link');
		link.rel  = 'stylesheet';
		link.href = `https://fonts.googleapis.com/css2?${
			fuentes.map(f => `family=${f.replace(/ /g, '+')}:wght@300;400;600;700`).join('&')
		}&display=swap`;
		document.head.appendChild(link);

		if (at.fuente_titulo) css.setProperty('--font-titulo', `'${at.fuente_titulo}', sans-serif`);
		if (at.fuente_cuerpo) css.setProperty('--font-cuerpo', `'${at.fuente_cuerpo}', sans-serif`);
	}

	// Fondo
	if (r.fondo_url) {
		const tipo = at.fondo_tipo || 'cover-fixed'; // 'cover-fixed' | 'repeat-scroll'
		if (tipo === 'repeat-scroll') {
			document.body.style.backgroundImage = `url('${r.fondo_url}')`;
			document.body.style.backgroundSize = '100% auto';
			document.body.style.backgroundPosition = 'center top';
			document.body.style.backgroundRepeat = 'repeat-y';
			document.body.style.backgroundAttachment = 'scroll';
		} else {
			// cover-fixed (default)
			document.body.style.backgroundImage = `url('${r.fondo_url}')`;
			document.body.style.backgroundSize = 'cover';
			document.body.style.backgroundPosition = 'center top';
			document.body.style.backgroundAttachment = 'fixed';
			document.body.style.backgroundRepeat = 'no-repeat';
		}
	}

	// CSS personalizado por cliente (casos especiales)
	if (at.css_custom) {
		const style = document.createElement('style');
		style.textContent = at.css_custom;
		document.head.appendChild(style);
	}
}

// ── PÁGINA RAÍZ (sin slug) ────────────────────────────────────
function showRootPage() {
	document.getElementById('mainContent').innerHTML = `
	<div style="text-align:center;padding:80px 20px;">
		<div style="font-size:32px;font-weight:700;margin-bottom:12px;color:var(--primary)">VMenus</div>
		<div style="font-size:14px;color:var(--text-muted)">Menús digitales para restaurantes.</div>
    </div>`;
}

// ── HEX → "r, g, b" (para usar en rgba() del fondo) ────────────
function hexToRgb(hex) {
	hex = hex.replace('#', '');
	if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
	const num = parseInt(hex, 16);
	if (isNaN(num)) return '205, 254, 254'; // fallback: primario default
	return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
}

// ── RESTAURANTE INACTIVO ──────────────────────────────────────
function showInactivo() {
	document.getElementById('mainContent').innerHTML = `
    <div style="text-align:center;padding:80px 20px;">
		<div style="font-size:48px;margin-bottom:16px;">🔒</div>
		<div style="font-size:22px;font-weight:700;color:var(--primary);margin-bottom:8px;">Servicio no disponible</div>
		<div style="font-size:14px;color:var(--text-muted)">Este menú no está disponible en este momento.</div>
    </div>`;
}

// ── ARRANCAR ──────────────────────────────────────────────────
init();
