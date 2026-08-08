// ── TEMA: CARRITO ─────────────────────────────────────────────
// Header fijo + sidebar (igual que temas/sidebar.js) + carrito de
// compras que arma el pedido y lo envía por WhatsApp.
// Se activa cuando atributos.nav = 'carrito'.

import { restaurante, categorias, productos } from '../core/menu.js';
import { buildNav as buildSidebarNav } from './sidebar.js';
import { trackClic } from '../core/analytics.js';
import { esc, escUrl } from '../core/html.js';

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
let customEditingKey = null;
let customQty = 1;
let selectedPlatino = new Set();
let selectedPremium = new Set();
let selectedSalsas  = new Set();

// ── NAV (reutiliza el sidebar + agrega el botón de carrito) ────
export function buildNav() {
	buildSidebarNav();
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

	window.vmToggleCart = toggleCart;
	window.vmOpenCheckout = openCheckout;
	window.vmCloseCheckout = closeCheckout;
	window.vmSendWhatsAppOrder = sendWhatsAppOrder;
	window.vmCloseCustomModal = closeCustomModal;
	window.vmUpdatePaymentDetails = updatePaymentDetails;
}

// ── MENÚ (grid propio: click = agregar/personalizar, no info) ──
export function buildMenu() {
	const main = document.getElementById('mainContent');
	if (!main) return;
	main.innerHTML = '';

	categorias.forEach(cat => {
		const prods = productos.filter(p => p.categoria_id === cat.id);
		if (!prods.length) return;

		const section = document.createElement('div');
		section.className = 'category-section';
		section.id = 'sec-' + cat.id;
		section.innerHTML = `
		<div class="category-header">
			<div class="category-title">${esc(cat.emoji || '')} ${esc(cat.nombre)}</div>
			<div class="category-line"></div>
		</div>`;

		const grid = document.createElement('div');
		grid.className = 'products-grid';

		prods.forEach(p => {
			const attr = p.atributos || {};
			const tieneOpciones = !!(attr.toppings_platino?.length || attr.toppings_premium?.length || attr.salsas?.length);

			// Sin imagen asignada: fila compacta, sin caja de foto (como una categoría "sin fotos")
			if (!p.imagen_url) {
				const row = document.createElement('div');
				row.className = 'product-noimg';
				row.innerHTML = `
				<div>
					<div class="card-name">${esc(p.nombre)}</div>
					${tieneOpciones ? '<div class="card-hint">Toca para personalizar</div>' : ''}
				</div>
				<div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
					<div class="card-price">${esc(p.precio)}</div>
					<span class="noimg-add-indicator">+</span>
				</div>`;
				row.onclick = () => {
					trackClic(restaurante?.id, p.id);
					if (tieneOpciones) {
						openCustomModal(p.id);
					} else {
						addSimpleToCart(p);
						const ind = row.querySelector('.noimg-add-indicator');
						if (ind) {
							ind.textContent = '✓';
							setTimeout(() => { ind.textContent = '+'; }, 800);
						}
					}
				};
				grid.appendChild(row);
				return;
			}

			const card = document.createElement('div');
			card.className = 'product-card has-img';
			card.innerHTML = `
			<div class="card-img-wrap">
				<img class="card-img" src="${escUrl(p.imagen_url)}" alt="${esc(p.nombre)}" loading="lazy" onerror="this.parentNode.innerHTML=window.vmNoImg()">
				<button class="card-add-btn" title="${tieneOpciones ? 'Personalizar' : 'Agregar'}">+</button>
			</div>
			<div class="card-body">
				<div class="card-name">${esc(p.nombre)}</div>
				<div class="card-price">${esc(p.precio)}</div>
				${tieneOpciones ? '<div class="card-hint">Toca para personalizar</div>' : ''}
			</div>`;

			card.onclick = () => {
				trackClic(restaurante?.id, p.id);
				if (tieneOpciones) {
					openCustomModal(p.id);
				} else {
					addSimpleToCart(p);
					const btn = card.querySelector('.card-add-btn');
					if (btn) {
						btn.textContent = '✓';
						setTimeout(() => { btn.textContent = '+'; }, 800);
					}
				}
			};

			grid.appendChild(card);
		});

		section.appendChild(grid);
		main.appendChild(section);
	});
}

function addSimpleToCart(p) {
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

	if (editingCartKey) {
		const item = cart.find(i => i.cartKey === editingCartKey);
		customQty = item ? item.cantidad : 1;
		const desc = item?.descripcion || '';
		const platMatch  = desc.match(/Toppings: ([^|]+)/);
		const premMatch  = desc.match(/Premium: ([^|]+)/);
		const salsaMatch = desc.match(/Salsas: ([^|]+)/);
		selectedPlatino = new Set(platMatch  ? platMatch[1].trim().split(', ')  : []);
		selectedPremium = new Set(premMatch  ? premMatch[1].trim().split(', ')  : []);
		selectedSalsas  = new Set(salsaMatch ? salsaMatch[1].trim().split(', ') : []);
	} else {
		customQty = 1;
		selectedPlatino = new Set();
		selectedPremium = new Set();
		selectedSalsas  = new Set();
	}

	const attr = p.atributos || {};
	document.getElementById('customName').textContent = p.nombre;
	document.getElementById('customBasePrice').textContent = `Precio base: ${p.precio}`;
	updateCustomQtyUI();
	document.getElementById('btnAgregarCarrito').textContent = editingCartKey ? '✏ GUARDAR CAMBIOS' : '🛒 AGREGAR AL CARRITO';

	fillChipSection('secToppingsPlatino', 'listToppingsPlatino', attr.toppings_platino, t => t, selectedPlatino,
		t => toggleInSet(selectedPlatino, t));
	fillChipSection('secToppingsPremium', 'listToppingsPremium', attr.toppings_premium,
		t => `${t.nombre} (+$${t.precio.toLocaleString('es-CO')})`, selectedPremium,
		t => toggleInSet(selectedPremium, t.nombre), t => t.nombre);
	fillChipSection('secSalsas', 'listSalsas', attr.salsas, s => s, selectedSalsas,
		s => toggleInSet(selectedSalsas, s));

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

function updateCustomTotal() {
	if (!customProduct) return;
	const attr = customProduct.atributos || {};
	const extras = (attr.toppings_premium || [])
		.filter(t => selectedPremium.has(t.nombre))
		.reduce((sum, t) => sum + t.precio, 0);
	const total = (customProduct.precio_numerico + extras) * customQty;
	document.getElementById('customTotal').textContent = '$' + total.toLocaleString('es-CO');
}

function closeCustomModal() {
	document.getElementById('customOverlay').classList.remove('open');
	document.body.style.overflow = '';
}

function addCustomToCart() {
	if (!customProduct) return;
	const attr = customProduct.atributos || {};
	const extras = (attr.toppings_premium || [])
		.filter(t => selectedPremium.has(t.nombre))
		.reduce((sum, t) => sum + t.precio, 0);
	const precioUnit = customProduct.precio_numerico + extras;

	const partes = [];
	if (selectedPlatino.size) partes.push(`Toppings: ${[...selectedPlatino].join(', ')}`);
	if (selectedPremium.size) partes.push(`Premium: ${[...selectedPremium].join(', ')}`);
	if (selectedSalsas.size)  partes.push(`Salsas: ${[...selectedSalsas].join(', ')}`);
	const descripcion = partes.join(' | ');
	const cartKey = `${customProduct.id}__${descripcion}`;

	if (customEditingKey) cart = cart.filter(i => i.cartKey !== customEditingKey);

	const existing = cart.find(i => i.cartKey === cartKey);
	if (existing) existing.cantidad += customQty;
	else cart.push({ cartKey, id: customProduct.id, name: customProduct.nombre, price: precioUnit, extras, cantidad: customQty, descripcion });

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

function saveCartToStorage() {
	localStorage.setItem(storageKey(), JSON.stringify({ v: CART_VERSION, items: cart }));
}

// ── REVALIDAR EL CARRITO GUARDADO ─────────────────────────────
// El carrito vive en el navegador del cliente y puede reaparecer días
// después. Sin cruzarlo con el menú de hoy, el pedido sale con el precio que
// tenía cuando se añadió y con productos que quizá ya no existen: al
// restaurante le llega un pedido que no puede cumplir al precio que dice.
//
// 'productos' ya viene cargado y filtrado (solo disponibles, y solo los de
// categorías dentro de su franja horaria), así que sirve de fuente de verdad.
function revalidarCarrito(guardado) {
	const vivos = [], retirados = [], reprecio = [];

	for (const item of guardado) {
		const p = productos.find(pr => pr.id === item.id);
		// No está en el menú de ahora: agotado, borrado o fuera de horario.
		if (!p) { retirados.push(item.name); continue; }

		const extras = Number(item.extras) || 0;
		const precioHoy = p.precio_numerico + extras;
		if (precioHoy !== item.price) {
			reprecio.push({ nombre: p.nombre, antes: item.price, ahora: precioHoy });
			item.price = precioHoy;
		}
		item.name = p.nombre;   // el nombre también pudo cambiar en el panel
		vivos.push(item);
	}
	return { vivos, retirados, reprecio };
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

function loadCartFromStorage() {
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
	} catch {
		localStorage.removeItem(storageKey());
		return;
	}

	const { vivos, retirados, reprecio } = revalidarCarrito(guardado);
	cart = vivos;
	// Se persiste ya corregido: si el cliente cierra sin pedir, la próxima
	// visita arranca del estado bueno y no repite el mismo aviso.
	if (retirados.length || reprecio.length) saveCartToStorage();
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
	const cartCount = document.getElementById('cartCount');
	if (cartCount) cartCount.textContent = count;

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
			const attr = prod?.atributos || {};
			const tieneOpc = !!(attr.toppings_platino?.length || attr.toppings_premium?.length || attr.salsas?.length);

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
	const whatsapp = String(restaurante?.atributos?.whatsapp_pedidos ?? '').replace(/\D/g, '');
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
