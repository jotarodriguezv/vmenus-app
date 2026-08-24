// ── VISTA PREVIA SIN GUARDAR ──────────────────────────────────
// El panel abre la carta pública con ?preview=<json> para enseñar cómo
// quedaría la apariencia antes de guardarla. Es cómodo y hay que
// conservarlo, pero tiene una consecuencia que no es evidente:
//
//   ese JSON lo escribe QUIEN CONSTRUYE LA URL, y cualquiera puede
//   construir una. No hace falta entrar al panel ni tener credenciales.
//
// Mientras el parámetro se fundía entero sobre los atributos del
// restaurante, un enlace preparado desde fuera podía cambiar cosas que no
// son apariencia. El caso que importa es 'whatsapp_pedidos': es el número
// al que el carrito manda el pedido, así que
//
//   menu.vmenus.co/<carta>?preview={"atributos":{"whatsapp_pedidos":"57..."}}
//
// abre la carta de verdad, con su logo, sus platos y sus precios, y manda
// los pedidos al teléfono de quien repartió el enlace. El comensal no tiene
// forma de notarlo: lo único distinto es el aviso de vista previa.
//
// De ahí esta lista. La vista previa solo puede tocar CÓMO SE VE la carta,
// nunca A DÓNDE APUNTA. Los destinos —el WhatsApp de pedidos, los métodos
// de pago, las redes— salen siempre de la base de datos, también durante
// una vista previa: al probar colores no se está probando el teléfono.
//
// Para añadir una clave aquí, la pregunta es esa: si un desconocido pudiera
// fijarle ese valor a la carta de un cliente, ¿qué conseguiría? Si la
// respuesta es "que se vea distinto", entra. Si es "que el dinero, el
// pedido o el clic acaben en otro sitio", no.
export const CLAVES_APARIENCIA = [
	// Paleta
	'color_dark', 'color_surface', 'color_card', 'color_card_hover', 'color_border',
	// Fondo
	'fondo_tipo', 'fondo_color', 'fondo_intensidad',
	// Tipografía
	'fuente_titulo', 'fuente_cuerpo',
	// Modelo de carta y su aspecto
	'nav', 'estilo', 'plan',
	// Bloques que se enseñan o se esconden
	'subtitulo', 'mostrar_hero', 'portada_activa', 'carrito', 'social_bar',
	'filtros_disponibles',
	// Ajustes que solo cambian cómo se presenta lo que ya hay
	'zona_horaria', 'orden_productos', 'url_modo', 'css_custom',
];

// Devuelve una copia del restaurante con lo que la vista previa puede
// cambiar, y nada más. No modifica el original: quien llama decide qué
// hacer con el resultado.
//
// Los dos colores de primer nivel van aparte porque son columnas de la
// tabla y no viven dentro de 'atributos'.
export function aplicarPreview(restaurante, draft) {
	const base = { ...(restaurante || {}) };
	if (!draft || typeof draft !== 'object') return base;

	if (typeof draft.color_primario === 'string') base.color_primario = draft.color_primario;
	if (typeof draft.color_secundario === 'string') base.color_secundario = draft.color_secundario;

	const entrantes = draft.atributos;
	// Un 'atributos' que no sea un objeto —una cadena, un array, null— no se
	// interpreta: se ignora entero y quedan los del restaurante.
	if (!entrantes || typeof entrantes !== 'object' || Array.isArray(entrantes)) return base;

	const permitidos = {};
	for (const clave of CLAVES_APARIENCIA) {
		// Solo las claves presentes de verdad. Con `in` en vez de `!== undefined`
		// no hace falta distinguir "no la mandó" de "la mandó vacía".
		if (Object.prototype.hasOwnProperty.call(entrantes, clave)) {
			permitidos[clave] = entrantes[clave];
		}
	}

	base.atributos = { ...(restaurante?.atributos || {}), ...permitidos };
	return base;
}
