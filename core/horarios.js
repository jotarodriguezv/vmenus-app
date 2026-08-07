// ── DISPONIBILIDAD POR HORARIO ────────────────────────────────
// Una categoría puede mostrarse solo dentro de una franja: los almuerzos
// de 11 a 3, la cena de 6 a 11. Se guarda en categorias.atributos.horario:
//
//   { activo: true, dias: [1,2,3,4,5], desde: '11:00', hasta: '15:00' }
//
// dias va de 0 (domingo) a 6 (sábado); vacío o ausente = todos los días.
//
// Todo se calcula en la zona horaria del RESTAURANTE, nunca en la del
// visitante: un turista con el celular puesto en otro huso vería el menú
// de una hora que no corresponde.

export const ZONA_POR_DEFECTO = 'America/Bogota';

const DIAS_INTL = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function zonaDe(restaurante) {
	const zona = restaurante?.atributos?.zona_horaria;
	if (!zona) return ZONA_POR_DEFECTO;
	// Una zona inválida hace estallar Intl y tumbaría el menú entero
	try { new Intl.DateTimeFormat('en-US', { timeZone: zona }); return zona; }
	catch { return ZONA_POR_DEFECTO; }
}

// Momento actual en la zona pedida: día de la semana y minutos desde
// la medianoche.
export function ahoraEn(zona, referencia = new Date()) {
	const partes = Object.fromEntries(
		new Intl.DateTimeFormat('en-US', {
			timeZone: zona, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
		}).formatToParts(referencia).map(p => [p.type, p.value])
	);
	// Con hour12:false algunos motores devuelven "24" para la medianoche
	const hora = parseInt(partes.hour, 10) % 24;
	return { dia: DIAS_INTL[partes.weekday], minutos: hora * 60 + parseInt(partes.minute, 10) };
}

export function aMinutos(hhmm) {
	const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? '').trim());
	if (!m) return null;
	const h = +m[1], min = +m[2];
	return (h > 23 || min > 59) ? null : h * 60 + min;
}

// Ante cualquier configuración incompleta o inválida devuelve true: es
// preferible mostrar de más que esconderle el menú a los clientes de un
// restaurante por un dato mal escrito.
export function categoriaVisible(categoria, zona, referencia) {
	const h = categoria?.atributos?.horario;
	if (!h?.activo) return true;

	const desde = aMinutos(h.desde), hasta = aMinutos(h.hasta);
	if (desde === null || hasta === null || desde === hasta) return true;

	const dias = Array.isArray(h.dias) && h.dias.length ? h.dias : [0, 1, 2, 3, 4, 5, 6];
	const { dia, minutos } = ahoraEn(zona, referencia);

	// Franja normal, dentro del mismo día
	if (desde < hasta) return dias.includes(dia) && minutos >= desde && minutos < hasta;

	// Franja que cruza la medianoche (18:00 → 02:00). La madrugada cuenta
	// como parte de la noche anterior: a la 1 a. m. del sábado sigue
	// siendo "la noche del viernes", así que se mira si el viernes estaba
	// entre los días elegidos.
	if (minutos >= desde) return dias.includes(dia);
	if (minutos < hasta)  return dias.includes((dia + 6) % 7);
	return false;
}

// Se filtran categorías Y productos a la vez. Filtrar solo las categorías
// dejaría productos huérfanos que igual aparecerían en la búsqueda del
// modelo explorar y en los contadores de la navegación.
export function aplicarHorarios(categorias, productos, restaurante, referencia) {
	const zona = zonaDe(restaurante);
	const visibles = categorias.filter(c => categoriaVisible(c, zona, referencia));
	const ids = new Set(visibles.map(c => c.id));
	return {
		categorias: visibles,
		productos: productos.filter(p => ids.has(p.categoria_id))
	};
}
