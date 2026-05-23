// ── SUPABASE CONFIG ───────────────────────────────────────────
// Un solo lugar. Nunca más en cada página.
const SUPABASE_URL = 'https://tllpmdhkdlqoqpnqmuwn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_PqQsGWYjDAu8oq9ABB1hnQ_658qW8RB';

export async function sbFetch(tabla, params = '') {
	const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?${params}`, {
		headers: {
			'apikey': SUPABASE_KEY,
			'Authorization': `Bearer ${SUPABASE_KEY}`
		}
	});
	if (!res.ok) throw new Error(`Supabase error ${res.status} en ${tabla}`);
	return res.json();
}
