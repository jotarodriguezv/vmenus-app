// ── PANTALLA DE BIENVENIDA (INTRO) ────────────────────────────
// Opcional y apagada por defecto (atributos.intro_activo): una pantalla
// antes de la carta con el logo, el eslogan, un botón "Ver carta" y los
// mismos datos de contacto que ya se configuran en Ajustes del panel
// (WhatsApp y redes) más la dirección. Nunca cambia el tema de nav ni su
// diseño: solo se antepone, y "Ver carta" la quita de en medio.
//
// No es "portada" (la imagen de cabecera del modelo Explorar,
// atributos.portada_url/atributos.portada_activa) ni el "mensaje de
// bienvenida" de sidebar/topnav (atributos.mostrar_hero): son tres cosas
// distintas, con nombres a propósito distintos para no confundirlas.
//
// Se pinta ANTES de cargar el tema (core/loader.js, paso 5): el tema y el
// menú se construyen igual, debajo, mientras la intro está encima. Así, al
// pulsar "Ver carta", la carta ya está lista y aparece al instante.

import { esc, escUrl } from './html.js';
import { soloDigitos, enlacesSociales } from './menu.js';

export function introActiva(restaurante) {
	return !!restaurante?.atributos?.intro_activo;
}

// El mismo WhatsApp que la barra social (atributos.social_whatsapp): no hay
// un teléfono aparte para la intro, para no tener dos números que sincronizar.
function enlaceWhatsapp(at) {
	const numero = soloDigitos(at?.social_whatsapp);
	return numero ? `https://wa.me/${numero}` : null;
}

export function construirIntro(restaurante) {
	const at = restaurante.atributos || {};
	const host = document.createElement('div');
	host.id = 'introPantalla';
	host.className = 'intro-pantalla';

	const contenido = document.createElement('div');
	contenido.className = 'intro-contenido';

	if (restaurante.logo_url) {
		const logo = document.createElement('img');
		logo.className = 'intro-logo';
		logo.src = escUrl(restaurante.logo_url);
		logo.alt = '';
		contenido.appendChild(logo);
	}

	const nombre = document.createElement('h1');
	nombre.className = 'intro-nombre';
	nombre.textContent = restaurante.nombre || '';
	contenido.appendChild(nombre);

	if (at.intro_eslogan) {
		const eslogan = document.createElement('p');
		eslogan.className = 'intro-eslogan';
		eslogan.textContent = at.intro_eslogan;
		contenido.appendChild(eslogan);
	}

	const boton = document.createElement('button');
	boton.type = 'button';
	boton.className = 'intro-boton';
	boton.textContent = 'Ver carta';
	boton.onclick = () => host.remove();
	contenido.appendChild(boton);

	// Contacto: WhatsApp, dirección y redes — los tres opcionales, cada uno
	// solo si el restaurante lo configuró. El orden importa poco aquí porque
	// cada uno es una línea suelta, no una barra de iconos.
	const wa = enlaceWhatsapp(at);
	if (wa) {
		const enlace = document.createElement('a');
		enlace.className = 'intro-contacto intro-whatsapp';
		enlace.href = escUrl(wa);
		enlace.target = '_blank';
		enlace.rel = 'noopener';
		enlace.textContent = `📞 ${esc(at.social_whatsapp)}`;
		contenido.appendChild(enlace);
	}

	if (at.direccion) {
		const direccion = document.createElement('p');
		direccion.className = 'intro-contacto intro-direccion';
		direccion.textContent = at.direccion;
		contenido.appendChild(direccion);
	}

	const redes = enlacesSociales(at);
	if (redes.length) {
		const bar = document.createElement('div');
		bar.className = 'intro-redes';
		bar.innerHTML = redes.map(r => `
			<a href="${escUrl(r.href)}" target="_blank" rel="noopener" aria-label="${esc(r.label)}">${r.icon}</a>
		`).join('');
		contenido.appendChild(bar);
	}

	host.appendChild(contenido);
	return host;
}

export function mostrarIntro(restaurante) {
	document.body.appendChild(construirIntro(restaurante));
}
