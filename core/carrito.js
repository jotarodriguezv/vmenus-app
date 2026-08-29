// ── CARRITO ───────────────────────────────────────────────────
// El carrito de compras: estado, guardado en el navegador, personalización
// por toppings, checkout y envío por WhatsApp.
//
// Vivía entero dentro de temas/carrito.js. Se sacó aquí cuando el modelo de
// video también quiso carrito: la alternativa era copiar seiscientas líneas
// a otro tema, y eso ya nos costó un fallo una vez — el escapado de HTML
// vivía dentro de temas/explorar.js y los demás temas se quedaron sin él.
// Por eso existen core/html.js y core/carrusel.js, y por eso existe este.
//
// Lo que NO está aquí es cómo se pinta el catálogo: cada tema dibuja sus
// platos como quiera y llama a agregarSimple() u openCustomModal(). El
// marcado del carrito (barra lateral, checkout, modal de personalización)
// vive en index.html y lo comparten todos.
//
// Aquí se toca dinero. Un fallo no rompe la página: hace que al restaurante
// le llegue un pedido con el precio equivocado.

import { restaurante, productos, soloDigitos } from './menu.js';
import { trackAgregarCarrito } from './analytics.js';
import { esc, escUrl } from './html.js';

// ── CATÁLOGO DE MÉTODOS DE PAGO ─────────────────────────────────
// El restaurante activa/desactiva cada uno y llena sus datos desde
// la pestaña "Pedidos" del panel (atributos.metodos_pago).
const METODOS_PAGO_CATALOGO = {
	efectivo:    { label: 'Efectivo' },
	tarjeta:     { label: 'Tarjeta (datáfono al entregar)' },
	nequi:       { label: 'Nequi', detalle: m => `Nequi: ${m.telefono} — a nombre de ${m.titular}` },
	daviplata:   { label: 'Daviplata', detalle: m => `Daviplata: ${m.telefono} — a nombre de ${m.titular}` },
	bancolombia: { label: 'Transferencia bancaria', detalle: m => `Cuenta ${m.tipo_cuenta} No. ${m.numero_cuenta} — a nombre de ${m.titular}` },
	breb:        { label: 'Llave Bre-B', detalle: m => `Llave Bre-B: ${m.llave}` }
};

let cart = [];
let customProduct = null;
let customOpciones = { platino: [], premium: [], salsas: [] };
let customEditingKey = null;
let customQty = 1;
let selectedPlatino = new Set();
let selectedPremium = new Set();
let selectedSalsas  = new Set();

// ── QUÉ OFRECE CADA PLATO ─────────────────────────────────────
// El catálogo de toppings vive en el restaurante y cada plato dice cuáles
// de sus elementos ofrece. Antes cada plato llevaba una COPIA del catálogo
// con los precios dentro, y eso costaba dos cosas:
//
//   · Un plato nuevo nacía sin nada. El panel guardaba el catálogo en el
//     restaurante y nadie hacía la copia, así que todo producto creado
//     después de la carga inicial no admitía toppings — en silencio.
//
//   · Cambiar un precio en el catálogo no cambiaba lo que pagaba el
//     cliente. La copia del plato seguía diciendo el precio viejo, el panel
//     decía que había guardado, y nadie se enteraba.
//
// Guardando una referencia al catálogo, el precio sale siempre de él y un
// topping borrado desaparece solo de los platos que lo ofrecían.
//
// Esa referencia era el NOMBRE, y ahí quedaba la última esquina del mismo
// problema: renombrar un topping en el panel dejaba a los platos apuntando a
// algo que ya no existe. El chip salía desmarcado, el carrito no sabía
// cobrarlo, y nada avisaba. Por eso cada elemento del catálogo lleva ahora un
// identificador propio, que no cambia aunque cambie el nombre.

// ── EL CATÁLOGO, EN UNA SOLA FORMA ────────────────────────────
// El catálogo se ha guardado de tres maneras distintas a lo largo del
// tiempo: platino y salsas como cadenas sueltas, premium como objeto con
// precio, y ahora los tres como objeto con identificador. Aquí se traducen
// todas a la misma, para que el resto del archivo no tenga que preguntar de
// qué época es cada dato.
//
// La clave está en 'it.id || nombre': un elemento sin identificador usa su
// nombre como tal. Eso es lo que hace que un plato guardado con nombres y un
// catálogo ya migrado se sigan encontrando, y al revés — sin lo cual la
// migración tendría que ser simultánea en la base, el panel, las cartas y el
// carrito que alguien tenga abierto en el móvil, que es imposible.
export function catalogoDe(attr) {
	const norm = (lista, conPrecio) => (Array.isArray(lista) ? lista : []).map(it => {
		const obj = (it && typeof it === 'object') ? it : { nombre: it };
		const nombre = String(obj.nombre ?? '').trim();
		if (!nombre) return null;
		const base = { id: String(obj.id || nombre), nombre };
		return conPrecio ? { ...base, precio: Number(obj.precio) || 0 } : base;
	}).filter(Boolean);

	return {
		platino: norm(attr?.toppings_platino, false),
		premium: norm(attr?.toppings_premium, true),
		salsas:  norm(attr?.salsas, false),
	};
}

// ¿Está este elemento del catálogo entre los marcados? Acepta identificador
// o nombre a propósito: los platos y los carritos guardados antes de la
// migración solo tienen el nombre, y descartarlos sería quitarle toppings a
// un pedido a medias sin decir nada.
function marcadoPor(seleccion) {
	const s = new Set((Array.isArray(seleccion) ? seleccion : []).map(String));
	return t => s.has(t.id) || s.has(t.nombre);
}

function opcionesDe(p) {
	const sel = p?.atributos?.personalizacion;

	// Platos de antes de que el catálogo subiera al restaurante: llevan su
	// propia copia dentro. No queda ninguno en la base, pero leerla cuesta una
	// línea y no leerla les quitaría los toppings sin avisar.
	if (!sel) return catalogoDe(p?.atributos);

	const cat = catalogoDe(restaurante?.atributos);
	return {
		platino: cat.platino.filter(marcadoPor(sel.platino)),
		premium: cat.premium.filter(marcadoPor(sel.premium)),
		salsas:  cat.salsas.filter(marcadoPor(sel.salsas)),
	};
}

function addSimpleToCart(p) {
	trackAgregarCarrito(restaurante?.id, p.id);
	const existing = cart.find(i => i.cartKey === p.id);
	if (existing) existing.cantidad++;
	// 'extras' guarda aparte lo que suman los toppings, para poder recalcular
	// el precio contra el menú de hoy sin perder el recargo. Un producto
	// simple no lleva ninguno.
	else cart.push({ cartKey: p.id, id: p.id, name: p.nombre, price: p.precio_numerico, extras: 0, cantidad: 1, descripcion: '' });
	saveCartToStorage();
	updateCartUI();
}

// ── MODAL DE PERSONALIZACIÓN ────────────────────────────────────
function openCustomModal(productId, editingCartKey = null) {
	const p = productos.find(pr => pr.id === productId);
	if (!p) return;
	customProduct = p;
	customEditingKey = editingCartKey;

	// El catálogo del plato se calcula ANTES de leer la selección guardada, y
	// no al revés como estaba: leerla es traducir nombres a identificadores, y
	// para eso hace falta saber contra qué se traduce.
	customOpciones = opcionesDe(p);

	if (editingCartKey) {
		const item = cart.find(i => i.cartKey === editingCartKey);
		customQty = item ? item.cantidad : 1;
		({ platino: selectedPlatino, premium: selectedPremium, salsas: selectedSalsas } =
			leerSeleccion(item, customOpciones));
	} else {
		customQty = 1;
		selectedPlatino = new Set();
		selectedPremium = new Set();
		selectedSalsas  = new Set();
	}

	document.getElementById('customName').textContent = p.nombre;
	document.getElementById('customBasePrice').textContent = `Precio base: ${p.precio}`;
	updateCustomQtyUI();
	document.getElementById('btnAgregarCarrito').textContent = editingCartKey ? '✏ GUARDAR CAMBIOS' : '🛒 AGREGAR AL CARRITO';

	// Los tres grupos se marcan por identificador. El nombre solo se pinta.
	fillChipSection('secToppingsPlatino', 'listToppingsPlatino', customOpciones.platino,
		t => t.nombre, selectedPlatino,
		t => toggleInSet(selectedPlatino, t.id), t => t.id);
	fillChipSection('secToppingsPremium', 'listToppingsPremium', customOpciones.premium,
		t => `${t.nombre} (+$${t.precio.toLocaleString('es-CO')})`, selectedPremium,
		t => toggleInSet(selectedPremium, t.id), t => t.id);
	fillChipSection('secSalsas', 'listSalsas', customOpciones.salsas,
		s => s.nombre, selectedSalsas,
		s => toggleInSet(selectedSalsas, s.id), s => s.id);

	updateCustomTotal();

	document.getElementById('customOverlay').classList.add('open');
	document.body.style.overflow = 'hidden';
}

function toggleInSet(set, key) {
	if (set.has(key)) set.delete(key); else set.add(key);
	updateCustomTotal();
}

function fillChipSection(secId, listId, items, label, selectedSet, onToggle, keyOf) {
	const sec = document.getElementById(secId);
	const list = document.getElementById(listId);
	list.innerHTML = '';
	if (!items?.length) { sec.style.display = 'none'; return; }
	sec.style.display = 'block';
	items.forEach(item => {
		const key = keyOf ? keyOf(item) : item;
		const chip = document.createElement('button');
		chip.type = 'button';
		chip.className = 'custom-chip' + (selectedSet.has(key) ? ' active' : '');
		chip.textContent = label(item);
		chip.onclick = () => { onToggle(item); chip.classList.toggle('active'); };
		list.appendChild(chip);
	});
}

function updateCustomQtyUI() {
	document.getElementById('customQty').textContent = customQty;
	updateCustomTotal();
}

// Recargo de los toppings premium marcados. Está aquí y no repetido en los
// dos sitios que lo usan —el total del modal y el alta en el carrito— porque
// si divergen, al cliente se le enseña un precio y se le cobra otro.
//
// Se suma una sola vez por elemento: si el catálogo trae dos entradas con el
// mismo identificador, casarían las dos y el cliente pagaría el recargo doble
// habiéndolo marcado una vez. El panel ya impide crear duplicados, pero los
// que pudieran estar guardados no deben cobrar de más.
//
// Recibe la lista premium ya normalizada por catalogoDe, no los atributos
// crudos: así hay un solo sitio en el archivo que sabe de qué forma vienen
// los datos. 'marcados' se puede pasar en las pruebas; en producción son los
// toppings que el cliente tiene seleccionados ahora mismo en el modal.
export function recargoPremium(premium, marcados = selectedPremium) {
	const yaSumados = new Set();
	const esta = marcadoPor([...(marcados || [])]);
	return (Array.isArray(premium) ? premium : []).reduce((sum, t) => {
		if (!esta(t) || yaSumados.has(t.id)) return sum;
		yaSumados.add(t.id);
		return sum + (Number(t.precio) || 0);
	}, 0);
}

// ── LA SELECCIÓN, DE IDA Y VUELTA ─────────────────────────────
// Un plato personalizado guarda en el carrito un texto legible con lo que
// lleva ("Toppings: Queso, Doritos | Premium: Tocineta"), y ese texto es el
// que se le manda al restaurante por WhatsApp. Hasta aquí, bien.
//
// El problema estaba en volver atrás: al pulsar "editar" sobre una línea del
// carrito, la selección se reconstruía LEYENDO ese texto, partiéndolo por
// ', '. Funciona mientras ningún topping lleve una coma en el nombre — y eso
// no lo impide nadie. "Salsa de la casa, picante" se parte en dos nombres que
// no existen en el catálogo, así que al abrir el modal no aparece ninguno
// marcado; y si el cliente guarda, la línea vuelve al carrito SIN el recargo.
//
// Nadie ve un error: el pedido llega bien escrito y con el precio de menos.
//
// Se arregla guardando la selección aparte, como listas, y usando el texto
// solo para lo que es: leerlo. 'leerSeleccion' sigue entendiendo el texto
// para los carritos que ya estaban guardados en el navegador de alguien
// cuando esto cambió.
//
// El texto se arma con los NOMBRES de lo elegido, no con lo que se guarda:
// desde que la selección son identificadores, mandar lo guardado tal cual le
// enviaría al restaurante un pedido de "top_9f21c4a3, top_be0517dd".
export function describirSeleccion({ platino = [], premium = [], salsas = [] }) {
	const nombres = lista => (lista || []).map(t => (t && typeof t === 'object') ? t.nombre : t);
	const partes = [];
	if (platino.length) partes.push(`Toppings: ${nombres(platino).join(', ')}`);
	if (premium.length) partes.push(`Premium: ${nombres(premium).join(', ')}`);
	if (salsas.length)  partes.push(`Salsas: ${nombres(salsas).join(', ')}`);
	return partes.join(' | ');
}

// Devuelve conjuntos de IDENTIFICADORES, siempre, venga de donde venga lo
// guardado. Es el único sitio del archivo que traduce, y por eso recibe el
// catálogo del plato: un carrito guardado ayer trae nombres, uno de hoy trae
// identificadores, y el resto del código no debería tener que distinguirlos.
//
// Lo que ya no está en el catálogo se cae aquí. Es lo correcto: un topping
// que el restaurante borró no se puede ni cobrar ni preparar.
export function leerSeleccion(item, opciones = null) {
	const cat = opciones || { platino: [], premium: [], salsas: [] };
	const aIds = (guardado, disponibles) => {
		const esta = marcadoPor(guardado);
		return new Set((disponibles || []).filter(esta).map(t => t.id));
	};

	// Camino normal: lo guardado tal cual se eligió, sin interpretar nada.
	const sel = item?.sel;
	if (sel && typeof sel === 'object') return {
		platino: aIds(sel.platino, cat.platino),
		premium: aIds(sel.premium, cat.premium),
		salsas:  aIds(sel.salsas,  cat.salsas),
	};

	// Carritos de antes de que se guardara la selección aparte: solo tienen el
	// texto. Se lee como se leía, con su límite conocido —un nombre con coma no
	// se recupera—, porque la alternativa es perderles la línea entera.
	const desc = item?.descripcion || '';
	const trozo = etiqueta => {
		const m = desc.match(new RegExp(`${etiqueta}: ([^|]+)`));
		return m ? m[1].trim().split(', ') : [];
	};
	return {
		platino: aIds(trozo('Toppings'), cat.platino),
		premium: aIds(trozo('Premium'),  cat.premium),
		salsas:  aIds(trozo('Salsas'),   cat.salsas),
	};
}

function updateCustomTotal() {
	if (!customProduct) return;
	const extras = recargoPremium(customOpciones.premium);
	const total = (customProduct.precio_numerico + extras) * customQty;
	document.getElementById('customTotal').textContent = '$' + total.toLocaleString('es-CO');
}

function closeCustomModal() {
	document.getElementById('customOverlay').classList.remove('open');
	document.body.style.overflow = '';
}

function addCustomToCart() {
	if (!customProduct) return;
	const extras = recargoPremium(customOpciones.premium);
	const precioUnit = customProduct.precio_numerico + extras;

	// Lo elegido, como objetos del catálogo. Mismo ayudante que usa la
	// revalidación, para que dar de alta una línea y recalcularla después no
	// puedan divergir.
	const elegidos = elegidosDe(customOpciones,
		{ platino: selectedPlatino, premium: selectedPremium, salsas: selectedSalsas });
	const sel = {
		platino: elegidos.platino.map(t => t.id),
		premium: elegidos.premium.map(t => t.id),
		salsas:  elegidos.salsas.map(t => t.id),
	};
	const descripcion = describirSeleccion(elegidos);
	const cartKey = `${customProduct.id}__${descripcion}`;

	// Solo cuando se añade de verdad. Al editar uno que ya estaba en el
	// carrito no se registra: sería contar dos veces el mismo interés.
	if (!customEditingKey) trackAgregarCarrito(restaurante?.id, customProduct.id);

	if (customEditingKey) cart = cart.filter(i => i.cartKey !== customEditingKey);

	const existing = cart.find(i => i.cartKey === cartKey);
	if (existing) existing.cantidad += customQty;
	// 'sel' viaja junto a 'descripcion': el texto es para leerlo y esto es
	// para volver a abrirlo. Antes había solo lo primero y se usaba para las
	// dos cosas.
	else cart.push({ cartKey, id: customProduct.id, name: customProduct.nombre, price: precioUnit, extras, cantidad: customQty, descripcion, sel });

	customEditingKey = null;
	saveCartToStorage();
	updateCartUI();
	closeCustomModal();
}

// ── CARRITO ──────────────────────────────────────────────────
function storageKey() { return `${restaurante?.slug || 'vmenus'}_cart`; }

// El carrito guardado se versiona: si el formato cambia, se descarta en vez
// de intentar interpretar algo que ya no encaja. Un carrito es efímero; vale
// más perderlo una vez que enviar un pedido mal calculado.
const CART_VERSION = 2;

// Un carrito de comida es una intención del momento. Alguien que mira el menú
// a media tarde para pedir en la noche sigue siendo el mismo pedido, así que
// el plazo tiene que cubrir eso; uno de hace tres días ya no lo es y solo
// genera confusión al reaparecer. Pasado el plazo se descarta en silencio:
// avisar de algo que el cliente ya olvidó no aporta nada.
const CART_TTL_MS = 24 * 60 * 60 * 1000;

// Momento en que el CLIENTE tocó el carrito por última vez. El plazo corre
// desde ahí y no desde que se creó, para que ir añadiendo cosas a lo largo de
// la tarde no lo caduque a media compra.
let cartTs = Date.now();

// 'refrescar' separa lo que hace el cliente de lo que hace el sistema: cuando
// el carrito se guarda solo porque se revalidó al abrir, el plazo no se
// reinicia. Si no, bastaría con abrir el menú para que no caducara nunca.
function saveCartToStorage(refrescar = true) {
	if (refrescar) cartTs = Date.now();
	localStorage.setItem(storageKey(), JSON.stringify({ v: CART_VERSION, ts: cartTs, items: cart }));
}

// ── REVALIDAR EL CARRITO GUARDADO ─────────────────────────────
// El carrito vive en el navegador del cliente y puede reaparecer días
// después. Sin cruzarlo con el menú de hoy, el pedido sale con el precio que
// tenía cuando se añadió y con productos que quizá ya no existen: al
// restaurante le llega un pedido que no puede cumplir al precio que dice.
//
// 'productos' ya viene cargado y filtrado (solo disponibles, y solo los de
// categorías dentro de su franja horaria), así que sirve de fuente de verdad.
export function revalidarCarrito(guardado) {
	const vivos = [], retirados = [], reprecio = [];

	for (const item of guardado) {
		const p = productos.find(pr => pr.id === item.id);
		// No está en el menú de ahora: agotado, borrado o fuera de horario.
		if (!p) { retirados.push(item.name); continue; }

		// El recargo se RECALCULA contra el catálogo de hoy; antes se cogía de
		// lo guardado (`Number(item.extras) || 0`) y ahí se colaba el mismo fallo
		// que motivó subir el catálogo al restaurante: el precio base se
		// refrescaba y el de los toppings no. Tocineta pasaba de $4.000 a $6.000
		// y un carrito de ayer seguía cobrando $4.000, con el pedido llegándole
		// al restaurante por el total viejo.
		//
		// Se puede hacer desde que la selección se guarda por identificador: 'sel'
		// dice qué toppings lleva la línea, y el precio sale del catálogo.
		//
		// Solo se recalcula si la línea trae de dónde: 'sel' o, en carritos de
		// antes de que existiera, el texto. Sin ninguna de las dos no hay base
		// para decir que el recargo es cero —no saber no es saber que no—, y
		// ponerlo a cero le cobraría de menos al restaurante. En ese caso se
		// conserva lo guardado, que es lo único que se sabe.
		const personalizada = !!(item.sel || item.descripcion);
		const opciones = personalizada ? opcionesDe(p) : null;
		const elegidos = personalizada ? elegidosDe(opciones, leerSeleccion(item, opciones)) : null;
		const extras = personalizada
			? recargoPremium(opciones.premium, new Set(elegidos.premium.map(t => t.id)))
			: (Number(item.extras) || 0);
		const precioHoy = p.precio_numerico + extras;

		if (precioHoy !== item.price) {
			reprecio.push({ nombre: p.nombre, antes: item.price, ahora: precioHoy });
			item.price = precioHoy;
		}
		item.extras = extras;
		item.name = p.nombre;   // el nombre también pudo cambiar en el panel

		// La selección y su texto se reescriben con el catálogo de hoy. Renombrar
		// un topping es una operación admitida desde que hay identificadores, así
		// que un carrito dormido no puede mandarle al restaurante por WhatsApp un
		// nombre que ya nadie usa. Un topping borrado se cae aquí, y como el
		// recargo se recalculó, el precio ya no lo cobra.
		if (personalizada) {
			item.sel = {
				platino: elegidos.platino.map(t => t.id),
				premium: elegidos.premium.map(t => t.id),
				salsas:  elegidos.salsas.map(t => t.id),
			};
			item.descripcion = describirSeleccion(elegidos);
			// La clave lleva la descripción dentro, así que hay que rehacerla o dos
			// líneas distintas dejarían de distinguirse al sumar cantidades.
			item.cartKey = `${item.id}__${item.descripcion}`;
		}

		// Si al reescribir dos líneas quedaron iguales —dos toppings que se
		// fundieron en uno, o uno borrado que las igualó— se juntan en vez de
		// dejar dos filas idénticas que el cliente no sabe distinguir.
		const gemela = vivos.find(v => v.cartKey === item.cartKey);
		if (gemela) gemela.cantidad += item.cantidad;
		else vivos.push(item);
	}
	return { vivos, retirados, reprecio };
}

// Los objetos del catálogo que corresponden a una selección de identificadores.
// Lo usan el alta en el carrito y la revalidación, y de ahí salen a la vez los
// identificadores que se guardan y los nombres que se escriben: sacarlos del
// mismo sitio es lo que evita que la línea diga una cosa y cobre otra.
function elegidosDe(opciones, sets) {
	return {
		platino: opciones.platino.filter(t => sets.platino.has(t.id)),
		premium: opciones.premium.filter(t => sets.premium.has(t.id)),
		salsas:  opciones.salsas.filter(t => sets.salsas.has(t.id)),
	};
}

function avisarCambiosCarrito({ retirados, reprecio }) {
	if (!retirados.length && !reprecio.length) return;
	const cont = document.getElementById('cartItems');
	if (!cont) return;

	const bloques = [];
	if (reprecio.length) {
		bloques.push(`<div><strong>${reprecio.length === 1 ? 'Un producto cambió de precio' : reprecio.length + ' productos cambiaron de precio'}</strong></div>`
			+ reprecio.map(r => `<div style="opacity:.85">${esc(r.nombre)}: $${r.antes.toLocaleString('es-CO')} → $${r.ahora.toLocaleString('es-CO')}</div>`).join(''));
	}
	if (retirados.length) {
		bloques.push(`<div><strong>${retirados.length === 1 ? 'Quitamos un producto que ya no está disponible' : 'Quitamos ' + retirados.length + ' productos que ya no están disponibles'}</strong></div>`
			+ retirados.map(n => `<div style="opacity:.85">${esc(n)}</div>`).join(''));
	}

	const aviso = document.createElement('div');
	aviso.className = 'cart-aviso';
	aviso.style.cssText = 'background:rgba(255,176,32,.12);border:1px solid rgba(255,176,32,.45);border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12px;line-height:1.5;color:var(--text)';
	aviso.innerHTML = `<div style="margin-bottom:6px">🛈 Tu carrito se actualizó desde tu última visita</div>${bloques.join('<div style="height:6px"></div>')}`;
	cont.insertAdjacentElement('afterbegin', aviso);
}

export function loadCartFromStorage() {
	let guardado;
	try {
		const raw = localStorage.getItem(storageKey());
		if (!raw) return;
		const datos = JSON.parse(raw);
		// Formato anterior (un array suelto, sin 'extras'): no se puede
		// recalcular el precio de un producto personalizado sin saber cuánto
		// sumaban sus toppings, así que se descarta.
		if (!datos || datos.v !== CART_VERSION || !Array.isArray(datos.items)) {
			localStorage.removeItem(storageKey());
			return;
		}
		guardado = datos.items;
		// Los carritos guardados antes de que existiera la marca de tiempo no
		// llevan 'ts'. Se toman como recientes en vez de borrarlos: el cliente
		// no tiene por qué pagar un cambio de formato con su pedido.
		cartTs = Number(datos.ts) || Date.now();
	} catch {
		localStorage.removeItem(storageKey());
		return;
	}

	if (Date.now() - cartTs > CART_TTL_MS) {
		localStorage.removeItem(storageKey());
		cart = [];
		cartTs = Date.now();
		return;
	}

	const { vivos, retirados, reprecio } = revalidarCarrito(guardado);
	cart = vivos;
	// Se persiste ya corregido: si el cliente cierra sin pedir, la próxima
	// visita arranca del estado bueno y no repite el mismo aviso. Sin
	// refrescar el plazo: esto lo hace el sistema, no el cliente.
	if (retirados.length || reprecio.length) saveCartToStorage(false);
	updateCartUI();
	avisarCambiosCarrito({ retirados, reprecio });
}

function updateQuantity(cartKey, change) {
	const item = cart.find(i => i.cartKey === cartKey);
	if (!item) return;
	item.cantidad += change;
	if (item.cantidad <= 0) cart = cart.filter(i => i.cartKey !== cartKey);
	saveCartToStorage();
	updateCartUI();
}

function removeFromCart(cartKey) {
	cart = cart.filter(i => i.cartKey !== cartKey);
	saveCartToStorage();
	updateCartUI();
}

function updateCartUI() {
	const count = cart.reduce((sum, i) => sum + i.cantidad, 0);
	// Dos contadores porque hay dos botones: el de la cabecera fija del modelo
	// 'carrito' y el flotante de los temas que no tienen cabecera. Cada tema
	// enseña el suyo; aquí se actualizan los dos sin preguntar cuál existe.
	const cartCount = document.getElementById('cartCount');
	if (cartCount) cartCount.textContent = count;
	const fabCount = document.getElementById('cartFabCount');
	if (fabCount) fabCount.textContent = count;

	const itemsDiv = document.getElementById('cartItems');
	const emptyDiv = document.getElementById('cartEmpty');
	const checkoutBtn = document.getElementById('checkoutBtn');
	if (!itemsDiv) return;

	if (!cart.length) {
		itemsDiv.innerHTML = '';
		emptyDiv.style.display = 'flex';
		checkoutBtn.style.display = 'none';
	} else {
		emptyDiv.style.display = 'none';
		checkoutBtn.style.display = 'block';
		itemsDiv.innerHTML = '';
		cart.forEach(item => {
			const prod = productos.find(p => p.id === item.id);
			// El botón "Editar" de la línea. Preguntaba por la COPIA del
			// catálogo dentro del plato —toppings_platino y compañía—, que
			// desapareció cuando el catálogo subió al restaurante: desde
			// entonces esto era falso para todos los platos de todas las cartas
			// y el botón no salía nunca. La maquinaria de reabrir una línea
			// estaba entera y no había forma de llegar a ella.
			const tieneOpc = prod ? tienePersonalizacion(prod) : false;

			const div = document.createElement('div');
			div.className = 'cart-item';
			div.innerHTML = `
			<div class="cart-item-info">
				<div class="cart-item-name">${esc(item.name)}</div>
				${item.descripcion ? `<div class="cart-item-desc">${esc(item.descripcion)}</div>` : ''}
				<div class="cart-item-price">$${(item.price * item.cantidad).toLocaleString('es-CO')}</div>
			</div>
			<div class="cart-item-side">
				${tieneOpc ? '<button class="btn-edit-cart">✏ Editar</button>' : ''}
				<div class="cart-item-controls">
					<button class="cart-item-btn" data-act="minus">−</button>
					<div class="cart-item-qty">${item.cantidad}</div>
					<button class="cart-item-btn" data-act="plus">+</button>
					<button class="cart-item-remove">✕</button>
				</div>
			</div>`;
			div.querySelector('[data-act="minus"]').onclick = () => updateQuantity(item.cartKey, -1);
			div.querySelector('[data-act="plus"]').onclick  = () => updateQuantity(item.cartKey, 1);
			div.querySelector('.cart-item-remove').onclick   = () => removeFromCart(item.cartKey);
			if (tieneOpc) {
				div.querySelector('.btn-edit-cart').onclick = () => {
					document.getElementById('cartSidebar').classList.remove('open');
					openCustomModal(item.id, item.cartKey);
				};
			}
			itemsDiv.appendChild(div);
		});
	}

	const total = cart.reduce((sum, i) => sum + i.price * i.cantidad, 0);
	const totalEl = document.getElementById('cartTotal');
	if (totalEl) totalEl.textContent = '$' + total.toLocaleString('es-CO');
}

function toggleCart() {
	document.getElementById('cartSidebar').classList.toggle('open');
}

// ── CHECKOUT ─────────────────────────────────────────────────
function openCheckout() {
	renderPaymentOptions();
	updateCheckoutSummary();
	document.getElementById('checkoutOverlay').classList.add('open');
	document.getElementById('cartSidebar').classList.remove('open');
}

function renderPaymentOptions() {
	const select = document.getElementById('paymentMethod');
	const mp = restaurante?.atributos?.metodos_pago || {};
	select.innerHTML = '';
	Object.entries(METODOS_PAGO_CATALOGO).forEach(([key, def]) => {
		const activo = key === 'efectivo' ? (mp.efectivo?.activo !== false) : !!mp[key]?.activo;
		if (!activo) return;
		const opt = document.createElement('option');
		opt.value = key;
		opt.textContent = def.label;
		select.appendChild(opt);
	});
	if (!select.options.length) {
		// Respaldo: si el restaurante no configuró ningún método, al menos "Efectivo"
		const opt = document.createElement('option');
		opt.value = 'efectivo'; opt.textContent = 'Efectivo';
		select.appendChild(opt);
	}
	updatePaymentDetails();
}

function updatePaymentDetails() {
	const select = document.getElementById('paymentMethod');
	const box = document.getElementById('paymentDetails');
	const mp = restaurante?.atributos?.metodos_pago || {};
	const key = select.value;
	const def = METODOS_PAGO_CATALOGO[key];
	if (def?.detalle && mp[key]) {
		// Los datos de pago (titular, número de cuenta, llave) los escribe el
		// restaurante desde el panel, así que también hay que escaparlos.
		box.innerHTML = `<div class="checkout-summary-item" style="color:var(--text)"><span>${esc(def.detalle(mp[key]))}</span></div>`;
		box.style.display = 'block';
	} else {
		box.style.display = 'none';
		box.innerHTML = '';
	}
}

function closeCheckout() {
	document.getElementById('checkoutOverlay').classList.remove('open');
}

function updateCheckoutSummary() {
	const summary = document.getElementById('checkoutSummary');
	const total = cart.reduce((sum, i) => sum + i.price * i.cantidad, 0);
	summary.innerHTML = cart.map(item => `
		<div class="checkout-summary-item">
			<span>${esc(item.name)} x${item.cantidad}${item.descripcion ? `<br><small style="color:var(--text-dim)">${esc(item.descripcion)}</small>` : ''}</span>
			<span>$${(item.price * item.cantidad).toLocaleString('es-CO')}</span>
		</div>`).join('') + `
		<div class="checkout-summary-total"><span>Total</span><span>$${total.toLocaleString('es-CO')}</span></div>`;
}

function sendWhatsAppOrder(event) {
	event.preventDefault();
	// wa.me solo acepta dígitos: un número escrito como "+57 300 123 4567"
	// genera un enlace que no abre nada y falla justo al final del pedido.
	// El mismo ayudante que usa la barra social, para que no se arregle en un
	// sitio y se quede roto en el otro — que es lo que había pasado.
	const whatsapp = soloDigitos(restaurante?.atributos?.whatsapp_pedidos);
	if (!whatsapp) {
		alert('Este restaurante no tiene configurado un número de WhatsApp para pedidos.');
		return;
	}
	const name    = document.getElementById('clientName').value;
	const address = document.getElementById('clientAddress').value;
	const paymentKey = document.getElementById('paymentMethod').value;
	const paymentDef = METODOS_PAGO_CATALOGO[paymentKey];
	const mp = restaurante?.atributos?.metodos_pago || {};

	let msg = `*Pedido - ${restaurante.nombre}*\n\n`;
	msg += `*Cliente:* ${name}\n`;
	msg += `*Dirección:* ${address}\n`;
	msg += `*Pago:* ${paymentDef?.label || paymentKey}\n`;
	if (paymentDef?.detalle && mp[paymentKey]) msg += `${paymentDef.detalle(mp[paymentKey])}\n`;
	msg += `\n*Pedido:*\n`;
	cart.forEach(item => {
		msg += `• *${item.name}* x${item.cantidad} = $${(item.price * item.cantidad).toLocaleString('es-CO')}\n`;
		if (item.descripcion) msg += `  _${item.descripcion}_\n`;
	});
	const total = cart.reduce((sum, i) => sum + i.price * i.cantidad, 0);
	msg += `\n*TOTAL: $${total.toLocaleString('es-CO')}*`;

	const url = `https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`;
	const ventana = window.open(url, '_blank');

	// Si el navegador bloqueó la ventana, el pedido no llegó a ninguna parte.
	// Vaciar el carrito aquí le borraba al cliente todo lo que había armado y
	// lo obligaba a empezar de cero: se conserva y se le da otra vía.
	if (!ventana) {
		mostrarEnlaceManual(url);
		return;
	}

	cart = [];
	saveCartToStorage();
	updateCartUI();
	closeCheckout();
	document.getElementById('clientName').value = '';
	document.getElementById('clientAddress').value = '';
}

// Enlace de reserva cuando el emergente no abre. Es un <a> de verdad: al
// pulsarlo hay gesto del usuario otra vez, que es lo que suelen exigir los
// bloqueadores.
function mostrarEnlaceManual(url) {
	const cont = document.getElementById('checkoutSummary');
	if (!cont) { window.location.href = url; return; }
	document.getElementById('checkoutManual')?.remove();
	const aviso = document.createElement('div');
	aviso.id = 'checkoutManual';
	aviso.style.cssText = 'background:rgba(255,176,32,.12);border:1px solid rgba(255,176,32,.45);border-radius:8px;padding:12px;margin-top:12px;font-size:13px;line-height:1.5;text-align:center;color:var(--text)';
	aviso.innerHTML = `<div style="margin-bottom:8px">Tu navegador bloqueó la apertura de WhatsApp. Tu pedido sigue guardado.</div>
		<a href="${escUrl(url)}" target="_blank" rel="noopener" style="display:inline-block;background:var(--accent);color:#000;padding:10px 18px;border-radius:8px;font-weight:700;text-decoration:none">Abrir WhatsApp y enviar</a>`;
	// Al pulsar el enlace el pedido sí sale, así que a partir de ahí el
	// carrito se vacía igual que en el camino normal.
	aviso.querySelector('a').addEventListener('click', () => {
		cart = [];
		saveCartToStorage();
		updateCartUI();
		aviso.remove();
		closeCheckout();
		document.getElementById('clientName').value = '';
		document.getElementById('clientAddress').value = '';
	});
	cont.insertAdjacentElement('afterend', aviso);
}

// ── ARRANQUE ──────────────────────────────────────────────────
// Lo llama el tema que tenga el carrito encendido, después de construir su
// nav. Engancha los botones del modal de personalización y publica en
// window lo que el marcado de index.html invoca con onclick.
export function activarCarrito() {
	loadCartFromStorage();

	document.getElementById('btnMenos')?.addEventListener('click', () => {
		if (customQty > 1) { customQty--; updateCustomQtyUI(); }
	});
	document.getElementById('btnMas')?.addEventListener('click', () => {
		customQty++; updateCustomQtyUI();
	});
	document.getElementById('btnAgregarCarrito')?.addEventListener('click', addCustomToCart);
	document.getElementById('customOverlay')?.addEventListener('click', e => {
		if (e.target.id === 'customOverlay') closeCustomModal();
	});

	// A propósito NO se enseña aquí ningún botón de carrito. Cada tema tiene
	// el suyo en un sitio distinto —el de 'carrito' lo lleva en su cabecera
	// fija, y un tema sin cabecera fija necesita otra cosa— así que enseñarlo
	// es decisión del tema y no de la maquinaria.
	window.vmToggleCart = toggleCart;
	window.vmOpenCheckout = openCheckout;
	window.vmCloseCheckout = closeCheckout;
	window.vmSendWhatsAppOrder = sendWhatsAppOrder;
	window.vmCloseCustomModal = closeCustomModal;
	window.vmUpdatePaymentDetails = updatePaymentDetails;
}

export { addSimpleToCart as agregarSimple, openCustomModal, tienePersonalizacion, opcionesDe };

// Un plato con toppings, salsas o extras se personaliza antes de sumarlo;
// uno normal entra directo. Lo pregunta cada tema para decidir qué hace su
// botón, y así la regla vive en un solo sitio.
function tienePersonalizacion(p) {
	const o = opcionesDe(p);
	return !!(o.platino.length || o.premium.length || o.salsas.length);
}
