import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { word, snippet } = await req.json();

    if (!word && !snippet) {
      return NextResponse.json({ contextTranslation: null, wordTranslations: [] });
    }

    const params = new URLSearchParams();
    params.set('target_lang', 'EN');
    params.set('split_sentences', '0');
    params.set('preserve_formatting', '1');

    if (word) params.append('text', word);
    if (snippet) params.append('text', snippet);

    const deeplRes = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `DeepL-Auth-Key ${process.env.DEEPL_KEY}`,
      },
      body: params,
    });

    if (!deeplRes.ok) {
      return NextResponse.json({ error: 'DeepL request failed' }, { status: deeplRes.status });
    }

    const data = await deeplRes.json();
    const translations = data.translations?.map((t: any) => t.text) || [];

    return NextResponse.json({
      wordTranslations: translations.length > 0 ? [translations[0]] : [],
      contextTranslation: translations.length > 1 ? translations[1] : translations[0] || null,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
  }
}