// ── PRESENTACIONES DE UN PLATO ────────────────────────────────
// Un mismo plato puede venir en versiones: «1X $12.000 · 2X $20.000», un jugo de 500 ml y de
// 750 ml, un hojaldre sencillo o doble. Siguen siendo UN plato —su foto, su descripción, su
// categoría— con una lista de presentaciones, cada una con su nombre y su precio.
//
// Dónde viven: `producto.atributos.presentaciones`, una lista de
//   { id, nombre, precio_numerico }
// El `id` es estable (lo pone el servidor la primera vez) para que una línea del carrito sepa
// QUÉ presentación era aunque el restaurante la renombre o reordene.
//
// ── EL PRECIO BASE DEL PLATO ES EL MÁS BAJO ───────────────────
// `producto.precio_numerico` y `producto.precio` guardan el de la presentación más barata (lo
// sincroniza el servidor al guardar). Así todo lo que ordena, filtra o cuenta por precio —el
// orden de la carta, la cartelera, las estadísticas— sigue funcionando sin saber que existen
// presentaciones.
//
// ── DE QUÉ NO SABE (todavía) ──────────────────────────────────
// Los precios POR SEDE y la oferta de precio no distinguen presentaciones: en un plato con
// presentaciones se ignoran (docs/presentaciones.md del panel).
//
// La regla de cómo se ESCRIBEN las presentaciones vive también en tv.html (dialecto viejo), y
// las dos corren contra test/casos-presentaciones.json.

import { formatoPesos } from './ofertas.js';

// Con una sola presentación no hay nada que elegir: es un plato con su precio.
export const MIN_PRESENTACIONES = 2;
// Hasta cuántas se escriben en la tarjeta («1X $12.000 · 2X $20.000»); con más, «Desde».
export const MAX_EN_LINEA = 3;

// Las presentaciones válidas de un plato, o [] si no tiene (o no llegan a dos). Tolera cualquier
// forma de dato: viene de un JSON que escribe un servidor, pero se lee en un navegador público.
export function presentacionesDe(p) {
	const lista = p?.atributos?.presentaciones;
	if (!Array.isArray(lista)) return [];
	const validas = lista.map(x => {
		const nombre = String(x?.nombre ?? '').trim();
		const precio = Number(x?.precio_numerico);
		if (!nombre || !Number.isFinite(precio) || precio < 0) return null;
		return { id: String(x?.id ?? nombre), nombre, precio_numerico: precio };
	}).filter(Boolean);
	return validas.length >= MIN_PRESENTACIONES ? validas : [];
}

export function tienePresentaciones(p) { return presentacionesDe(p).length > 0; }

export function presentacionPorId(p, id) {
	return presentacionesDe(p).find(x => x.id === String(id)) || null;
}

// La más barata: lo que dice «Desde».
export function masBarata(p) {
	const l = presentacionesDe(p);
	return l.length ? l.reduce((m, x) => (x.precio_numerico < m.precio_numerico ? x : m)) : null;
}

// Cómo se escriben, para la tarjeta, la ficha y la cartelera. Es texto plano: quien lo pinta lo
// escapa.
export function textoPresentaciones(p) {
	const l = presentacionesDe(p);
	if (!l.length) return '';
	if (l.length > MAX_EN_LINEA) return `Desde ${formatoPesos(masBarata(p).precio_numerico)}`;
	return l.map(x => `${x.nombre} ${formatoPesos(x.precio_numerico)}`).join(' · ');
}

// La clave de una línea del carrito. Sin presentación es la de siempre, para que ningún carrito
// guardado de un plato sin ellas cambie de sitio.
export function claveDeLinea(id, presId, descripcion) {
	return presId ? `${id}~${presId}__${descripcion}` : `${id}__${descripcion}`;
}

// «Fresas con crema · 2X»: lo que lee el restaurante en WhatsApp y en su lista de pedidos.
export function nombreConPresentacion(nombre, presentacion) {
	return presentacion ? `${nombre} · ${presentacion.nombre}` : nombre;
}
