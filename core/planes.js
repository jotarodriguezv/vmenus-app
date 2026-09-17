// ── PLANES ────────────────────────────────────────────────────
// Qué incluye cada plan. Se guarda en restaurantes.atributos.plan y solo
// lo cambia el superadmin desde el panel.
//
// Desde el 17/09/2026 hay DOS, que son los dos tipos de carta que existen:
// fotos y video. Un modelo de fotos no sirve para video ni al revés —las
// cuadrículas y las proporciones son distintas—, así que el plan decide qué
// modelos se ofrecen. Todo lo demás (destacados, TV, filtros, carrito, QR,
// estadísticas, horarios) va incluido en los dos, y cada restaurante enciende
// lo que usa. Decidido con el usuario: vender todo incluido hasta tener base
// de clientes, y poner niveles después si hace falta. Por eso las banderas
// siguen existiendo aunque hoy digan lo mismo: son las que se moverán.
//
// Video va aparte porque es lo único que de verdad cuesta: cada plato es un
// archivo que hay que almacenar, convertir y servir muchas veces. 'videos' es
// lo que abre la subida en el panel.
//
// 'video' es apaisado, una columna de tarjetas 16:9. 'vertical' es a pantalla
// completa, 9:16, un plato por deslizamiento. Ojo: el formato de corte se
// deriva del modelo en el servidor, así que cambiarlo no re-corta los videos
// ya procesados — hay que volver a subirlos.
//
// Esta misma tabla existe en el panel y en el servidor de
// adminmenus_restaurantes; son aplicaciones desplegadas por separado y deben
// decir lo mismo.
const TODO_INCLUIDO = {
	marca: false,          // el pie «Hecho con VMenus» no sale
	qr_disenador: true,
	estadisticas: true,
	horarios: true,
	carrito: true,
	tv: true,              // la cartelera para televisores
};

export const PLANES = {
	fotos: { nombre: 'Fotos', modelos: ['topnav', 'sidebar', 'explorar'], videos: false, ...TODO_INCLUIDO },
	video: { nombre: 'Video', modelos: ['video', 'vertical'], videos: true, ...TODO_INCLUIDO },
};

// Sin plan —o con uno que no existe— manda el modelo: una carta de video es
// del plan de video. Antes caía en 'pedidos', que ya no existe.
//
// Los nombres de antes (vitrina, pedidos, completo) se entendieron como 'fotos'
// hasta que sql/24 migró la base el 17/09/2026; ya no queda ninguno, y uno que
// apareciera cae aquí igualmente en 'fotos' por su modelo.
export const PLAN_POR_DEFECTO = 'fotos';
const MODELOS_DE_VIDEO = ['video', 'vertical'];

export function nombrePlanDe(restaurante) {
	const at = restaurante?.atributos;
	if (PLANES[at?.plan]) return at.plan;
	return MODELOS_DE_VIDEO.includes(at?.nav) ? 'video' : PLAN_POR_DEFECTO;
}

export function planDe(restaurante) {
	return PLANES[nombrePlanDe(restaurante)];
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
//
// El modelo 'carrito' se retiró el 17/09/2026: el carrito es un interruptor en
// los otros cinco. Un restaurante que aún lo tuviera guardado cae aquí en el de
// por defecto en vez de quedarse sin carta.
export const MODELOS = [...new Set(Object.values(PLANES).flatMap(p => p.modelos))];

export const MODELO_POR_DEFECTO = 'topnav';

export function modeloDe(restaurante) {
	const nav = restaurante?.atributos?.nav;
	return MODELOS.includes(nav) ? nav : MODELO_POR_DEFECTO;
}
