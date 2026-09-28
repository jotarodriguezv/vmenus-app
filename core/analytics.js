// ── ANALÍTICA ──────────────────────────────────────────────────
// Reporta visitas al menú y clics en productos al panel de
// administración (adminmenus_restaurantes), que es quien tiene la
// llave de servicio de Supabase. El sitio público nunca escribe
// directo a la base de datos para esto.
//
const TRACK_API_URL = 'https://adminvmenus.verificame.click';

function enviar(payload) {
	// Nunca contar como visita/clic real cuando es una vista previa del panel
	// (?preview=...) — eso no es tráfico de un cliente.
	if (new URLSearchParams(window.location.search).has('preview')) return;
	fetch(`${TRACK_API_URL}/api/track`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	}).catch(() => {
		// Nunca debe interrumpir la carga del menú si falla el tracking.
	});
}

export function trackVisita(restauranteId) {
	enviar({ restaurante_id: restauranteId, tipo: 'visita' });
}

export function trackClic(restauranteId, productoId) {
	enviar({ restaurante_id: restauranteId, tipo: 'clic', producto_id: productoId });
}

// Solo lo emiten los restaurantes con el modelo carrito. Es la señal más
// fuerte de interés: abrir una ficha puede ser curiosidad, meterla al
// carrito es intención de pedir.
export function trackAgregarCarrito(restauranteId, productoId) {
	enviar({ restaurante_id: restauranteId, tipo: 'agregar_carrito', producto_id: productoId });
}

// Un pedido contiene datos personales, así que no viaja por /api/track ni se
// mezcla con los eventos anónimos. Solo se registra cuando la persona confirma
// que envió el mensaje de WhatsApp; no se presenta como una venta confirmada.
export function registrarPedido(pedido) {
	if (new URLSearchParams(window.location.search).has('preview')) return Promise.resolve(false);
	return fetch(`${TRACK_API_URL}/api/pedidos-publicos`, {
		method: 'POST', headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(pedido), keepalive: true,
	}).then(r => r.ok).catch(() => false);
}
