// ── LOADER PRINCIPAL ──────────────────────────────────────────
// Orquesta el arranque completo del menú.
// 1. Lee el slug de la URL
// 2. Carga config del restaurante desde Supabase
// 3. Aplica estilos dinámicos (colores, fuente, fondo)
// 4. Carga el tema de nav correcto
// 5. Renderiza el menú
// 6. Activa features opcionales

import { sbFetch } from './supabase.js';
import { paraElPopup } from './promociones.js';
import {
	setRestaurante, setCategorias, setProductos,
	showLoading, buildMenu,
	buildSocialBar, initScrollTop, initGlobalEvents,
	openPromo, closePromo, closeLightbox, closeModal
} from './menu.js';
import { trackVisita } from './analytics.js';
import { aplicarHorarios } from './horarios.js';
import { planDe, modeloDe } from './planes.js';
import { aplicarPreview } from './preview.js';
import { blindarAnfitrion } from './aviso.js';
import { introActiva, mostrarIntro } from './intro.js';
import {
	leerRuta, sedeDeLaUrl, restauranteDeLaSede,
	productosDeLaSede, reordenarSiEsPorPrecio, categoriasDeLaSede, vieneDelSelector
} from './sedes.js';
import { mostrarSelector } from './selector-sedes.js';

// ── 1. SLUG DESDE LA URL ──────────────────────────────────────
// Se aceptan las dos formas a la vez, siempre, sin que el restaurante
// tenga que elegir una:
//   menu.vmenus.co/bonzas   → 'bonzas'   (ruta)
//   bonzas.vmenus.co        → 'bonzas'   (subdominio)
// Que ambas respondan es lo que permite cambiar la forma "oficial" de un
// restaurante en el panel sin invalidar los QR que ya repartió.
//
// La regla vive en core/sedes.js (leerRuta) porque ahora lleva un segundo dato:
// la sede. menu.vmenus.co/enchulados/bucaramanga → slug 'enchulados', sede
// 'bucaramanga'. Sin sedes, el segundo trozo se ignora.
const { slug, sedeSlug } = leerRuta(window.location.hostname, window.location.pathname);

// Columnas de 'restaurantes' que el menú público necesita. Es la lista
// completa de la tabla menos 'created_at' (no se usa). El PIN vive en otra
// tabla, sin lectura pública, y no debe volver aquí nunca.
const COLUMNAS_PUBLICAS = [
	'id', 'nombre', 'slug', 'logo_url', 'fondo_url',
	'color_primario', 'color_secundario',
	'promo_activa', 'promo_imagen_url', 'activo', 'atributos'
].join(',');
// Las cuatro columnas nuevas de la promoción —promo_nombre, promo_precio,
// promo_en_tv y promo_cada— NO están aquí a propósito, aunque el plan de la
// fase 3 decía que sí. Hoy no las lee nadie en el menú: solo las pinta
// tv.html, que tiene su propio select.
//
// Y pedir de más aquí sale carísimo. Una columna que no existe en la tabla no
// devuelve un hueco: PostgREST contesta 400 y se cae la petición entera. Esta
// lista alimenta TODAS las cartas públicas, así que subir el archivo antes de
// correr el ALTER TABLE dejaría a los nueve restaurantes sin carta. En
// tv.html el mismo error apaga una pantalla; aquí apaga la plataforma.
//
// Se añaden el día que el popup de la carta quiera enseñarlas, y ese día ya
// existirán en la tabla desde hace tiempo.

// ── VISTA PREVIA SIN GUARDAR ───────────────────────────────────
// El panel de administración abre esta misma página con
// ?preview=<json> conteniendo color_primario/color_secundario/atributos
// del formulario (sin persistir en Supabase) para poder verlos aplicados
// antes de decidir guardar.
function leerPreviewDraft() {
	const raw = new URLSearchParams(window.location.search).get('preview');
	if (!raw) return null;
	try { return JSON.parse(decodeURIComponent(raw)); } catch { return null; }
}
const previewDraft = leerPreviewDraft();

// El aviso amarillo, con sus reglas, vive en core/aviso.js: es lo único que
// separa una vista previa de una carta real a ojos del comensal, así que
// tiene pruebas propias.
function mostrarBannerPreview() {
	const host = blindarAnfitrion(document.createElement('div'));
	const raiz = host.attachShadow({ mode: 'closed' });
	raiz.innerHTML = `<div style="background:#ffb020;color:#0a0a0a;text-align:center;
		padding:6px 10px;font-size:12px;font-weight:700;letter-spacing:0.5px;
		font-family:sans-serif">👁 VISTA PREVIA — cambios sin guardar</div>`;
	document.body.appendChild(host);
}

async function init() {
	if (!slug) {
		// Raíz del dominio sin slug → landing o mensaje
		showRootPage();
		return;
	}

	try {
		showLoading(true);

		// ── 2. DATOS DEL RESTAURANTE ─────────────────────────────
		// Se piden columnas explícitas y nunca '*': esta respuesta viaja al
		// navegador de cualquier visitante, así que la lista de abajo es
		// exactamente lo que la plataforma acepta hacer público. Una columna
		// nueva en la tabla no se filtra sola por haberla creado.
		const restData = await sbFetch('restaurantes',
			`slug=eq.${encodeURIComponent(slug)}&select=${COLUMNAS_PUBLICAS}`);
		if (!restData.length) throw new Error('Restaurante no encontrado');

		const original = restData[0];

		// ── 2.5 SEDES ────────────────────────────────────────────
		// Solo se piden si el restaurante dice que las tiene (la marca la pone el
		// panel al crear la primera sede): los demás no pagan una petición de más
		// ni dependen de que la tabla exista. Si la petición falla, la carta sale
		// sin sedes —es la de siempre— y no se cae el arranque.
		//
		// Con UNA sola sede no hay nada que elegir: se entra directo a ella.
		const sedes = original.atributos?.con_sedes === true
			? await sbFetch('sedes', `restaurante_id=eq.${original.id}&select=id,slug,nombre,atributos,orden&order=orden.asc`).catch(() => [])
			: [];
		const sede = sedeDeLaUrl(sedes, sedeSlug) || (sedes.length === 1 ? sedes[0] : null);

		// aplicarPreview solo deja pasar apariencia. Lo que dice a dónde va un
		// pedido o un clic —el WhatsApp, los métodos de pago, las redes— sale
		// de la base de datos también aquí: ese JSON lo escribe quien arma la
		// URL, y cualquiera puede armar una. Ver core/preview.js.
		const restaurante = restauranteDeLaSede(
			previewDraft ? aplicarPreview(original, previewDraft) : original, sede);
		if (previewDraft) mostrarBannerPreview();

		setRestaurante(restaurante);

		// Restaurante inactivo (suspendido por impago, etc.)
		if (restaurante.activo === false) {
			showLoading(false);
			showInactivo();
			return;
		}

		trackVisita(restaurante.id);

		// ── 3. ESTILOS DINÁMICOS ──────────────────────────────────
		applyStyles(restaurante);

		// Hay sedes y la URL no dice cuál: se elige antes de enseñar ninguna carta,
		// porque los precios dependen de la sede. Va después de los estilos para que
		// la pantalla lleve los colores del restaurante. La vista previa del panel
		// no pasa por aquí: compara apariencia, no elige local.
		//
		// Con bienvenida encendida, las sedes son una tarjeta DENTRO de ella; sin
		// ella, una pantalla propia.
		if (sedes.length && !sede && !previewDraft) {
			showLoading(false);
			if (introActiva(restaurante)) mostrarIntro(restaurante, { sedes });
			else mostrarSelector(restaurante, sedes);
			document.title = `${restaurante.nombre} — Elige tu sede`;
			return;
		}

		// ── 4. DATOS DE MENÚ ──────────────────────────────────────
		const [cats, prodsBase, promos, filasSede] = await Promise.all([
			sbFetch('categorias', `restaurante_id=eq.${restaurante.id}&select=*&order=orden.asc`),
			sbFetch('productos', `restaurante_id=eq.${restaurante.id}&disponible=eq.true&select=*&order=${ordenDeProductos(restaurante)}`),
			// El .catch va en ESTA promesa y no en el Promise.all: si se cae la
			// consulta de promociones, la carta tiene que salir igual. Una
			// promoción es un adorno; los platos son el producto. Con el catch
			// fuera, Promise.all rechazaría y se perdería el menú entero.
			//
			// La lectura pública solo devuelve las encendidas (RLS), así que lo
			// que llega aquí ya está filtrado por 'activa'.
			sbFetch('promociones', `restaurante_id=eq.${restaurante.id}&select=*&order=orden.asc`)
				.catch(() => []),
			// Lo que cambia en esta sede. SIN .catch, al revés que la promoción: si
			// esto falla y se siguiera adelante, la carta enseñaría —y el carrito
			// cobraría— los precios de OTRA sede sin que nadie lo notara. Mejor el
			// «no se pudo cargar» de abajo que un precio equivocado.
			sede
				? sbFetch('productos_sedes', `sede_id=eq.${sede.id}&select=producto_id,precio,precio_numerico,disponible`)
				: Promise.resolve([])
		]);
		// Precios y platos de la sede, antes de repartir los datos: los temas, el
		// carrito y el buscador ven ya la carta de ESTA sede.
		const prods = sede
			? reordenarSiEsPorPrecio(productosDeLaSede(prodsBase, filasSede), restaurante.atributos?.orden_productos)
			: prodsBase;
		const categorias = sede ? categoriasDeLaSede(cats, prodsBase, prods) : cats;
		// Las categorías con horario se ocultan fuera de su franja. Se filtra
		// aquí, antes de repartir los datos, para que los cuatro temas y sus
		// navegaciones vean exactamente el mismo menú.
		// Los horarios de categoría son de plan; sin ellos se muestra todo.
		const visible = planDe(restaurante).horarios
			? aplicarHorarios(categorias, prods, restaurante)
			: { categorias, productos: prods };
		setCategorias(visible.categorias);
		setProductos(visible.productos);

		showLoading(false);

		// ── 4.5 PANTALLA DE BIENVENIDA (opcional) ─────────────────
		// Se pinta ANTES del tema, y este se construye igual, debajo: al
		// pulsar "Ver carta" la carta ya está lista, sin esperar a nada.
		// Una vista previa compara la carta, no su puerta de entrada: las tres
		// miniaturas de modelos comparten ?preview=… y deben enseñar de inmediato
		// la navegación que se está eligiendo. La bienvenida tiene su propio
		// simulador dentro del panel de Apariencia.
		// Quien acaba de elegir sede en la bienvenida ya la vio: no se repite.
		if (!previewDraft && introActiva(restaurante) && !(sede && vieneDelSelector(restaurante.slug, sede.slug))) mostrarIntro(restaurante);

		// ── 5. TEMA DE NAV ────────────────────────────────────────
		// Validado contra los modelos que existen de verdad: el nombre se usa
		// para importar un archivo, y uno que no exista tira el arranque
		// entero al catch de abajo. Ver modeloDe() en core/planes.js.
		const tema = modeloDe(restaurante);
		// Mostrar/ocultar bloques HTML según el tema
		window.activarTema?.(tema, restaurante);
		const temaModule = await import(`../temas/${tema}.js`);
		temaModule.buildNav();

		// ── 6. MENÚ ───────────────────────────────────────────────
		// Se pregunta por lo que el tema exporta, no por cómo se llama. Aquí
		// había una lista de nombres ('carrito', 'explorar', 'video'...) que
		// había que ampliar cada vez que nacía un modelo: quien se olvidaba
		// veía su carta pintada por el render compartido, con las clases de
		// otro modelo y sin el aspecto que acababa de escribir.
		if (temaModule.buildMenu) temaModule.buildMenu();
		else buildMenu();

		// Igual con el scroll spy: lo tiene el tema que lo necesita, y los
		// que no lo exportan sencillamente no lo tienen. Va después del
		// render porque observa elementos que acaba de pintar.
		if (temaModule.initScrollSpy) {
			requestAnimationFrame(() => temaModule.initScrollSpy());
		}

		// ── 7. FEATURES OPCIONALES ────────────────────────────────
		buildSocialBar();    // solo si atributos.social_bar = true
		initScrollTop();
		initGlobalEvents();

		// ── 8. PROMO ─────────────────────────────────────────────
		// Cuál sale la decide promociones.js: mira la programación con el reloj
		// del restaurante y, si hay varias vigentes, elige una al azar. El
		// comensal escanea el QR una vez, así que con un orden fijo la segunda
		// no la vería nadie.
		const promo = paraElPopup(promos, restaurante);
		// Sin respaldo en las columnas viejas (promo_activa / promo_imagen_url),
		// quitado el 02/10/2026: el panel solo lee la tabla, así que borrar la
		// última promoción dejaba la carta de Bonzas enseñando una imagen que el
		// panel ya no mostraba y nadie podía apagar.
		// Igual que la pantalla de bienvenida: la vista previa del panel tiene
		// que enseñar el modelo de página, no una capa que lo tapa. El destacado
		// sigue apareciendo normalmente a quien entra a la carta publicada.
		if (!previewDraft && promo) setTimeout(() => openPromo(promo.imagen_url), 700);

		// ── 9. CRÉDITO DE LA PLATAFORMA ──────────────────────────
		mostrarCredito(restaurante);

		// ── 10. TÍTULO DE LA PÁGINA ───────────────────────────────
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

// ── CRÉDITO DE LA PLATAFORMA ──────────────────────────────────
// Una línea discreta con enlace, al pie del menú. Los planes que la
// quitan son los que pagan por marca blanca.
//
// Se añade al final, cuando el tema ya construyó su pie: 'explorar'
// arma el suyo propio y esconde el compartido, así que hay que buscar
// los dos. El pie del restaurante (su copyright) no se toca.
function mostrarCredito(restaurante) {
	if (!planDe(restaurante).marca) return;
	const destino = document.getElementById('expFooter')
		|| document.querySelector('.footer')
		|| document.getElementById('mainContent');
	if (!destino) return;
	const credito = document.createElement('div');
	credito.className = 'vm-credito';
	credito.innerHTML = '<a href="https://vmenus.co" target="_blank" rel="noopener">Hecho con VMenus</a>';
	destino.appendChild(credito);
}

// ── ORDEN DE LOS PRODUCTOS ────────────────────────────────────
// Lo elige el restaurante desde el panel. Por defecto, de menor a mayor
// precio: es como funcionaba antes de que la opción existiera.
const ORDEN_PRODUCTOS = {
	precio_asc:  'precio_numerico.asc',
	precio_desc: 'precio_numerico.desc',
	nombre_az:   'nombre.asc',
	// El manual necesita desempate: los productos creados antes de la
	// primera reordenación comparten valores de "orden".
	personalizado: 'orden.asc,nombre.asc',
};

function ordenDeProductos(restaurante) {
	return ORDEN_PRODUCTOS[restaurante.atributos?.orden_productos] || ORDEN_PRODUCTOS.precio_asc;
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
	// Paleta de superficie (por defecto: valores de Bonzas)
	// Malparados los sobreescribe desde atributos
	css.setProperty('--dark', at.color_dark || '#0a0a0f');
	css.setProperty('--surface', at.color_surface || '#12111a');
	const cardColor = at.color_card || '#1a1825';
	css.setProperty('--card', cardColor);
	// Si se configuró un color de caja propio pero no su hover/borde, se
	// calculan a partir de ese mismo color en vez de quedar desligados.
	css.setProperty('--card-hover', at.color_card_hover || (at.color_card ? lightenHex(cardColor, 0.15) : '#221f30'));
	css.setProperty('--border', at.color_border || (at.color_card ? lightenHex(cardColor, 0.30) : '#2a2640'));

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
		// Imagen de fondo: tiene prioridad sobre color/degradado.
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
	} else {
		// Sin imagen: color de fondo elegido en Apariencia, con la intensidad elegida.
		// 'solido' (default) | 'sutil' | 'marcado'
		const fondoColor = at.fondo_color || '#0a0a0f';
		const intensidad = at.fondo_intensidad || 'solido';
		if (intensidad === 'solido') {
			document.body.style.background = fondoColor;
		} else {
			const rgb = hexToRgb(fondoColor);
			const alpha = intensidad === 'marcado' ? 0.35 : 0.15;
			document.body.style.background = `radial-gradient(ellipse 90% 60% at 50% 0%, rgba(${rgb}, ${alpha}) 0%, ${fondoColor} 70%)`;
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

// ── ACLARAR UN COLOR HEX (mezclar hacia blanco un %) ───────────
function lightenHex(hex, amount) {
	const [r, g, b] = hexToRgb(hex).split(',').map(n => parseInt(n.trim(), 10));
	const mix = c => Math.round(c + (255 - c) * amount).toString(16).padStart(2, '0');
	return `#${mix(r)}${mix(g)}${mix(b)}`;
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
