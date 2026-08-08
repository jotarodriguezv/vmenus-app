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

// Para lo que va dentro de href/src. Escapar evita salirse del atributo pero
// no impide un href="javascript:...", así que aquí se exige además que el
// destino sea una URL de verdad. Lo que no lo sea se queda en '#'.
const PROTOCOLOS_SEGUROS = ['http:', 'https:', 'mailto:', 'tel:'];

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
