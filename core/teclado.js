// ── TECLADO ───────────────────────────────────────────────────
// La tarjeta de cada plato es un <div> con onclick, y un <div> no recibe el
// foco: sin puntero, la ficha del plato era inalcanzable. Lo absurdo es que
// dentro de la ficha el teclado ya estaba resuelto —Escape cierra, ←/→ pasan
// de plato— detrás de una puerta que solo se abría con el dedo. Ver V2 en
// adminmenus_restaurantes/docs/revision-ux.md.
//
// No se cambiaron los <div> por <button>: dentro de las tarjetas hay bloques
// (<div class="card-body">…) que un botón no admite, y el CSS de los seis temas
// cuelga de esas etiquetas. Hacerlos activables da lo mismo sin tocar el diseño.

// Enter y Espacio, como un botón de verdad. Espacio con preventDefault: si no,
// además de abrir la ficha, desplaza la página.
export function hacerActivable(el, etiqueta) {
	el.tabIndex = 0;
	el.setAttribute('role', 'button');
	if (etiqueta) el.setAttribute('aria-label', etiqueta);
	el.addEventListener('keydown', e => {
		if (e.target !== el) return;   // un botón de dentro se activa solo
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			el.click();
		}
	});
	return el;
}

// Al abrir una ficha el foco entra en ella, y al cerrarla vuelve a la tarjeta
// de la que salió. Sin lo segundo, quien cierra con Escape vuelve al principio
// de la página y tiene que recorrer la carta entera otra vez.
let origen = null;

export function llevarFocoA(destino) {
	const activo = document.activeElement;
	// Cada apertura recuerda su propia tarjeta, sin mirar lo que hubiera: un
	// origen de una ficha que se cerró por otro camino llevaría el foco a otro
	// plato. Pasar de plato con las flechas no llega aquí (no reabre la ficha).
	origen = activo && activo !== document.body ? activo : null;
	destino?.focus?.({ preventScroll: true });
}

export function devolverFoco() {
	const el = origen;
	origen = null;
	// La tarjeta puede haber desaparecido (un filtro que la escondió).
	if (el?.isConnected) el.focus({ preventScroll: true });
}

// ── EL TAB NO SALE DE LA FICHA ABIERTA ─────────────────────────
// Con la ficha abierta, Tab pasaba del botón de cerrar a las flechas y de ahí a
// la carta de detrás, tapada por el fondo oscuro: el foco quedaba en un plato
// que no se ve, y un lector de pantalla se salía del diálogo sin avisar.
//
// Una sola escucha para todas las ventanas. Se guarda la abierta más reciente:
// si una se abre encima de otra, manda la de arriba.
let abierta = null;

let escuchando = false;
export function encerrarTab(contenedor) {
	abierta = contenedor;
	// La escucha se pone la primera vez que hace falta y no al importar el
	// módulo: importarlo no debe tocar el documento (las pruebas lo cargan sin él).
	if (!escuchando) { document.addEventListener('keydown', alPulsarTab); escuchando = true; }
}
export function soltarTab(contenedor) { if (abierta === contenedor) abierta = null; }

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
	'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Lo que de verdad se puede alcanzar: la flecha «anterior» en el primer plato
// sigue en el DOM con visibility:hidden, y un Tab que la eligiera no haría nada.
export function enfocablesDe(contenedor) {
	return [...contenedor.querySelectorAll(ENFOCABLES)].filter(el =>
		el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');
}

function alPulsarTab(e) {
	if (e.key !== 'Tab' || !abierta?.isConnected) return;
	const lista = enfocablesDe(abierta);
	if (!lista.length) {
		// Nada enfocable dentro (una ficha sin fotos ni botones): el foco se
		// queda en la propia ventana en vez de escaparse.
		e.preventDefault();
		abierta.focus?.({ preventScroll: true });
		return;
	}
	const primero = lista[0], ultimo = lista[lista.length - 1];
	const activo = document.activeElement;
	const dentro = abierta.contains(activo);
	if (e.shiftKey && (!dentro || activo === primero || activo === abierta)) {
		e.preventDefault();
		ultimo.focus({ preventScroll: true });
	} else if (!e.shiftKey && (!dentro || activo === ultimo)) {
		e.preventDefault();
		primero.focus({ preventScroll: true });
	}
}
