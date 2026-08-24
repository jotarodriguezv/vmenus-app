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
		carrito: false,
	},
	pedidos: {
		nombre: 'Pedidos',
		modelos: ['topnav', 'sidebar', 'explorar', 'carrito'],
		marca: true,
		qr_disenador: true,
		estadisticas: true,
		horarios: true,
		videos: false,
		carrito: true,
	},
	completo: {
		nombre: 'Completo',
		modelos: ['topnav', 'sidebar', 'explorar', 'carrito'],
		marca: false,
		qr_disenador: true,
		estadisticas: true,
		horarios: true,
		videos: false,
		carrito: true,
	},
	// 'carrito' era solo un modelo de página; ahora es además una capacidad
	// que otros modelos pueden encender —el de video, el primero— sin copiar
	// las seiscientas líneas del carrito a cada tema. El modelo sigue en la
	// lista de 'modelos' para los que lo usan como página entera.
	//
	// La carta en video va en su propio plan porque su coste no se parece
	// al de los demás: cada plato es un archivo que hay que almacenar,
	// convertir y servir muchas veces. 'videos' es lo que abre la subida
	// en el panel; los modelos 'video' y 'vertical' son las dos formas que
	// la carta sabe pintar. Las tres cosas van juntas y solo aquí.
	//
	// 'video' es apaisado, una columna de tarjetas 16:9. 'vertical' es a
	// pantalla completa, 9:16, un plato por deslizamiento. El mismo plan da
	// los dos porque el coste es el mismo; lo que cambia es el encuadre con
	// el que se graba, y eso lo decide el restaurante. Ojo: el formato de
	// corte se deriva de este modelo en el servidor, así que cambiarlo no
	// re-corta los videos ya procesados — hay que volver a subirlos.
	video: {
		nombre: 'Video',
		modelos: ['topnav', 'sidebar', 'explorar', 'carrito', 'video', 'vertical'],
		marca: false,
		qr_disenador: true,
		estadisticas: true,
		horarios: true,
		videos: true,
		carrito: true,
	},
};

export const PLAN_POR_DEFECTO = 'pedidos';

export function planDe(restaurante) {
	return PLANES[restaurante?.atributos?.plan] || PLANES[PLAN_POR_DEFECTO];
}

// ── MODELOS QUE EXISTEN ───────────────────────────────────────
// La lista sale de los planes en vez de escribirse a mano: un modelo que no
// esté en ningún plan no lo puede usar nadie, así que no hay dos sitios que
// puedan discrepar.
//
// Hace falta porque el modelo se carga por su nombre —import('../temas/X.js')—
// y un nombre que no corresponde a ningún archivo no da un fallo pequeño: la
// importación lanza, el arranque entero cae en su catch y el visitante ve "No
// se pudo cargar el menú" en vez de la carta. Una errata en el panel, o un
// modelo retirado que quedara escrito en algún restaurante, apagaría esa carta
// del todo.
//
// Cayendo al modelo por defecto se ve una carta con otro aspecto, que es
// molesto pero se puede pedir y arreglar. Una carta que no carga no se puede
// ni enseñar.
export const MODELOS = [...new Set(Object.values(PLANES).flatMap(p => p.modelos))];

export const MODELO_POR_DEFECTO = 'topnav';

export function modeloDe(restaurante) {
	const nav = restaurante?.atributos?.nav;
	return MODELOS.includes(nav) ? nav : MODELO_POR_DEFECTO;
}
