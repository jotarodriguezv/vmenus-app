// Qué incluye cada plan. Es una tabla, pero de ella depende qué ve el
// comensal y qué puede cobrar el restaurante, así que conviene fijarla.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PLANES, PLAN_POR_DEFECTO, planDe, nombrePlanDe, MODELOS, MODELO_POR_DEFECTO, modeloDe } from '../core/planes.js';

const conPlan = (plan, nav) => planDe({ atributos: { plan, nav } });

describe('planDe · a qué plan corresponde un restaurante', () => {
	test('hay dos planes, que son los dos tipos de carta', () => {
		// Decidido el 17/09/2026: fotos o video, con todo lo demás incluido.
		assert.equal(JSON.stringify(Object.keys(PLANES)), '["fotos","video"]');
	});

	test('los planes de antes siguen entendiéndose, como Fotos', () => {
		// Bonzas y Malparados están guardados como «completo» hasta que se migren.
		// Si no se entendiera, caerían en el de por defecto sin que nadie lo decida.
		for (const viejo of ['vitrina', 'pedidos', 'completo'])
			assert.equal(conPlan(viejo, 'topnav'), PLANES.fotos, viejo);
		assert.equal(conPlan('video', 'vertical'), PLANES.video);
	});

	test('sin plan manda el modelo: una carta de video es del plan de video', () => {
		// Antes caía siempre en «pedidos», y una carta de video sin plan
		// guardado quedaba en un plan que no abre la subida de video.
		assert.equal(planDe({ atributos: {} }), PLANES.fotos);
		assert.equal(planDe({}), PLANES.fotos);
		assert.equal(planDe(null), PLANES.fotos);
		assert.equal(conPlan(undefined, 'video'), PLANES.video);
		assert.equal(conPlan(undefined, 'vertical'), PLANES.video);
		assert.equal(nombrePlanDe({ atributos: { nav: 'explorar' } }), 'fotos');
	});

	test('un plan que no existe tampoco deja al restaurante sin nada', () => {
		// Un valor mal escrito en la base no puede apagarle la carta a nadie.
		assert.equal(conPlan('platino_ultra', 'sidebar'), PLANES.fotos);
		assert.equal(conPlan('platino_ultra', 'video'), PLANES.video);
		assert.equal(PLANES[PLAN_POR_DEFECTO], PLANES.fotos);
	});
});

describe('qué incluye cada plan', () => {
	test('todo va incluido en los dos: cada restaurante enciende lo que usa', () => {
		for (const [nombre, plan] of Object.entries(PLANES)) {
			for (const b of ['qr_disenador', 'estadisticas', 'horarios', 'carrito', 'tv'])
				assert.equal(plan[b], true, `${nombre} debería incluir «${b}»`);
			assert.equal(plan.marca, false, `${nombre} no lleva el pie «Hecho con VMenus»`);
		}
	});

	test('solo el plan de video abre la subida de video', () => {
		// Es lo único que de verdad cuesta: almacenar, convertir y servir archivos.
		assert.equal(PLANES.fotos.videos, false);
		assert.equal(PLANES.video.videos, true);
	});

	test('los modelos de fotos y los de video no se mezclan', () => {
		// Las cuadrículas y las proporciones son distintas: un modelo de fotos no
		// sirve para una carta de video, ni al revés.
		assert.equal(JSON.stringify(PLANES.fotos.modelos), '["topnav","sidebar","explorar"]');
		assert.equal(JSON.stringify(PLANES.video.modelos), '["video","vertical"]');
	});

	test('el modelo Carrito ya no se ofrece en ningún plan', () => {
		for (const [nombre, plan] of Object.entries(PLANES))
			assert.equal(plan.modelos.includes('carrito'), false, nombre);
	});

	test('el plan que trae modelos de video es el que abre la subida', () => {
		// Un plan que listara 'vertical' sin 'videos: true' daría una carta que
		// solo sabe pintar video a un restaurante que no puede subirlo.
		const deVideo = ['video', 'vertical'];
		for (const [nombre, plan] of Object.entries(PLANES))
			if (plan.modelos.some(m => deVideo.includes(m)))
				assert.equal(plan.videos, true, `${nombre} lista un modelo de video pero no abre la subida`);
	});

	test('todos los planes declaran todas las capacidades', () => {
		// Una bandera que falta se lee como undefined, o sea como «no», y un plan
		// perdería algo sin que nadie lo haya decidido.
		const banderas = ['marca', 'qr_disenador', 'estadisticas', 'horarios', 'videos', 'carrito', 'tv'];
		for (const [nombre, plan] of Object.entries(PLANES))
			for (const b of banderas)
				assert.equal(typeof plan[b], 'boolean', `${nombre} no declara "${b}"`);
	});
});

// ── MODELOS ───────────────────────────────────────────────────
// El nombre del modelo se usa para importar un archivo. Uno que no exista no
// da un fallo pequeño: tumba el arranque entero y el visitante ve "No se pudo
// cargar el menú" en vez de la carta.
describe('modeloDe · qué plantilla se carga', () => {
	test('la lista sale de los planes y no de una copia a mano', () => {
		// Si se escribiera aparte, un modelo nuevo entraría en un plan y no en
		// la lista, y su carta caería al de por defecto sin que nadie supiera
		// por qué.
		for (const p of Object.values(PLANES))
			for (const m of p.modelos)
				assert.ok(MODELOS.includes(m), `${m} está en un plan pero no en MODELOS`);
	});

	test('el modelo Carrito se sigue pintando mientras haya restaurantes con él', () => {
		// aojocerrado y perroscriollos, de prueba, hasta que se migren a Sidebar.
		assert.equal(modeloDe({ atributos: { nav: 'carrito' } }), 'carrito');
	});

	test('un modelo válido se respeta', () => {
		assert.equal(modeloDe({ atributos: { nav: 'vertical' } }), 'vertical');
		assert.equal(modeloDe({ atributos: { nav: 'video' } }), 'video');
	});

	test('una errata en el panel no apaga la carta', () => {
		// Antes 'vertikal' llegaba a import('../temas/vertikal.js'), que lanza,
		// y el catch del arranque dejaba la carta en un mensaje de error.
		assert.equal(modeloDe({ atributos: { nav: 'vertikal' } }), MODELO_POR_DEFECTO);
		assert.equal(modeloDe({ atributos: { nav: '' } }), MODELO_POR_DEFECTO);
	});

	test('un restaurante sin modelo elegido usa el de por defecto', () => {
		assert.equal(modeloDe({ atributos: {} }), MODELO_POR_DEFECTO);
		assert.equal(modeloDe({}), MODELO_POR_DEFECTO);
		assert.equal(modeloDe(null), MODELO_POR_DEFECTO);
	});

	test('no se puede pedir un archivo de fuera de temas/', () => {
		// El valor acaba en una ruta de import; que solo pueda ser uno de los
		// conocidos es lo que lo hace inofensivo.
		assert.equal(modeloDe({ atributos: { nav: '../core/supabase' } }), MODELO_POR_DEFECTO);
	});
});
