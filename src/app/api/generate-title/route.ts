import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { title, text } = await req.json();

  const prompt = `You are a creative assistant for a language-learning app.
Generate a short, catchy title in the same language as the story content.
If the story is missing, invent a neutral example. Return ONLY the title text.`;

  const result = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: text || 'Generate a sample story title.' },
      ],
    }),
  }).then((r) => r.json());

  const aiText = result.choices?.[0]?.message?.content?.trim();

  return NextResponse.json({ result: aiText || 'Untitled Story' });
}
