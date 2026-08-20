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
