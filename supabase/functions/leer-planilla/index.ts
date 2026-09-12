// ══════════════════════════════════════════════════════════════════════
// leer-planilla — convierte la foto de una planilla mensual en texto
//
// Por qué vive acá y no en el navegador: la clave del modelo de visión
// es un secreto. En el front cualquiera la saca del código y la usa a
// nuestro nombre. Acá vive en los secrets de Supabase y nunca baja al
// cliente; el navegador solo manda la foto y recibe el texto.
//
// Devuelve texto plano, una línea por día, que el parser de index2.html
// (plParsear) valida y muestra para revisar. La función NO escribe nada
// en la base: solo lee la imagen y responde.
//
// ── Desplegar ─────────────────────────────────────────────────────────
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy leer-planilla --no-verify-jwt
// ══════════════════════════════════════════════════════════════════════

const MODELO = 'claude-sonnet-5';

const INSTRUCCION = `Esta es la foto de una planilla mensual de turnos de un casino.

Devuelve UNA LÍNEA POR FILA de la tabla, exactamente en este formato:

DiaDeLaSemana NumeroDeDia TextoDelTurno

Ejemplos del formato esperado:
Martes 1 LIBRE
Jueves 3 7,5 Hrs 20:30 a 04:30
Sábado 19 LXF (7,5)

Reglas estrictas:
- Copia el texto del turno TAL CUAL aparece, sin reordenar ni interpretar.
- Respeta la coma decimal (7,5 — no 7.5) y los dos puntos de las horas.
- Incluye TODAS las filas, también las de abajo aunque se vean claras o borrosas.
- Mantén el orden de la tabla, de arriba hacia abajo.
- Si una fila no se lee con seguridad, escríbela igual con el texto que
  alcances a distinguir; NO la omitas y NO adivines horarios.
- No agregues encabezados, numeración, viñetas, comentarios ni el nombre
  de la persona. Solo las líneas de días.`;

Deno.serve(async (req: Request) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // TODO lo que responde esta función sale con 200, incluidos los errores,
  // que viajan en el campo `error`. No es capricho: con un 5xx la pasarela de
  // Supabase sustituye la respuesta por la suya —sin cabeceras CORS—, el
  // navegador la bloquea y el front no llega a leer el motivo. Pasó con un
  // 503 para "falta la clave": la app terminaba diciendo que la función no
  // estaba desplegada. El estado real va en `error`, que el front sí ve.
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    // Código propio para que la app pueda decir exactamente qué falta en vez
    // de mostrar un error genérico de servidor.
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return json({ error: 'SIN_CLAVE' });

    const { imagen } = await req.json();
    if (!imagen || typeof imagen !== 'string') return json({ error: 'Falta la imagen' });
    // ~8 MB de base64. El front ya la achica a 1600px; esto es solo el tope.
    if (imagen.length > 8_000_000) return json({ error: 'La imagen es demasiado grande' });

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imagen } },
            { type: 'text', text: INSTRUCCION },
          ],
        }],
      }),
    });

    if (!r.ok) {
      const detalle = await r.text();
      console.error('[leer-planilla] API', r.status, detalle);
      if (r.status === 401) return json({ error: 'CLAVE_INVALIDA' });
      if (r.status === 429) return json({ error: 'Demasiadas peticiones, esperá unos segundos y probá de nuevo' });
      if (r.status === 400 && /credit|balance/i.test(detalle)) return json({ error: 'SIN_SALDO' });
      return json({ error: 'El lector de imágenes respondió ' + r.status });
    }

    const data = await r.json();
    const texto = (data.content || [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('\n')
      .trim();

    if (!texto) return json({ error: 'No se reconoció ninguna fila en la foto' });
    return json({ texto });
  } catch (e) {
    console.error('[leer-planilla]', e);
    return json({ error: (e as Error).message || 'Error inesperado' });
  }
});
