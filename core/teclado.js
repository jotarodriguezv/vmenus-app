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
