// ── BUSCADOR DE PLATOS ────────────────────────────────────────
// Para que el comensal escriba «arepa» y llegue a su plato sin recorrer la
// carta entera. Hasta el 17/09/2026 solo lo tenía Explorar, dentro de su
// propio tema: es el mismo caso de los filtros, que vivían encerrados ahí y
// hubo que sacar a core/filtros.js. Cuando una capacidad se queda dentro de un
// tema, o se copia en los otros o no la tiene nadie más.
//
// Aquí está la lógica —qué coincide y cuándo se ofrece— y el cuadro de
// búsqueda, que sí es el mismo en todos: una caja de texto con su aspa. Lo que
// cada tema pone es DÓNDE va y qué hay que esconder, igual que con los chips.
//
// Se busca en el nombre, en la descripción y en la descripción avanzada. Las
// tres son lo que el comensal ve del plato, así que buscar «picante» tiene que
// encontrar el que lo dice en su descripción aunque no lo lleve en el nombre.

import { restaurante, productos } from './menu.js';

// Debajo de esto no se ofrece. Una carta de seis platos se lee entera de un
// vistazo, y la caja de búsqueda ocuparía el sitio de un plato para no ahorrar
// nada. El número es discutible; que exista un mínimo, no.
export const MINIMO_PLATOS_BUSCADOR = 8;

let termino = '';

export function terminoBusqueda() { return termino; }
export function fijarTermino(t) { termino = String(t ?? ''); }

// Se puede apagar desde el panel, como los filtros y el carrito, y por el
// mismo motivo: no todas las cartas lo quieren. Ausente es encendido, que es
// lo que hace que esto funcione sin que nadie tenga que ir a encenderlo.
export function buscadorEncendido(r = restaurante) {
	return r?.atributos?.buscador !== false;
}

export function hayQueOfrecerBuscador(lista = productos) {
	return buscadorEncendido() && (lista || []).length >= MINIMO_PLATOS_BUSCADOR;
}

// Sin acentos y en minúsculas por los dos lados: quien busca en el teclado de
// un móvil escribe «jalapeno» y «pina», y no encontrar el jalapeño se lee como
// que la carta no lo tiene.
export function normalizar(texto) {
	return String(texto ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Se parte por espacios y se exigen TODAS las palabras, en cualquier orden:
// «pollo arroz» tiene que encontrar «Arroz con pollo». Exigir el orden haría
// fallar la mitad de las búsquedas de dos palabras sin que se entienda por qué.
export function coincideBusqueda(p, t = termino) {
	const palabras = normalizar(t).split(/\s+/).filter(Boolean);
	if (!palabras.length) return true;
	const donde = normalizar([p?.nombre, p?.descripcion, p?.descripcion_avanzada].join(' '));
	return palabras.every(palabra => donde.includes(palabra));
}

// ── EL CUADRO DE BÚSQUEDA ─────────────────────────────────────
// Dónde cabe. Los temas que no pasan el suyo llevan una fila propia justo
// encima del contenido, dentro de la misma envoltura que los chips sueltos
// (core/filtros.js): así, con cabecera fija, el hueco de los 60 px lo baja la
// envoltura una sola vez y no cada fila por su cuenta.
//
// Fuera de mainContent a propósito, como los chips: buildMenu lo vacía entero
// al repintar y la fila se iría con él —y con ella, lo que se había escrito.
function contenedorDelBuscador(propio) {
	if (propio) return propio;
	const main = document.getElementById('mainContent');
	if (!main) return null;
	let fila = document.getElementById('buscadorFila');
	if (!fila) {
		fila = document.createElement('div');
		fila.id = 'buscadorFila';
		fila.className = 'buscador-fila';
		// Antes que la fila de chips, si ya está puesta: se lee de arriba abajo
		// «busca o afina», y no al revés.
		const chips = document.getElementById('filtrosSueltos');
		(chips || main).insertAdjacentElement('beforebegin', fila);
	}
	// La envoltura con cabecera fija la marca igual que los chips: es la misma
	// regla de siempre, y aquí solo se copia la clase que ya existe.
	fila.classList.toggle('buscador-bajo-fijo', main.classList.contains('with-fixed-header'));
	return fila;
}

// 'alCambiar' lo pone cada tema, porque cada uno sabe qué esconder: aquí no se
// sabe si un plato es un .vid-plato o un .product-card, ni hace falta.
export function montarBuscador(alCambiar, host) {
	// Repintar la carta vuelve a llamar aquí. Si ya hay caja no se rehace: se
	// perdería lo escrito y el foco a media palabra.
	if (document.getElementById('buscadorInput')) return;
	if (!hayQueOfrecerBuscador()) return;
	const fila = contenedorDelBuscador(host);
	if (!fila) return;

	const caja = document.createElement('div');
	caja.className = 'buscador-caja';
	const input = document.createElement('input');
	input.type = 'search';
	input.id = 'buscadorInput';
	input.className = 'buscador-input';
	input.autocomplete = 'off';
	input.placeholder = 'Buscar un plato…';
	input.setAttribute('aria-label', 'Buscar un plato');
	const aspa = document.createElement('button');
	aspa.type = 'button';
	aspa.className = 'buscador-aspa';
	aspa.textContent = '✕';
	aspa.setAttribute('aria-label', 'Borrar la búsqueda');
	aspa.hidden = true;

	const cambiar = () => {
		fijarTermino(input.value);
		aspa.hidden = !input.value;
		alCambiar();
	};
	input.addEventListener('input', cambiar);
	// Escape borra sin salir del teclado, que es lo que espera quien escribió
	// y no encontró. El Escape global de core/menu.js cierra capas; aquí no hay
	// ninguna abierta, así que no se pisan.
	input.addEventListener('keydown', e => {
		if (e.key !== 'Escape' || !input.value) return;
		e.stopPropagation();
		input.value = '';
		cambiar();
	});
	aspa.addEventListener('click', () => { input.value = ''; cambiar(); input.focus(); });

	caja.append(input, aspa);
	fila.appendChild(caja);
}

// Lo que se dice cuando no queda nada que enseñar. Lo pinta core/filtros.js,
// que es quien esconde, pero el texto vive aquí porque depende de lo buscado:
// «sin resultados» a secas, con un filtro puesto y una palabra escrita, deja a
// quien lo lee sin saber cuál de las dos cosas quitar.
export function textoSinResultados(conFiltros) {
	if (termino.trim() && conFiltros) return `Ningún plato de «${termino.trim()}» cumple los filtros que marcaste.`;
	if (termino.trim()) return `No encontramos ningún plato con «${termino.trim()}».`;
	return 'Ningún plato cumple los filtros que marcaste.';
}
