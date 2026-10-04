// ── SEDES ─────────────────────────────────────────────────────
// Un restaurante con varios locales que comparten carta pero no precios (sql/37
// del panel, docs/sedes.md). Aquí vive la regla; el loader solo la llama y
// selector-sedes.js pinta la pantalla de elegir.
//
// ── LA IDEA ───────────────────────────────────────────────────
// La carta NO se entera de las sedes. Al entrar por una, el loader le entrega
// el restaurante y los platos ya transformados —datos del negocio de esa sede
// por encima, precios y disponibilidad de esa sede por encima— y todo lo demás
// (el carrito, la bienvenida, los cinco temas, el buscador) sigue leyendo los
// mismos campos de siempre. Por eso son funciones puras que devuelven copias y
// no tocan nada: es lo que las hace fáciles de probar y de desechar.
//
// Un restaurante sin sedes no pasa por nada de esto, y su carta es la de ayer.

import { formatoPesos } from './ofertas.js';

// Hosts que son la plataforma misma, no un restaurante. Lo usa leerRuta().
export const SUBDOMINIOS_RESERVADOS = ['menu', 'www', 'admin', 'app', 'api'];

// ── LA URL ────────────────────────────────────────────────────
// Las dos formas conviven, y cada una lleva la sede en el trozo siguiente:
//   menu.vmenus.co/enchulados/bucaramanga   → slug 'enchulados', sede 'bucaramanga'
//   enchulados.vmenus.co/bucaramanga        → lo mismo
// Un restaurante sin sedes ignora el segundo trozo, así que /bonzas/lo-que-sea
// sigue abriendo la carta de Bonzas, como hasta hoy.
export function leerRuta(host, pathname) {
	const trozos = String(pathname || '').split('/').filter(Boolean);
	const partes = String(host || '').split('.');
	// Dominio desnudo (vmenus.co), localhost o una IP: no hay subdominio que
	// leer, así que el restaurante va en la ruta.
	const sinSubdominio = /^\d+\.\d+\.\d+\.\d+$/.test(host) || partes.length < 3
		|| SUBDOMINIOS_RESERVADOS.includes(partes[0]);
	if (sinSubdominio) return { slug: trozos[0] || '', sedeSlug: trozos[1] || '' };
	return { slug: partes[0], sedeSlug: trozos[0] || '' };
}

// La sede que nombra la URL, o null: sin sedes, sin trozo, o un trozo que no es
// de ninguna (se tratará como «hay que elegir», no como un error).
export function sedeDeLaUrl(sedes, sedeSlug) {
	if (!Array.isArray(sedes) || !sedes.length || !sedeSlug) return null;
	const buscada = String(sedeSlug).toLowerCase();
	return sedes.find(s => s.slug === buscada) || null;
}

// ── LOS DATOS DEL NEGOCIO DE LA SEDE ──────────────────────────
// Solo estas claves se dejan pasar por encima de las del restaurante: son los
// datos que cambian de un local a otro (negocio.js). Una lista cerrada y no «lo
// que traiga la sede» para que una sede nunca pueda pisar colores, fuentes ni
// CSS del restaurante, aunque alguien escribiera ahí lo que no debe.
export const CLAVES_DE_SEDE = [
	'direccion', 'mapa_url', 'resena_url',
	'whatsapp_negocio', 'whatsapp_boton',
	'horario_atencion', 'correo',
];

// El restaurante tal como lo ve quien entra por esa sede. Una clave que la sede
// NO trae se hereda; una que trae vacía ('') se respeta, porque en negocio.js
// '' es «no hay», y heredar el del restaurante resucitaría un dato que la sede
// no tiene (otro local, otro teléfono).
export function restauranteDeLaSede(restaurante, sede) {
	if (!sede) return restaurante;
	const propios = {};
	for (const k of CLAVES_DE_SEDE)
		if (sede.atributos && sede.atributos[k] !== undefined && sede.atributos[k] !== null) propios[k] = sede.atributos[k];
	return {
		...restaurante,
		// El nombre lleva la sede: es lo que sale en el encabezado, en la pestaña y
		// en el pedido que le llega al restaurante por WhatsApp, donde saber de qué
		// local viene es justo lo que hace falta.
		nombre: `${restaurante.nombre} · ${sede.nombre}`,
		atributos: { ...(restaurante.atributos || {}), ...propios },
		sede: { id: sede.id, slug: sede.slug, nombre: sede.nombre },
	};
}

// ── PRECIOS Y DISPONIBILIDAD DE LA SEDE ───────────────────────
// `filas` son las de productos_sedes de esta sede: solo lo que CAMBIA. Sin fila,
// el plato queda como está. Con fila:
//   disponible === false → el plato no se sirve aquí, se quita.
//   precio_numerico      → manda sobre el base; el texto (`precio`) viaja con él.
//
// Si la sede cambia el precio, la oferta del plato se apaga en esa sede: la
// oferta es un precio MENOR que el base y se calculó contra él. Con otro precio
// base en la sede quedaría una rebaja de otro local —o un tachado que no
// corresponde—. Ofertas por sede es de más adelante (docs/sedes.md).
export function productosDeLaSede(productos, filas) {
	const porPlato = new Map((filas || []).map(f => [f.producto_id, f]));
	const salida = [];
	for (const p of productos) {
		const f = porPlato.get(p.id);
		if (!f) { salida.push(p); continue; }
		if (f.disponible === false) continue;
		const hayPrecio = f.precio_numerico !== null && f.precio_numerico !== undefined;
		if (!hayPrecio) { salida.push(p); continue; }
		const numero = Number(f.precio_numerico);
		if (!Number.isFinite(numero)) { salida.push(p); continue; }
		salida.push({
			...p,
			precio_numerico: numero,
			precio: String(f.precio ?? '').trim() || formatoPesos(numero),
			oferta_activa: false,
		});
	}
	return salida;
}

// El servidor ya ordenó por el precio BASE, y con precios de sede ese orden
// puede quedar mal (un plato más barato en una sede que en otra). Se reordena
// solo si el restaurante ordena por precio; el alfabético y el manual no
// dependen del precio. `orden` es atributos.orden_productos; ausente es de
// menor a mayor, como en el loader.
export function reordenarSiEsPorPrecio(productos, orden) {
	const modo = orden || 'precio_asc';
	if (modo !== 'precio_asc' && modo !== 'precio_desc') return productos;
	const signo = modo === 'precio_desc' ? -1 : 1;
	// sort() es estable: los empates conservan el orden que trajo el servidor.
	return [...productos].sort((a, b) => signo * (Number(a.precio_numerico) - Number(b.precio_numerico)));
}

// Si quitar platos dejó una categoría sin ninguno, se quita con ellos: una
// pestaña que abre una lista vacía es peor que no tenerla. Solo las que la SEDE
// vació; una categoría que ya estaba vacía antes se queda como estaba.
export function categoriasDeLaSede(categorias, productosBase, productosSede) {
	const conPlatosAntes = new Set(productosBase.map(p => p.categoria_id));
	const conPlatosAhora = new Set(productosSede.map(p => p.categoria_id));
	return categorias.filter(c => !conPlatosAntes.has(c.id) || conPlatosAhora.has(c.id));
}

// A dónde lleva el botón de una sede: conserva la forma de URL con la que entró
// el visitante, para no sacarlo de bonzas.vmenus.co hacia menu.vmenus.co.
export function rutaDeSede(host, slug, sedeSlug) {
	const partes = String(host || '').split('.');
	const sinSubdominio = /^\d+\.\d+\.\d+\.\d+$/.test(host) || partes.length < 3
		|| SUBDOMINIOS_RESERVADOS.includes(partes[0]);
	return sinSubdominio ? `/${slug}/${sedeSlug}` : `/${sedeSlug}`;
}
