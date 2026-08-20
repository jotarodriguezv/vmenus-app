// ── FILTROS ───────────────────────────────────────────────────
// El restaurante define qué filtros ofrece (atributos.filtros_disponibles,
// desde Apariencia) y cada plato dice cuáles cumple (atributos.filtros).
// Sirven para lo que quiera el negocio: vegetariano, sin gluten, picante.
//
// Vivía dentro de temas/explorar.js, así que era el único modelo que podía
// filtrar aunque los datos estuvieran ahí para todos. Es el mismo motivo por
// el que existen core/carrito.js, core/carrusel.js y core/html.js: cuando una
// capacidad se queda encerrada en un tema, o se copia o no la tiene nadie más.
//
// Aquí está SOLO la lógica: qué filtros existen, cuáles se usan de verdad y
// si un plato pasa. Cómo se pintan los chips lo decide cada tema, porque cada
// uno tiene su aspecto y ahí no hay nada que compartir.

import { restaurante, productos } from './menu.js';

// Mapa id → {id, label, emoji} de lo que el restaurante activó.
export function filtrosMap() {
	const map = {};
	(restaurante?.atributos?.filtros_disponibles || []).forEach(f => { map[f.id] = f; });
	return map;
}

// Solo los que aparecen en algún plato. Un filtro configurado que ningún
// plato cumple es un chip que al pulsarlo vacía la carta: mejor no enseñarlo.
export function filtrosEnUso() {
	const map = filtrosMap();
	const usados = new Set();
	productos.forEach(p => (p.atributos?.filtros || []).forEach(id => { if (map[id]) usados.add(id); }));
	return [...usados].map(id => map[id]);
}

// Con varios filtros activos se exigen TODOS, no cualquiera. Quien marca
// "vegetariano" y "sin gluten" busca algo que cumpla las dos cosas; darle lo
// que cumple una sola sería justo lo contrario de lo que pidió.
export function pasaFiltros(p, activos) {
	if (!activos?.size) return true;
	const suyos = new Set(p.atributos?.filtros || []);
	for (const id of activos) if (!suyos.has(id)) return false;
	return true;
}

// ── CHIPS ─────────────────────────────────────────────────────
// Los chips sí se comparten, al contrario que las tarjetas de plato: son la
// misma fila de píldoras en todos los modelos y no hay nada que ganar
// pintándolas cinco veces distintas.

export const filtrosActivos = new Set();

// Dónde caben. Los modelos de nav horizontal —topnav, video— tienen sitio
// reservado bajo las categorías. Los de menú lateral no tienen ninguna barra
// donde meterlos, así que se les pone una fila propia justo encima del
// contenido.
//
// Un tema puede pasar el suyo y saltarse las dos opciones. Lo hace 'vertical',
// que no tiene barra ninguna: sus chips van flotando sobre el video. Se
// resuelve así, con un argumento, y no con una lista de temas aquí dentro,
// porque esta lista crecería con cada modelo nuevo y este archivo no tiene por
// qué enterarse de que existen.
function contenedorDeChips(propio) {
	if (propio) return propio;

	const nav = document.getElementById('navSticky');
	if (nav && nav.style.display !== 'none') return document.getElementById('navFiltros');

	const main = document.getElementById('mainContent');
	if (!main) return null;
	let fila = document.getElementById('filtrosSueltos');
	if (!fila) {
		fila = document.createElement('div');
		fila.id = 'filtrosSueltos';
		fila.className = 'nav-filtros nav-filtros-sueltos';
		// Fuera de mainContent a propósito: buildMenu lo vacía entero cada vez
		// que se repinta, y la fila se iría con él.
		main.insertAdjacentElement('beforebegin', fila);
	}
	return fila;
}

// 'alCambiar' lo pone cada tema, porque cada uno sabe qué elementos suyos hay
// que esconder. Aquí no se sabe si un plato es un .vid-plato o un
// .product-card, ni hace falta.
export function montarChips(alCambiar, host) {
	const fila = contenedorDeChips(host);
	if (!fila) return;
	fila.innerHTML = '';

	const disponibles = filtrosEnUso();
	if (!disponibles.length) return;   // :empty en el CSS la hace desaparecer

	disponibles.forEach(f => {
		const chip = document.createElement('button');
		chip.className = 'filtro-chip' + (filtrosActivos.has(f.id) ? ' activo' : '');
		chip.textContent = `${f.emoji || ''} ${f.label}`.trim();
		chip.onclick = () => {
			if (filtrosActivos.has(f.id)) filtrosActivos.delete(f.id);
			else filtrosActivos.add(f.id);
			chip.classList.toggle('activo');
			alCambiar();
		};
		fila.appendChild(chip);
	});
}

// Esconde lo que no pasa, y las categorías que se quedan sin nada que
// enseñar. Se esconde en vez de repintar por tres motivos que se acumulan:
// repintar recrearía los <video> y el que estuviera sonando volvería a
// empezar; se perdería el sitio del scroll; y los modelos que abren su modal
// por POSICIÓN dentro de la categoría empezarían a abrir el plato equivocado.
export function ocultarNoCoinciden(selectorPlato) {
	document.querySelectorAll('#mainContent .category-section').forEach(seccion => {
		let visibles = 0;
		seccion.querySelectorAll(selectorPlato).forEach(el => {
			const p = productos.find(x => x.id === el.dataset.plato);
			const pasa = !p || pasaFiltros(p, filtrosActivos);
			el.style.display = pasa ? '' : 'none';
			if (pasa) visibles++;
		});
		// Una categoría vacía es un título suelto en mitad de la carta.
		seccion.style.display = visibles ? '' : 'none';
	});
}
