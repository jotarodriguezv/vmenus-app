// ── ELEGIR SEDE ───────────────────────────────────────────────
// La pantalla que sale al entrar a un restaurante con varias sedes por su
// dirección general (menu.vmenus.co/enchulados): una tarjeta por local, y cada
// una lleva a su carta. Con sede en la URL (…/enchulados/bucaramanga) no sale.
//
// Se construye con el DOM y textContent, nunca con plantillas de texto: los
// nombres y direcciones los escribe el restaurante. Es una pantalla propia y no
// la bienvenida (intro.js) a propósito: la bienvenida es de UNA carta y aquí
// todavía no hay carta que enseñar. Cuando la bienvenida admita elegir sede,
// esta función se queda como la versión sin bienvenida.

import { escUrl } from './html.js';
import { direccionDelNegocio } from './negocio.js';
import { rutaDeSede } from './sedes.js';

export function construirSelector(restaurante, sedes, host) {
	const raiz = document.createElement('section');
	raiz.id = 'selectorSedes';
	raiz.className = 'selector-sedes';
	raiz.setAttribute('aria-label', `Elige la sede de ${restaurante.nombre || ''}`);

	const caja = document.createElement('div');
	caja.className = 'selector-sedes__caja';

	if (restaurante.logo_url) {
		const logo = document.createElement('img');
		logo.className = 'selector-sedes__logo';
		logo.src = escUrl(restaurante.logo_url);
		logo.alt = '';
		caja.appendChild(logo);
	}
	const titulo = document.createElement('h1');
	titulo.className = 'selector-sedes__titulo';
	titulo.textContent = restaurante.nombre || '';
	caja.appendChild(titulo);
	const pregunta = document.createElement('p');
	pregunta.className = 'selector-sedes__pregunta';
	pregunta.textContent = '¿En qué sede estás?';
	caja.appendChild(pregunta);

	for (const sede of sedes) {
		const enlace = document.createElement('a');
		enlace.className = 'selector-sedes__sede';
		enlace.href = rutaDeSede(host, restaurante.slug, sede.slug);
		const nombre = document.createElement('span');
		nombre.className = 'selector-sedes__nombre';
		nombre.textContent = sede.nombre;
		enlace.appendChild(nombre);
		const direccion = direccionDelNegocio(sede.atributos);
		if (direccion) {
			const d = document.createElement('span');
			d.className = 'selector-sedes__direccion';
			d.textContent = direccion;
			enlace.appendChild(d);
		}
		caja.appendChild(enlace);
	}
	raiz.appendChild(caja);
	return raiz;
}

const ESTILOS = `
.selector-sedes { position: fixed; inset: 0; z-index: 9000; display: flex; align-items: center; justify-content: center;
	padding: 24px 16px; overflow-y: auto; background: var(--dark); color: var(--text); font-family: var(--font-cuerpo); }
.selector-sedes__caja { width: 100%; max-width: 420px; text-align: center; }
.selector-sedes__logo { max-width: 120px; max-height: 120px; object-fit: contain; margin-bottom: 12px; }
.selector-sedes__titulo { margin: 0 0 6px; font-family: var(--font-titulo); font-size: 28px; color: var(--primary); }
.selector-sedes__pregunta { margin: 0 0 24px; color: var(--text-muted); font-size: 16px; }
.selector-sedes__sede { display: block; margin-bottom: 12px; padding: 16px; text-align: left; text-decoration: none;
	color: inherit; background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); }
.selector-sedes__sede:hover, .selector-sedes__sede:focus-visible { background: var(--card-hover); border-color: var(--primary); outline: none; }
.selector-sedes__nombre { display: block; font-size: 18px; font-weight: 700; }
.selector-sedes__direccion { display: block; margin-top: 4px; font-size: 14px; color: var(--text-muted); }
`;

export function mostrarSelector(restaurante, sedes, host = window.location.hostname) {
	if (!document.getElementById('selectorSedesEstilos')) {
		const estilo = document.createElement('style');
		estilo.id = 'selectorSedesEstilos';
		estilo.textContent = ESTILOS;
		document.head.appendChild(estilo);
	}
	document.body.appendChild(construirSelector(restaurante, sedes, host));
}
