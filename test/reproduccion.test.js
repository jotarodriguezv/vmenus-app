import test from 'node:test';
import assert from 'node:assert/strict';

// reproduccion.js consulta esta preferencia al cargarse. En el navegador es
// nativa; en Node la damos para probar su lógica pura sin DOM.
globalThis.window = { matchMedia: () => ({ matches: false }) };

const { tieneMultimedia } = await import('../core/reproduccion.js');

test('tieneMultimedia solo considera imagen o video realmente disponibles', () => {
	assert.equal(tieneMultimedia({ imagen_url: 'https://ejemplo.test/foto.webp' }), true);
	assert.equal(tieneMultimedia({ atributos: { video: { url: 'https://ejemplo.test/video.mp4' } } }), true);
	assert.equal(tieneMultimedia({ atributos: { sin_foto: true } }), false);
	assert.equal(tieneMultimedia({ atributos: { video: { portada: 'https://ejemplo.test/portada.webp' } } }), false);
	assert.equal(tieneMultimedia({}), false);
});
