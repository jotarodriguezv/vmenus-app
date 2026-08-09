// ── CARRUSEL DE FOTOS DE PRODUCTO ─────────────────────────────
// Un producto puede tener varias fotos: la principal (imagen_url) y las
// adicionales (atributos.imagenes). Se construyó dentro del modal de
// core/menu.js, que comparten los modelos topnav y sidebar.
//
// Vive aquí para que los temas con modal propio usen exactamente el mismo
// carrusel en vez de una copia. Dos copias es justo como empezó el problema
// del escapado de HTML: bien resuelto en un tema y ausente en los otros dos.

// Fotos de un producto, en orden y sin repetir: la principal primero.
export function fotosDe(producto) {
	const fotos = [];
	if (producto?.imagen_url) fotos.push(producto.imagen_url);
	(producto?.atributos?.imagenes || []).forEach(u => {
		if (u && !fotos.includes(u)) fotos.push(u);
	});
	return fotos;
}

// Devuelve el elemento del carrusel, o null si hay menos de dos fotos: con
// una sola no hay nada que deslizar y cada tema la pinta a su manera.
//
// 'alAmpliar' es opcional: los temas que tienen visor de imagen lo pasan y
// las fotos se pueden abrir; los que no, se quedan sin ampliar y sin el
// cursor de zoom, para no prometer algo que no ocurre.
export function construirCarrusel(fotos, { alt = '', alAmpliar = null } = {}) {
	if (!Array.isArray(fotos) || fotos.length < 2) return null;

	let actual = 0;
	const carrusel = document.createElement('div');
	carrusel.className = 'modal-carousel';
	const pista = document.createElement('div');
	pista.className = 'carousel-track';

	fotos.forEach(url => {
		const diapositiva = document.createElement('div');
		diapositiva.className = 'carousel-slide';
		const img = document.createElement('img');
		img.src = url;
		img.alt = alt;
		img.style.cursor = alAmpliar ? 'zoom-in' : 'default';
		if (alAmpliar) img.onclick = () => alAmpliar(url);
		diapositiva.appendChild(img);
		pista.appendChild(diapositiva);
	});

	const puntosWrap = document.createElement('div');
	puntosWrap.className = 'carousel-dots';
	const puntos = fotos.map((_, i) => {
		const punto = document.createElement('div');
		punto.className = 'carousel-dot' + (i === 0 ? ' active' : '');
		punto.onclick = () => irA(i);
		puntosWrap.appendChild(punto);
		return punto;
	});

	function irA(idx) {
		actual = idx;
		pista.style.transform = `translateX(-${idx * 100}%)`;
		puntos.forEach((d, i) => d.classList.toggle('active', i === idx));
	}

	// El deslizamiento se detiene aquí: si subiera, los temas que usan el
	// gesto para otra cosa —pasar de producto, cerrar la ficha— reaccionarían
	// también y se pasarían dos fotos de golpe, o se cerraría el modal.
	let inicioX = 0;
	carrusel.addEventListener('touchstart', e => { inicioX = e.touches[0].clientX; }, { passive: true });
	carrusel.addEventListener('touchend', e => {
		const diff = inicioX - e.changedTouches[0].clientX;
		if (Math.abs(diff) > 40) {
			if (diff > 0 && actual < fotos.length - 1) irA(actual + 1);
			if (diff < 0 && actual > 0)                irA(actual - 1);
		}
		e.stopPropagation();
	});

	carrusel.appendChild(pista);
	carrusel.appendChild(puntosWrap);
	return carrusel;
}
