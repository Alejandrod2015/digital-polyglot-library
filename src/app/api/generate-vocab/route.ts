import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { text } = await req.json();

  const prompt = `Extract a list of 15–25 useful words or phrases from the story below.
Respond as valid JSON with the format:
[
  {"word": "...", "definition": "..."},
  ...
]`;

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
        { role: 'user', content: text || 'No story text provided.' },
      ],
    }),
  }).then((r) => r.json());

  const aiText = result.choices?.[0]?.message?.content?.trim();

  return NextResponse.json({ result: aiText });
}
