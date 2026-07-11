// ── TEMA: CARRITO ─────────────────────────────────────────────
// Header fijo + sidebar (igual que temas/sidebar.js) + carrito de
// compras que arma el pedido y lo envía por WhatsApp.
// Se activa cuando atributos.nav = 'carrito'.

import { restaurante, categorias, productos } from '../core/menu.js';
import { buildNav as buildSidebarNav } from './sidebar.js';

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
			<div class="category-title">${cat.emoji || ''} ${cat.nombre}</div>
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
					<div class="card-name">${p.nombre}</div>
					${tieneOpciones ? '<div class="card-hint">Toca para personalizar</div>' : ''}
				</div>
				<div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
					<div class="card-price">${p.precio}</div>
					<span class="noimg-add-indicator">+</span>
				</div>`;
				row.onclick = () => {
					if (tieneOpciones) {
						openCustomModal(p.id);
					} else {
						addSimpleToCart(p);
						const ind = row.querySelector('.noimg-add-indicator');
						ind.textContent = '✓';
						setTimeout(() => { ind.textContent = '+'; }, 800);
					}
				};
				grid.appendChild(row);
				return;
			}

			const card = document.createElement('div');
			card.className = 'product-card has-img';
			card.innerHTML = `
			<div class="card-img-wrap">
				<img class="card-img" src="${p.imagen_url}" alt="${p.nombre}" loading="lazy" onerror="this.parentNode.innerHTML=window.vmNoImg()">
				<button class="card-add-btn" title="${tieneOpciones ? 'Personalizar' : 'Agregar'}">+</button>
			</div>
			<div class="card-body">
				<div class="card-name">${p.nombre}</div>
				<div class="card-price">${p.precio}</div>
				${tieneOpciones ? '<div class="card-hint">Toca para personalizar</div>' : ''}
			</div>`;

			card.onclick = () => {
				if (tieneOpciones) {
					openCustomModal(p.id);
				} else {
					addSimpleToCart(p);
					const btn = card.querySelector('.card-add-btn');
					btn.textContent = '✓';
					setTimeout(() => { btn.textContent = '+'; }, 800);
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
	else cart.push({ cartKey: p.id, id: p.id, name: p.nombre, price: p.precio_numerico, cantidad: 1, descripcion: '' });
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
	else cart.push({ cartKey, id: customProduct.id, name: customProduct.nombre, price: precioUnit, cantidad: customQty, descripcion });

	customEditingKey = null;
	saveCartToStorage();
	updateCartUI();
	closeCustomModal();
}

// ── CARRITO ──────────────────────────────────────────────────
function storageKey() { return `${restaurante?.slug || 'vmenus'}_cart`; }

function saveCartToStorage() { localStorage.setItem(storageKey(), JSON.stringify(cart)); }

function loadCartFromStorage() {
	try {
		const saved = localStorage.getItem(storageKey());
		if (saved) { cart = JSON.parse(saved); updateCartUI(); }
	} catch { cart = []; }
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
				<div class="cart-item-name">${item.name}</div>
				${item.descripcion ? `<div class="cart-item-desc">${item.descripcion}</div>` : ''}
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
	updateCheckoutSummary();
	document.getElementById('checkoutOverlay').classList.add('open');
	document.getElementById('cartSidebar').classList.remove('open');
}

function closeCheckout() {
	document.getElementById('checkoutOverlay').classList.remove('open');
}

function updateCheckoutSummary() {
	const summary = document.getElementById('checkoutSummary');
	const total = cart.reduce((sum, i) => sum + i.price * i.cantidad, 0);
	summary.innerHTML = cart.map(item => `
		<div class="checkout-summary-item">
			<span>${item.name} x${item.cantidad}${item.descripcion ? `<br><small style="color:var(--text-dim)">${item.descripcion}</small>` : ''}</span>
			<span>$${(item.price * item.cantidad).toLocaleString('es-CO')}</span>
		</div>`).join('') + `
		<div class="checkout-summary-total"><span>Total</span><span>$${total.toLocaleString('es-CO')}</span></div>`;
}

function sendWhatsAppOrder(event) {
	event.preventDefault();
	const whatsapp = restaurante?.atributos?.whatsapp_pedidos;
	if (!whatsapp) {
		alert('Este restaurante no tiene configurado un número de WhatsApp para pedidos.');
		return;
	}
	const name    = document.getElementById('clientName').value;
	const address = document.getElementById('clientAddress').value;
	const payment = document.getElementById('paymentMethod').value;

	let msg = `🛒 *Pedido - ${restaurante.nombre}*\n\n`;
	msg += `👤 *Cliente:* ${name}\n`;
	msg += `📍 *Dirección:* ${address}\n`;
	msg += `💳 *Pago:* ${payment}\n\n`;
	msg += `🛒 *Pedido:*\n`;
	cart.forEach(item => {
		msg += `• *${item.name}* x${item.cantidad} = $${(item.price * item.cantidad).toLocaleString('es-CO')}\n`;
		if (item.descripcion) msg += `  _${item.descripcion}_\n`;
	});
	const total = cart.reduce((sum, i) => sum + i.price * i.cantidad, 0);
	msg += `\n*TOTAL: $${total.toLocaleString('es-CO')}*`;

	window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');

	cart = [];
	saveCartToStorage();
	updateCartUI();
	closeCheckout();
	document.getElementById('clientName').value = '';
	document.getElementById('clientAddress').value = '';
}
