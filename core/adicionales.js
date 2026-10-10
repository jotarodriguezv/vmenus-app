// ── LOS ADICIONALES DE LA CARTA, EN EL MODAL DEL PEDIDO ───────
// Un restaurante puede tener una categoría «ADICIONALES» en su carta —porción de papa, de tocineta, de
// queso— con su precio y su disponibilidad, que es lo que se ve y se pide suelto. Esto deja que ESOS MISMOS
// platos se ofrezcan también dentro de la ventana de personalización cuando se agrega otro plato (una
// hamburguesa, un perro), sin tener que copiarlos como «toppings con costo»: un precio se cambia en un solo
// sitio, y un adicional agotado deja de ofrecerse en las dos partes.
//
// Se configura en Ajustes → carrito: `atributos.adicionales_carta = { activo, categoria_id, categorias }`
//  · `categoria_id`: la categoría que hace de fuente de adicionales.
//  · `categorias`: en qué categorías de platos se ofrecen (un adicional de papa en la gaseosa no tiene sentido).
// Es OPT-IN: sin la clave, o con `activo` distinto de true, todo queda como siempre.
//
// Cómo encaja con lo que ya existe: cada adicional se traduce a un «topping con costo» sintético, con id
// `adic_<id del plato>`, que es repetible (dos porciones de papa son normales). Así el modal, el recargo, el
// mensaje de WhatsApp y la revalidación del carrito —que busca cada id en las opciones de HOY— funcionan sin
// saber que existen; un adicional que el restaurante borra o agota sale del pedido avisando, como cualquier
// topping.

import { precioVigente } from './ofertas.js';

export const PREFIJO_ADICIONAL = 'adic_';
// Cuántas porciones del mismo adicional se pueden pedir. La plataforma pone el techo (TOPE_MAXIMO_ADICIONAL
// en carrito.js): esto es lo que ofrece la carta.
export const MAX_PORCIONES = 4;

// La configuración válida, o null. Tolera cualquier forma de dato: viene de un JSON de la base.
export function configAdicionales(restaurante) {
	const c = restaurante?.atributos?.adicionales_carta;
	if (!c || c.activo !== true) return null;
	const categoria = String(c.categoria_id || '');
	if (!categoria) return null;
	const categorias = (Array.isArray(c.categorias) ? c.categorias : []).map(String).filter(id => id && id !== categoria);
	if (!categorias.length) return null;
	return { categoria, categorias: new Set(categorias) };
}

// ¿Se ofrecen los adicionales en el modal de este plato? No el de los adicionales mismos.
export function aplicaAdicionales(plato, config) {
	return !!config && !!plato && plato.categoria_id !== config.categoria && config.categorias.has(String(plato.categoria_id));
}

// Los adicionales de hoy: los platos de esa categoría que se pueden pedir, con el precio que rige hoy.
export function adicionalesDeLaCarta(productos, config) {
	if (!config) return [];
	return (Array.isArray(productos) ? productos : [])
		.filter(p => p && p.categoria_id === config.categoria && p.disponible !== false && String(p.nombre ?? '').trim())
		.map(p => ({
			id: PREFIJO_ADICIONAL + p.id,
			nombre: String(p.nombre).trim(),
			precio: Number(precioVigente(p)) || 0,
			repetible: true,
			max: MAX_PORCIONES,
		}));
}
