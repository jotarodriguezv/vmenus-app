// ── QUÉ PROMOCIÓN TOCA AHORA ──────────────────────────────────
// Hasta el 05/09/2026 la promoción era UNA, en columnas de 'restaurantes'.
// Ahora son filas de la tabla 'promociones', cada una con su programación.
//
// Este módulo contesta una sola pregunta —cuál sale ahora mismo— y la contesta
// distinto según quién la haga, porque el popup de la carta y la cartelera del
// televisor no hacen el mismo trabajo:
//
//   El popup      → una vez, al abrir  → elige UNA
//   La cartelera  → en bucle, todo el servicio → entran TODAS
//
// El diseño completo está en adminmenus_restaurantes/docs/promociones.md §4.
//
// OJO: 'tv.html' NO puede importar esto —módulos ES y sintaxis moderna dejan
// negra la pantalla de un televisor viejo— así que tiene su propia copia de la
// misma regla. Las dos se comprueban contra el mismo juego de casos
// (test/casos-programacion.json) justamente para que no se separen: si
// discrepan, la carta dice que el dos por uno del martes está vigente y el
// televisor dice que no, y eso solo se nota los martes.

import { zonaDe, vigenteAhora, tieneProgramacion } from './horarios.js';

// ── LOS DOS NIVELES ───────────────────────────────────────────
// Una promoción es de FONDO (sin programación, vigente siempre) o PROGRAMADA.
// Si hay alguna programada vigente ahora, las de fondo no juegan.
//
// Programar algo para el martes es una decisión SOBRE el martes. Si lo de
// siempre siguiera compitiendo, programar sería una sugerencia — y con el azar
// del popup, el dos por uno lo vería uno de cada tres clientes, que es justo lo
// que el azar venía a evitar.
function porNivel(lista, zona, referencia) {
	const vivas = lista.filter(p => vigenteAhora(p.programacion, zona, referencia));
	const programadas = vivas.filter(p => tieneProgramacion(p.programacion));
	return programadas.length ? programadas : vivas.filter(p => !tieneProgramacion(p.programacion));
}

// ── DE QUÉ SEDE ───────────────────────────────────────────────
// Una promoción puede ser de UNA sede (`sede_id`, sql/39 del panel) o de todas (vacío,
// que es lo de siempre). La de una sede solo sale cuando se mira desde esa sede: un
// «2x1 en Bucaramanga» no puede aparecerle a quien está en Piedecuesta, y menos con
// su precio. Fuera de una sede concreta —un restaurante sin sedes, o con el interruptor
// apagado— una promoción atada a una sede NO sale: está dirigida, y enseñarla a todos
// sería el error que esto evita. (Apagar «Varias sedes» las esconde, no las borra.)
export function deLaSede(promo, sede) {
	return !promo.sede_id || (!!sede && promo.sede_id === sede.id);
}

// Las que podrían salir en una superficie, antes de mirar el reloj. Sin imagen
// no hay promoción: es lo único que la pantalla enseña seguro.
//
// La sede se filtra AQUÍ, antes de los niveles, por lo mismo que la superficie: si una
// promoción programada para Bucaramanga compitiera en Piedecuesta, le quitaría el
// turno a la de fondo de Piedecuesta sin enseñarse nunca. Quedarse callado por algo
// que no era para esa sede sería un silencio sin explicación.
function candidatas(promos, donde, sede) {
	return (promos || []).filter(p => p && p.activa && p.imagen_url && p[donde] && deLaSede(p, sede));
}

// ── EL POPUP DE LA CARTA ──────────────────────────────────────
// Elige UNA, al azar por defecto.
//
// El azar no es un capricho: el comensal escanea el QR una vez y no vuelve. Con
// un orden fijo, la segunda promoción no la vería nadie — no es que se viera
// menos, es que no se vería.
//
// El filtro por superficie va ANTES que los niveles a propósito. Si una
// promoción programada solo va al televisor, el popup tiene que seguir
// enseñando la de fondo: quedarse callado por algo que no era para él sería un
// silencio sin explicación.
export function paraElPopup(promos, restaurante, referencia, azar = Math.random) {
	const elegibles = porNivel(candidatas(promos, 'en_popup', restaurante?.sede), zonaDe(restaurante), referencia);
	if (!elegibles.length) return null;
	// Math.random() nunca devuelve 1, pero un 'azar' de prueba sí puede: el
	// respaldo evita que un caso límite devuelva undefined.
	return elegibles[Math.floor(azar() * elegibles.length)] || elegibles[0];
}

// ── LA CARTELERA ──────────────────────────────────────────────
// Entran todas las vigentes, en su orden. No lo usa tv.html —que tiene su
// copia— sino la vista previa del panel y las pruebas: tener la regla escrita
// una vez aquí es lo que permite comprobar que la copia no se ha desviado.
export function paraLaCartelera(promos, restaurante, referencia) {
	return porNivel(candidatas(promos, 'en_tv', restaurante?.sede), zonaDe(restaurante), referencia)
		.slice()
		.sort((a, b) => (a.orden || 0) - (b.orden || 0));
}
