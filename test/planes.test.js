// Qué incluye cada plan. Es una tabla, pero de ella depende qué ve el
// comensal y qué puede cobrar el restaurante, así que conviene fijarla.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PLANES, PLAN_POR_DEFECTO, planDe, MODELOS, MODELO_POR_DEFECTO, modeloDe } from '../core/planes.js';

const conPlan = plan => planDe({ atributos: { plan } });

describe('planDe · a qué plan corresponde un restaurante', () => {
	test('un restaurante sin plan cae en el de por defecto', () => {
		// 'pedidos' es exactamente lo que hacía la plataforma antes de que
		// existieran los planes: quien no tenga uno asignado no nota nada.
		assert.equal(planDe({ atributos: {} }), PLANES[PLAN_POR_DEFECTO]);
		assert.equal(planDe({}), PLANES[PLAN_POR_DEFECTO]);
		assert.equal(planDe(null), PLANES[PLAN_POR_DEFECTO]);
	});

	test('un plan que no existe tampoco deja al restaurante sin nada', () => {
		// Un valor mal escrito en la base no puede apagarle la carta a nadie.
		assert.equal(conPlan('platino_ultra'), PLANES[PLAN_POR_DEFECTO]);
	});
});

describe('capacidades por plan', () => {
	test('el carrito es capacidad, no solo modelo de página', () => {
		// Antes 'carrito' solo existía como plantilla. Ahora es un interruptor
		// que otros modelos pueden encender —el de video, el primero— sin que
		// haya que copiar la maquinaria a cada tema.
		assert.equal(conPlan('vitrina').carrito, false, 'vitrina es solo escaparate');
		assert.equal(conPlan('pedidos').carrito, true);
		assert.equal(conPlan('completo').carrito, true);
		assert.equal(conPlan('video').carrito, true);
	});

	test('solo el plan de video abre la subida de video', () => {
		// Convertir cuesta minuto y medio de CPU por archivo: es la capacidad
		// más cara de la plataforma y va sola en su plan.
		for (const p of ['vitrina', 'pedidos', 'completo'])
			assert.equal(conPlan(p).videos, false, `${p} no debería`);
		assert.equal(conPlan('video').videos, true);
	});

	test('los modelos de video solo los lista el plan de video', () => {
		// Son dos encuadres de lo mismo: 'video' apaisado y 'vertical' a
		// pantalla completa. Los dos sirven archivos de video, así que los dos
		// cuestan almacenamiento y conversión, y ninguno puede aparecer en un
		// plan que no los paga. Al añadir un tercer encuadre va aquí.
		const deVideo = ['video', 'vertical'];
		for (const p of ['vitrina', 'pedidos', 'completo'])
			for (const m of deVideo)
				assert.equal(conPlan(p).modelos.includes(m), false, `${p} no debería listar "${m}"`);
		for (const m of deVideo)
			assert.ok(conPlan('video').modelos.includes(m), `el plan de video debería listar "${m}"`);
	});

	test('el plan que trae modelos de video es el que abre la subida', () => {
		// Un plan que listara 'vertical' sin 'videos: true' daría una carta
		// que solo sabe pintar video a un restaurante que no puede subirlo:
		// pantallas negras con el nombre del plato encima.
		const deVideo = ['video', 'vertical'];
		for (const [nombre, plan] of Object.entries(PLANES))
			if (plan.modelos.some(m => deVideo.includes(m)))
				assert.equal(plan.videos, true, `${nombre} lista un modelo de video pero no abre la subida`);
	});

	test('todos los planes declaran todas las capacidades', () => {
		// Una bandera que falta se lee como undefined, o sea como "no", y
		// entonces un plan pierde algo sin que nadie lo haya decidido. Que
		// estén todas escritas obliga a tomar la decisión al añadir una.
		const banderas = ['marca', 'qr_disenador', 'estadisticas', 'horarios', 'videos', 'carrito'];
		for (const [nombre, plan] of Object.entries(PLANES))
			for (const b of banderas)
				assert.equal(typeof plan[b], 'boolean', `${nombre} no declara "${b}"`);
	});

	test('cada plan dice qué modelos permite', () => {
		for (const [nombre, plan] of Object.entries(PLANES))
			assert.ok(Array.isArray(plan.modelos) && plan.modelos.length, `${nombre} sin modelos`);
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
