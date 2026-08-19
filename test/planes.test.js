// Qué incluye cada plan. Es una tabla, pero de ella depende qué ve el
// comensal y qué puede cobrar el restaurante, así que conviene fijarla.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PLANES, PLAN_POR_DEFECTO, planDe } from '../core/planes.js';

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

	test('el modelo de video solo lo lista el plan de video', () => {
		for (const p of ['vitrina', 'pedidos', 'completo'])
			assert.equal(conPlan(p).modelos.includes('video'), false, `${p} no debería`);
		assert.ok(conPlan('video').modelos.includes('video'));
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
