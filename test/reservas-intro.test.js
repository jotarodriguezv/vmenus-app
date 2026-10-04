// Las reservas de mesa en la bienvenida (01/10/2026). El restaurante las
// enciende en el panel; la carta pinta el botón y un formulario dentro de la
// tarjeta y manda la reserva al panel. Reglas de verdad: reservas.js del panel.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const R = await import('../core/reservas-intro.js');
const HOY = '2026-10-01';
const buena = (extra = {}) => ({ nombre: 'Ana', celular: '300 123 4567', fecha: '2026-10-05', hora: '19:30', personas: '4', ...extra });

describe('el botón', () => {
	test('solo sale con el interruptor en true de verdad', () => {
		assert.match(R.botonReservaIntro({ intro_reservas_activo: true }), /data-reservar/);
		for (const at of [null, {}, { intro_reservas_activo: false }, { intro_reservas_activo: 'true' }, { intro_reservas_activo: 1 }]) {
			assert.equal(R.botonReservaIntro(at), '', JSON.stringify(at));
		}
	});

	test('el texto es el del restaurante, recortado, o «Reservar mesa»', () => {
		assert.equal(R.textoBotonReserva({}), 'Reservar mesa');
		assert.equal(R.textoBotonReserva({ intro_reservas_texto: '   ' }), 'Reservar mesa');
		assert.equal(R.textoBotonReserva({ intro_reservas_texto: 'Aparta tu mesa' }), 'Aparta tu mesa');
		assert.equal(R.textoBotonReserva({ intro_reservas_texto: 'x'.repeat(100) }).length, 40);
	});

	test('el texto del restaurante se escapa: viaja a un navegador público', () => {
		const html = R.botonReservaIntro({ intro_reservas_activo: true, intro_reservas_texto: '<img src=x onerror=alert(1)>' });
		assert.ok(!html.includes('<img'));
		assert.ok(html.includes('&lt;img'));
	});
});

describe('el formulario', () => {
	const form = R.formularioReservaIntro({ intro_reservas_activo: true }, HOY);

	test('apagado no pinta nada', () => {
		assert.equal(R.formularioReservaIntro({}, HOY), '');
	});

	test('tiene el título y los cinco campos que pidió el usuario', () => {
		assert.match(form, /Aparta tu mesa con anticipación/);
		for (const n of ['nombre', 'celular', 'fecha', 'hora', 'personas']) assert.match(form, new RegExp(`name="${n}"`), n);
	});

	test('la fecha se limita de hoy a 90 días, con el «hoy» que se le pase', () => {
		assert.match(form, /type="date" min="2026-10-01" max="2026-12-30"/);
	});

	test('cada campo tiene su etiqueta, para que un lector de pantalla los nombre', () => {
		for (const id of ['introResNombre', 'introResCelular', 'introResFecha', 'introResHora', 'introResPersonas']) {
			assert.match(form, new RegExp(`for="${id}"`), id);
			assert.match(form, new RegExp(`id="${id}"`), id);
		}
	});

	test('lleva el campo trampa, fuera del teclado y del lector de pantalla', () => {
		assert.match(form, /aria-hidden="true"><label>Sitio web<input name="sitio_web" type="text" tabindex="-1" autocomplete="off">/);
	});

	test('los campos tienen 16 px de letra: con menos el iPhone amplía la página al enfocarlos', () => {
		assert.match(R.ESTILOS_RESERVA, /\.intro-vmenus__reserva-form input\{[^}]*font:600 16px/);
	});

	test('lo que se esconde con hidden se esconde de verdad: un display:flex no lo anula', () => {
		// Pasó en la prueba en el navegador: el botón de enviar seguía a la vista tras la confirmación.
		assert.match(R.ESTILOS_RESERVA, /\.intro-vmenus__reserva-enviar\[hidden\]\{display:none\}/);
		assert.match(R.ESTILOS_RESERVA, /\.intro-vmenus__reserva-error\[hidden\]/);
	});

	test('los avisos son accesibles: el error es una alerta y la confirmación un estado', () => {
		assert.match(form, /class="intro-vmenus__reserva-error" role="alert" hidden/);
		assert.match(form, /class="intro-vmenus__reserva-ok" role="status" hidden/);
	});
});

describe('errorDeReserva', () => {
	test('una buena no da error', () => assert.equal(R.errorDeReserva(buena(), HOY), null));

	test('cada campo mal da su mensaje', () => {
		assert.match(R.errorDeReserva(buena({ nombre: '  ' }), HOY), /nombre/);
		assert.match(R.errorDeReserva(buena({ celular: '12' }), HOY), /celular/);
		assert.match(R.errorDeReserva(buena({ fecha: '' }), HOY), /fecha/i);
		assert.match(R.errorDeReserva(buena({ fecha: '2026-09-30' }), HOY), /ya pasó/);
		assert.match(R.errorDeReserva(buena({ fecha: '2026-12-31' }), HOY), /90 días/);
		assert.match(R.errorDeReserva(buena({ hora: '' }), HOY), /hora/i);
		assert.match(R.errorDeReserva(buena({ personas: '0' }), HOY), /personas/);
		assert.match(R.errorDeReserva(buena({ personas: '2.5' }), HOY), /personas/);
		assert.match(R.errorDeReserva(buena({ personas: '51' }), HOY), /50/);
	});

	test('hoy y el día 90 sí valen', () => {
		assert.equal(R.errorDeReserva(buena({ fecha: '2026-10-01' }), HOY), null);
		assert.equal(R.errorDeReserva(buena({ fecha: '2026-12-30' }), HOY), null);
	});
});

describe('hoyEn: el día del restaurante, no el del aparato', () => {
	test('a las 9 pm en Bogotá todavía es el mismo día, aunque en UTC ya sea mañana', () => {
		const noche = new Date('2026-10-02T02:00:00Z');
		assert.equal(R.hoyEn('America/Bogota', noche), '2026-10-01');
		assert.equal(R.hoyEn('Asia/Tokyo', noche), '2026-10-02');
	});
	test('una zona inválida cae en Bogotá en vez de romper la bienvenida', () => {
		assert.equal(R.hoyEn('No/Existe', new Date('2026-10-02T02:00:00Z')), '2026-10-01');
	});
});

describe('lo que viaja al panel', () => {
	test('el cuerpo lleva los cinco datos, el campo trampa y la hora de apertura; personas como número', () => {
		const c = R.cuerpoDeReserva('rid', buena({ nombre: '  Ana ' }), { trampa: '', abiertoEn: 123 });
		assert.deepEqual(c, { restaurante_id: 'rid', nombre: 'Ana', celular: '300 123 4567', fecha: '2026-10-05', hora: '19:30', personas: 4, sitio_web: '', abierto_en: 123 });
	});

	test('una reserva buena devuelve ok, hacia /api/reservas con POST y JSON', async () => {
		let pedido;
		const r = await R.enviarReserva('https://panel.test', { a: 1 }, async (url, op) => { pedido = { url, op }; return { ok: true }; });
		assert.deepEqual(r, { ok: true });
		assert.equal(pedido.url, 'https://panel.test/api/reservas');
		assert.equal(pedido.op.method, 'POST');
		assert.equal(pedido.op.headers['Content-Type'], 'application/json');
		assert.deepEqual(JSON.parse(pedido.op.body), { a: 1 });
	});

	test('si el servidor rechaza, se enseña su motivo', async () => {
		const r = await R.enviarReserva('x', {}, async () => ({ ok: false, json: async () => ({ error: 'Esa fecha ya pasó' }) }));
		assert.deepEqual(r, { ok: false, error: 'Esa fecha ya pasó' });
	});

	test('si el servidor responde sin cuerpo legible, un mensaje genérico', async () => {
		const r = await R.enviarReserva('x', {}, async () => ({ ok: false, json: async () => { throw new Error('no json'); } }));
		assert.equal(r.ok, false);
		assert.match(r.error, /No pudimos registrar/);
	});

	test('sin red no lanza: devuelve un mensaje que se puede enseñar', async () => {
		const r = await R.enviarReserva('x', {}, async () => { throw new TypeError('Failed to fetch'); });
		assert.equal(r.ok, false);
		assert.match(r.error, /conectar/);
	});
});

describe('montarReservaIntro con una tarjeta de mentira', () => {
	// Solo lo que usa la función: querySelector, escuchas, dataset, hidden, value.
	function montaje() {
		const escuchas = {};
		const campo = valor => ({ value: valor, disabled: false });
		const aviso = () => ({ hidden: true, textContent: '' });
		const error = aviso(); const ok = aviso();
		const enviar = { disabled: false, hidden: false };
		const elementos = { nombre: campo('Ana'), celular: campo('3001234567'), fecha: campo(R.sumarDias(R.hoyEn('America/Bogota'), 5)), hora: campo('19:30'), personas: campo('3'), sitio_web: campo('') };
		const form = {
			elements: elementos,
			addEventListener(t, fn) { escuchas.form = { ...escuchas.form, [t]: fn }; },
			querySelector(s) { return { '.intro-vmenus__reserva-error': error, '.intro-vmenus__reserva-ok': ok, '.intro-vmenus__reserva-enviar': enviar, '[data-volver]': { addEventListener: (t, fn) => { escuchas.volver = fn; } }, '#introResNombre': { focus() {} } }[s]; },
			querySelectorAll() { return Object.values(elementos); },
		};
		const tarjeta = { dataset: {} };
		const boton = { addEventListener: (t, fn) => { escuchas.boton = fn; }, focus() {} };
		const raiz = { dataset: { zona: '' }, querySelector: s => ({ '.intro-vmenus__card': tarjeta, '[data-reservar]': boton, '.intro-vmenus__reserva-form': form }[s]) };
		return { raiz, tarjeta, error, ok, enviar, elementos, escuchas };
	}

	test('el botón abre la vista de reserva y «Volver» la cierra', () => {
		const m = montaje();
		R.montarReservaIntro(m.raiz, 'rid', 'https://panel.test');
		m.escuchas.boton();
		assert.equal(m.tarjeta.dataset.vista, 'reserva');
		m.escuchas.volver();
		assert.equal(m.tarjeta.dataset.vista, undefined);
	});

	test('con datos buenos envía, enseña la confirmación y bloquea el formulario', async () => {
		const m = montaje(); let cuerpo;
		R.montarReservaIntro(m.raiz, 'rid', 'https://panel.test', { fetchFn: async (_, op) => { cuerpo = JSON.parse(op.body); return { ok: true }; }, ahora: () => 1000 });
		await m.escuchas.form.submit({ preventDefault() {} });
		assert.equal(cuerpo.restaurante_id, 'rid');
		assert.equal(cuerpo.personas, 3);
		assert.equal(cuerpo.abierto_en, 1000);
		assert.equal(m.ok.hidden, false);
		assert.match(m.ok.textContent, /Ana/);
		assert.equal(m.enviar.hidden, true);
		assert.ok(Object.values(m.elementos).every(c => c.disabled));
	});

	test('tras una reserva enviada, «Volver» deja el formulario listo para otra', async () => {
		const m = montaje();
		R.montarReservaIntro(m.raiz, 'rid', 'x', { fetchFn: async () => ({ ok: true }) });
		await m.escuchas.form.submit({ preventDefault() {} });
		assert.equal(m.enviar.hidden, true);
		m.escuchas.volver();
		assert.equal(m.enviar.hidden, false);
		assert.equal(m.ok.hidden, true);
		assert.ok(Object.values(m.elementos).every(c => !c.disabled));
	});

	test('con un dato malo no envía y dice cuál', async () => {
		const m = montaje(); let envios = 0;
		m.elementos.celular.value = '1';
		R.montarReservaIntro(m.raiz, 'rid', 'x', { fetchFn: async () => { envios++; return { ok: true }; } });
		await m.escuchas.form.submit({ preventDefault() {} });
		assert.equal(envios, 0);
		assert.equal(m.error.hidden, false);
		assert.match(m.error.textContent, /celular/);
	});

	test('si el servidor rechaza, enseña su motivo y deja reintentar', async () => {
		const m = montaje();
		R.montarReservaIntro(m.raiz, 'rid', 'x', { fetchFn: async () => ({ ok: false, json: async () => ({ error: 'Ya tienes reservas pendientes' }) }) });
		await m.escuchas.form.submit({ preventDefault() {} });
		assert.equal(m.error.textContent, 'Ya tienes reservas pendientes');
		assert.equal(m.enviar.disabled, false, 'el botón vuelve a estar disponible');
		assert.equal(m.ok.hidden, true);
	});

	test('lo que escribió el robot en el campo trampa viaja tal cual, para que el servidor lo descarte', async () => {
		const m = montaje(); let cuerpo;
		m.elementos.sitio_web.value = 'spam';
		R.montarReservaIntro(m.raiz, 'rid', 'x', { fetchFn: async (_, op) => { cuerpo = JSON.parse(op.body); return { ok: true }; } });
		await m.escuchas.form.submit({ preventDefault() {} });
		assert.equal(cuerpo.sitio_web, 'spam');
	});
});

describe('la bienvenida lo usa', () => {
	const fuente = fs.readFileSync(new URL('../core/intro.js', import.meta.url), 'utf8');
	test('el formulario va dentro de la tarjeta, que es donde apuntan los estilos', () => {
		assert.match(fuente, /\$\{sedes \? '' : formularioReservaIntro\(at, hoyEn\(at\.zona_horaria\)\)\}<\/div>`;/);
		assert.match(fuente, /montarReservaIntro\(raiz, restaurante\.id, MAPA_API_URL\)/);
		assert.match(fuente, /style\.textContent \+= ESTILOS_RESERVA/);
	});
});
