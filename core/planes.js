// ── PLANES ────────────────────────────────────────────────────
// Qué incluye cada plan. Se guarda en restaurantes.atributos.plan y solo
// lo cambia el superadmin desde el panel.
//
// Esta tabla es la única fuente: para reempaquetar la oferta se mueven
// estas líneas y no hay que tocar nada más. La misma tabla existe en el
// panel de administración; son dos aplicaciones desplegadas por separado
// y deben mantenerse iguales.
//
// El plan por defecto es 'pedidos' a propósito: es exactamente lo que
// hace hoy la plataforma, así que un restaurante sin plan asignado no
// nota ningún cambio.

export const PLANES = {
	vitrina: {
		nombre: 'Vitrina',
		modelos: ['topnav', 'sidebar', 'explorar'],
		marca: true,           // se muestra el crédito "Hecho con VMenus"
		qr_disenador: false,   // el QR se genera igual; lo que no hay es personalizarlo
		estadisticas: false,
		horarios: false,
		videos: false,
	},
	pedidos: {
		nombre: 'Pedidos',
		modelos: ['topnav', 'sidebar', 'explorar', 'carrito'],
		marca: true,
		qr_disenador: true,
		estadisticas: true,
		horarios: true,
		videos: false,
	},
	completo: {
		nombre: 'Completo',
		modelos: ['topnav', 'sidebar', 'explorar', 'carrito'],
		marca: false,
		qr_disenador: true,
		estadisticas: true,
		horarios: true,
		videos: false,
	},
	// La carta en video va en su propio plan porque su coste no se parece
	// al de los demás: cada plato es un archivo que hay que almacenar,
	// convertir y servir muchas veces. 'videos' es lo que abre la subida
	// en el panel; el modelo 'video' es lo que la carta sabe pintar. Las
	// dos cosas van juntas y solo aquí.
	video: {
		nombre: 'Video',
		modelos: ['topnav', 'sidebar', 'explorar', 'carrito', 'video'],
		marca: false,
		qr_disenador: true,
		estadisticas: true,
		horarios: true,
		videos: true,
	},
};

export const PLAN_POR_DEFECTO = 'pedidos';

export function planDe(restaurante) {
	return PLANES[restaurante?.atributos?.plan] || PLANES[PLAN_POR_DEFECTO];
}
