// ── ESCAPADO DE HTML ──────────────────────────────────────────
// Todo lo que escribe un restaurante desde el panel —nombres, precios,
// descripciones, URLs de imagen, toppings, datos de pago— acaba dentro de
// plantillas que se asignan con innerHTML. Sin escapar, un nombre tan normal
// como  Combo "El Grande"  rompe el atributo alt y descuadra la tarjeta, y
// una comilla bien puesta en imagen_url permite colar un onerror.
//
// Vivía suelto dentro de temas/explorar.js, así que los otros temas se
// quedaron sin él. Está aquí para que haya una sola copia y no vuelva a
// pasar que un archivo escape y los demás no.
export function esc(s) {
	return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
		'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
	}[c]));
}

import { estadoOferta, formatoPesos } from './ofertas.js';
import { tienePresentaciones, textoPresentaciones, presentacionesDe } from './presentaciones.js';

// Un cero no basta para decir que algo es gratis: muchas cartas antiguas lo
// usaban como valor provisional. Solo la marca explícita del panel cambia lo
// que ve el comensal; el importe numérico sigue siendo 0 para el carrito.
export function textoPrecio(producto) {
	return producto?.atributos?.precio_gratis === true ? 'Gratis' : (producto?.precio || '');
}

// El precio como HTML, ya escapado, para meter en una plantilla: si el plato
// tiene una oferta vigente, el de siempre tachado y el nuevo al lado; si no, lo
// mismo que textoPrecio(). Es lo que pintan TODAS las plantillas, para que una
// oferta salga igual en los cinco modelos y en la ficha del plato.
//
// «Gratis» manda sobre la oferta: es una marca explícita del panel.
export function htmlPrecio(producto) {
	if (producto?.atributos?.precio_gratis === true) return 'Gratis';
	// Con presentaciones el precio ES la lista («1X $ 12.000 · 2X $ 20.000») o su «Desde»; la oferta de
	// precio no distingue presentaciones y se ignora (core/presentaciones.js).
	if (tienePresentaciones(producto)) return esc(textoPresentaciones(producto));
	if (estadoOferta(producto) !== 'vigente') return esc(textoPrecio(producto));
	return `<s class="precio-antes">${esc(textoPrecio(producto))}</s> <span class="precio-oferta">${esc(formatoPesos(producto.oferta_precio_numerico))}</span>`;
}

// Las presentaciones como LISTA, una por renglón («1X ···· $ 12.000»), para los temas que tienen sitio
// para ella (Explorar). Quien la use deja de pintar el precio en línea, que sería lo mismo dicho dos
// veces. Vacía si el plato no tiene presentaciones.
export function htmlListaPresentaciones(producto) {
	const lista = presentacionesDe(producto);
	if (!lista.length) return '';
	return `<ul class="pres-lista">` + lista.map(x =>
		`<li><span class="pres-nombre">${esc(x.nombre)}</span><span class="pres-precio">${esc(formatoPesos(x.precio_numerico))}</span></li>`
	).join('') + `</ul>`;
}

// Para lo que va dentro de href/src. Escapar evita salirse del atributo pero
// no impide un href="javascript:...", así que aquí se exige además que el
// destino sea una URL de verdad. Lo que no lo sea se queda en '#'.
const PROTOCOLOS_SEGUROS = ['http:', 'https:', 'mailto:', 'tel:'];

// ── LA NOTA DE UNA CATEGORÍA ─────────────────────────────────
// P4 en adminmenus_restaurantes/docs/revision-ux.md. «Todas las hamburguesas van
// acompañadas de papas» se escribía como un plato de $ 0, que caía primero solo
// mientras el orden fuera por precio. Ahora es un texto de la categoría, y cada
// modelo lo pinta bajo su título con esta función: una sola que escapa.
export function notaDe(cat, clase = 'categoria-nota') {
	const nota = String(cat?.atributos?.nota ?? '').trim();
	return nota ? `<p class="${clase}">${esc(nota)}</p>` : '';
}

export function escUrl(u) {
	const s = String(u ?? '').trim();
	if (!s) return '';
	// Las rutas relativas (/uploads/...) son válidas y no pasan por URL()
	if (/^[/.]/.test(s)) return esc(s);
	try {
		return PROTOCOLOS_SEGUROS.includes(new URL(s).protocol) ? esc(s) : '#';
	} catch {
		return '#';
	}
}
