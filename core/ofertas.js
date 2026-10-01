// ── OFERTA DE PRECIO DE UN PLATO ──────────────────────────────
// Un plato puede tener un precio rebajado, con fechas opcionales (sql/35 del
// panel). La carta enseña el de siempre tachado y el nuevo al lado, y el
// carrito cobra el nuevo.
//
// No es la «promoción» (promociones.js): aquella es una imagen que sale al abrir
// la carta y no toca ningún precio. Por eso todo aquí se llama `oferta`.
//
// ── LA REGLA VIVE EN TRES SITIOS ──────────────────────────────
// Este archivo, la cartelera (tv.html, en dialecto viejo para los televisores)
// y el espejo del panel (adminmenus_restaurantes/public/oferta.js). Los tres se
// comprueban contra el MISMO juego de casos, test/casos-oferta.json, duplicado a
// propósito en los dos repositorios: si se separan, el panel dice que la oferta
// rige y la carta cobra el precio de siempre, y eso solo se nota cuando ya hay
// un cliente enfadado en la caja.
//
// Se calcula en la zona horaria del RESTAURANTE, no en la del visitante: un
// turista con el móvil en otro huso vería una oferta que ya terminó, o que
// todavía no empieza. Y se evalúa al pintar, contra el reloj, sin guardar el
// resultado: una carta que lleva abierta desde ayer no puede seguir creyendo
// que la oferta de ayer rige.

import { ZONA_POR_DEFECTO, ahoraEn } from './horarios.js';

// La zona la fija menu.js al cargar el restaurante. Vive aquí, y no se pasa a
// cada llamada, porque textoPrecio() se llama desde una docena de plantillas de
// cinco temas y ninguna tiene el restaurante a mano.
let zona = ZONA_POR_DEFECTO;
export function fijarZonaDeOfertas(z) { zona = z || ZONA_POR_DEFECTO; }

// La fecha de hoy, AAAA-MM-DD, en la zona del restaurante. En ese formato el
// orden alfabético es el del calendario: comparar fechas es comparar cadenas.
export function hoyDeOfertas(referencia = new Date()) {
	try { return ahoraEn(zona, referencia).fecha; }
	catch { return ahoraEn(ZONA_POR_DEFECTO, referencia).fecha; }
}

// En qué punto está la oferta de un plato:
//   'sin'         no tiene, está apagada, o no es un precio menor
//   'programada'  encendida, pero todavía no empieza
//   'vigente'     rige ahora
//   'terminada'   encendida, pero su último día ya pasó
//
// Una oferta que no es MENOR que el precio normal se ignora: ante la duda, se
// enseña y se cobra el precio de siempre. Es el caso de quien bajó el precio
// normal después de poner la oferta, y la base no lo impide a propósito.
export function estadoOferta(p, hoy = hoyDeOfertas()) {
	if (!p || p.oferta_activa !== true) return 'sin';
	if (p.oferta_precio_numerico === null || p.oferta_precio_numerico === undefined) return 'sin';
	const o = Number(p.oferta_precio_numerico);
	if (!Number.isFinite(o) || !(o < Number(p.precio_numerico))) return 'sin';
	if (p.oferta_desde && hoy < p.oferta_desde) return 'programada';
	// 'hasta' es inclusivo: el último día todavía rige.
	if (p.oferta_hasta && hoy > p.oferta_hasta) return 'terminada';
	return 'vigente';
}

// Lo que paga el cliente hoy, para el carrito. El número, nunca el texto.
export function precioVigente(p, hoy = hoyDeOfertas()) {
	return estadoOferta(p, hoy) === 'vigente' ? Number(p.oferta_precio_numerico) : Number(p.precio_numerico);
}

// «$ 40.000». El separador se arma a mano y no con toLocaleString: depende de
// los datos ICU del navegador, y si faltan sale «40,000» en vez de «40.000».
// Es el mismo formato que escribe el panel en `precio`.
export function formatoPesos(n) {
	return '$ ' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
