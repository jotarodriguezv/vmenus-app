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
