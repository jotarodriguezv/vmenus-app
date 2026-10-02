// ── DATOS DEL NEGOCIO ─────────────────────────────────────────
// Lo que el restaurante dice una vez en Ajustes → Datos del negocio y que varias
// funciones de la carta usan por su cuenta. Hoy, el WhatsApp y si la carta
// enseña su botón (paso 1), y la dirección, la ubicación y el enlace de reseñas
// (paso 2).
//
// Un solo número. Antes eran dos —`whatsapp_pedidos`, al que el carrito manda el
// pedido, y `social_whatsapp`, el de la barra de redes y la bienvenida—, y cuatro
// restaurantes los tenían repetidos con el mismo valor. Decidido el 01/10/2026.
//
// ── EL BOTÓN SE DECIDE APARTE DEL NÚMERO ──────────────────────
// El número sirve para recibir pedidos aunque la carta no enseñe ningún botón de
// WhatsApp. Antes el botón salía si `social_whatsapp` tenía número; con un número
// único, quien lo puso solo para pedidos habría visto aparecer un botón que
// nunca pidió. De ahí `whatsapp_boton`.
//
// ── LAS CLAVES VIEJAS SE SIGUEN LEYENDO ───────────────────────────
// `whatsapp_pedidos` y `social_whatsapp` no se borran todavía. Se miran solo
// cuando la clave nueva NO EXISTE. Si el restaurante borra su número,
// `whatsapp_negocio` queda en '' y eso es «no hay número»: mirar la vieja
// entonces resucitaría un número que se quitó a propósito.
//
// Hay una copia de esta regla en el panel (public/negocio.js y negocio.js, en
// adminmenus_restaurantes). No pueden compartir el módulo: son aplicaciones
// distintas. Las tres corren contra test/casos-negocio.json, duplicado a
// propósito en los dos repositorios.

const soloDigitos = v => String(v ?? '').replace(/\D/g, '');
const existe = v => v !== undefined && v !== null;

// El número del negocio, solo dígitos, o '' si no hay. Para recibir pedidos.
export function whatsappDelNegocio(at) {
	if (existe(at?.whatsapp_negocio)) return soloDigitos(at.whatsapp_negocio);
	return soloDigitos(at?.whatsapp_pedidos) || soloDigitos(at?.social_whatsapp);
}

// ¿El restaurante quiere el botón de WhatsApp en la carta? Sin la clave nueva,
// como antes: si había un número en la barra de redes, sí.
export function botonWhatsappActivo(at) {
	if (existe(at?.whatsapp_boton)) return at.whatsapp_boton === true;
	return !!soloDigitos(at?.social_whatsapp);
}

// El número que se ENSEÑA en un botón o enlace: hace falta el número Y que el
// restaurante quiera el botón. '' si no hay nada que enseñar.
export function whatsappParaMostrar(at) {
	return botonWhatsappActivo(at) ? whatsappDelNegocio(at) : '';
}

// ── DIRECCIÓN, UBICACIÓN Y RESEÑAS (paso 2) ───────────────────
// Se pedían en el formulario de la bienvenida y ahora son del negocio. La
// bienvenida conserva sus interruptores y su estilo; el DATO viene de aquí.
//
// `direccion` no cambia de nombre. El mapa y las reseñas tienen clave nueva
// (`mapa_url`, `resena_url`): las de antes llevaban el prefijo de la pantalla que
// las pedía (`intro_mapa_url`, `intro_resena_url`). Las viejas se leen SOLO si la
// nueva no existe, con la misma razón que el WhatsApp: borrar el enlace deja ''
// y eso es «no hay enlace», no «no está».
const texto = v => String(v ?? '').trim();

export function direccionDelNegocio(at) { return texto(at?.direccion); }

export function mapaDelNegocio(at) {
	return existe(at?.mapa_url) ? texto(at.mapa_url) : texto(at?.intro_mapa_url);
}

export function resenaDelNegocio(at) {
	return existe(at?.resena_url) ? texto(at.resena_url) : texto(at?.intro_resena_url);
}

// ── HORARIO DE ATENCIÓN Y CORREO (paso 4) ─────────────────────
// `horario_atencion` es una LISTA DE FRANJAS, cada una con los días a los que vale
// y sus horas: la forma de los horarios de las promociones y de la televisión
// (`dias` de 0 —domingo— a 6, `desde` y `hasta` en 'HH:MM'). Un día que no sale en
// ninguna franja es un día cerrado; sin horas, la franja es «todo el día»; y un
// `hasta` menor que `desde` es un cierre pasada la medianoche.
//
// Por ahora solo se DICE, en una línea de la bienvenida. No decide nada: no hay
// «abierto ahora». Cuando lo haya, tendrá que resolver ese cierre de madrugada.
//
// La misma función está en el panel (public/negocio.js), que la usa para enseñarle
// al restaurante cómo lo leerá el cliente. Las dos corren contra la lista
// `horario` de test/casos-negocio.json, duplicada a propósito en los dos
// repositorios.
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DE_LUNES_A_DOMINGO = [1, 2, 3, 4, 5, 6, 0];

function franjasNormalizadas(lista) {
	return (Array.isArray(lista) ? lista : []).map(f => ({
		dias: [...new Set((Array.isArray(f?.dias) ? f.dias : []).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b),
		desde: typeof f?.desde === 'string' ? f.desde.trim() : '',
		hasta: typeof f?.hasta === 'string' ? f.hasta.trim() : '',
	}));
}

// «Lun a Vie», «Sáb y Dom», «Lun, Mié y Vie», «Todos los días». Los tramos de tres
// días o más se dicen con «a»; los de uno o dos, nombrando cada día.
function textoDias(dias) {
	const orden = DE_LUNES_A_DOMINGO.filter(d => dias.includes(d));
	if (orden.length === 7) return 'Todos los días';
	const tramos = [];
	let actual = [];
	for (const d of orden) {
		const ultimo = actual[actual.length - 1];
		if (actual.length && DE_LUNES_A_DOMINGO.indexOf(d) === DE_LUNES_A_DOMINGO.indexOf(ultimo) + 1) actual.push(d);
		else { if (actual.length) tramos.push(actual); actual = [d]; }
	}
	if (actual.length) tramos.push(actual);
	const partes = [];
	for (const t of tramos) {
		if (t.length >= 3) partes.push(`${DIAS_CORTOS[t[0]]} a ${DIAS_CORTOS[t[t.length - 1]]}`);
		else for (const d of t) partes.push(DIAS_CORTOS[d]);
	}
	return partes.length <= 1 ? (partes[0] || '') : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

// «Lun a Vie 11:00–22:00 · Sáb y Dom 12:00–23:00». Una franja sin días no cuenta;
// con una sola hora puesta se lee como todo el día, que es lo más prudente.
export function textoHorarioAtencion(franjas) {
	const partes = [];
	for (const f of franjasNormalizadas(franjas)) {
		const dias = textoDias(f.dias);
		if (!dias) continue;
		partes.push(`${dias} ${HORA.test(f.desde) && HORA.test(f.hasta) ? `${f.desde}–${f.hasta}` : 'todo el día'}`);
	}
	return partes.join(' · ');
}

// El correo va a un enlace mailto:, así que solo se enseña si tiene aspecto de
// dirección: sin espacios ni comillas, comas, < ni >. El servidor ya lo exige al
// guardar; esto es por si el dato llegó por otro camino (la clave de servicio, o
// una versión anterior del panel).
const CORREO = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;
export function correoDelNegocio(at) {
	const c = texto(at?.correo);
	return CORREO.test(c) && c.length <= 120 ? c : '';
}
