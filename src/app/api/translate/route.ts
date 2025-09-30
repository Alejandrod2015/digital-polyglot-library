import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json() as { texts?: string[] };

    const items: string[] = Array.isArray(body.texts) ? body.texts : [];
    if (items.length === 0) {
      return NextResponse.json({ translations: [] });
    }

    const params = new URLSearchParams();
    params.set('source_lang', 'ES');
    params.set('target_lang', 'EN');
    params.set('split_sentences', '0');
    params.set('preserve_formatting', '1');

    items.forEach((t) => params.append('text', t));

    const deeplRes = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `DeepL-Auth-Key ${process.env.DEEPL_KEY}`,
      },
      body: params,
    });

    const data = await deeplRes.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
  }
}
