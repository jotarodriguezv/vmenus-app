// ── EL AVISO DE VISTA PREVIA ──────────────────────────────────
// La carta pública acepta ?preview=<json> para que el panel enseñe cómo
// quedaría la apariencia antes de guardarla. Esa URL la puede armar
// cualquiera: no hace falta entrar al panel ni tener credenciales, y lo que
// se abre es la carta DE VERDAD — dominio, logo, platos y precios reales.
//
// El aviso amarillo es lo único que separa una vista previa de una carta real
// a ojos del comensal. Por eso vive aquí y no suelto dentro de loader.js:
// tiene reglas propias que hay que poder comprobar.
//
// Se defiende en dos capas, y hicieron falta las dos:
//
//   1. El CONTENIDO va en un shadow root cerrado, que el CSS de la página no
//      alcanza. Sin esto bastaba un selector por su color para esconderlo.
//
//   2. El ANFITRIÓN lleva sus propiedades con !important EN LÍNEA. Esto es lo
//      que faltaba: el shadow root protege lo de dentro, pero el <div> que lo
//      sostiene está en el DOM normal, y un `div{display:none!important}` de
//      una hoja de autor le gana a un estilo en línea SIN !important. Con
//      ellas la cascada se invierte —el !important en línea gana al de autor—
//      y el aviso no se puede tapar.
//
// Comprobado con navegador de verdad contra las siete formas conocidas de
// esconder un elemento. Si aparece una nueva, va a esta lista.
export const BLINDAJE_AVISO = {
	position: 'fixed', top: '0', left: '0', right: '0', 'z-index': '2147483647',
	display: 'block', opacity: '1', visibility: 'visible', transform: 'none',
	height: 'auto', 'max-height': 'none', overflow: 'visible',
	filter: 'none', 'clip-path': 'none', 'pointer-events': 'auto',
};

// setProperty con 'important' y no style.cssText: cssText no admite marcar
// prioridad, y sin prioridad esto no sirve para nada. Es toda la diferencia
// entre un aviso que se ve siempre y uno que se esconde con una línea de CSS.
export function blindarAnfitrion(el) {
	for (const [prop, valor] of Object.entries(BLINDAJE_AVISO))
		el.style.setProperty(prop, valor, 'important');
	return el;
}
