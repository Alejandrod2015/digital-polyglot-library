"use client";

// TEMPORAL / LOCAL; galería de audición de voces candidatas español de España
// (Traveler ES Spain). No commitear/deployar; borrar cuando se cierre el casting.

type Voice = { n: number; name: string; role: string; picked?: boolean; url: string };

const VOICES: Voice[] = [
  { n: 1, name: "Roque – Documentaries/Narrations", role: "Narrador", picked: true, url: "https://storage.googleapis.com/eleven-public-prod/database/workspace/d38e54c673484ff78254aa63ec9c299c/voices/Yqxik8v3XlyYOTWnDIVu/pqQpZ3egvchW1IQ0dDkV.mp3" },
  { n: 2, name: "Javier Rojas – Learning & Storytelling", role: "Narrador", picked: true, url: "https://storage.googleapis.com/eleven-public-prod/database/workspace/4759e774e7e14f5fb4aa2c6ea5d7297e/voices/eHAEFkimnYz57pupUMcq/70xN6JnMtjwng3BUhBb3.mp3" },
  { n: 3, name: "Susana – Documentary", role: "Narradora / F media", picked: true, url: "https://storage.googleapis.com/eleven-public-prod/database/workspace/88af9142cdf64550bca3b4277f09a963/voices/py37pY8QUQdhW5a7JwPG/UBBsNHFbxzjuuz2vPTUr.mp3" },
  { n: 6, name: "Luca", role: "Chico joven", picked: true, url: "https://storage.googleapis.com/eleven-public-prod/database/workspace/4fb0532cd95d4e40903261874e82cf24/voices/XJWCXmejYcvojtfGd3Mk/o3wQmoq78dSiattrMgA0.mp3" },
  { n: 20, name: "Miquel – Spanish Podcast", role: "Chico joven", picked: true, url: "https://storage.googleapis.com/eleven-public-prod/database/workspace/5b95caa6a4714032b91eac5255af5a93/voices/eZCjPaC4W7mcOOERqE5n/W7KsCN6UQIkeADGtEdPC.mp3" },
  { n: 12, name: "Alba", role: "Chica joven", picked: true, url: "https://storage.googleapis.com/eleven-public-prod/database/workspace/660f03eb16e34f5a953e721174754a86/voices/f18RlRJGEw0TaGYwmk8B/zoJ3hUWvNZGDqUJNq12H.mp3" },
  { n: 13, name: "Cora – Relaxed & Natural", role: "Chica joven", picked: true, url: "https://storage.googleapis.com/eleven-public-prod/database/user/user_7201kfefee9keps98hz4s21f0tex/voices/Sp57wugtIMQc3lhms94f/UhxYwcPYxos7V42lXNk0.mp3" },
  { n: 14, name: "Diana López", role: "Chica joven", picked: true, url: "https://storage.googleapis.com/eleven-public-prod/database/workspace/9a7a981b4fd44ad394ee75149391254b/voices/aTbJG0ZdQTT0lXCvJJWc/f1abb6d2-c61b-4bac-bb79-9e1b60fa6acf.mp3" },
  { n: 9, name: "Sheila – Spanish", role: "Mujer media", picked: true, url: "https://api.us.elevenlabs.io/v1/voices/XWuTx9ClCtLoYjuLF6Fa/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJjdXN0b20iLCJ3b3Jrc3BhY2VfaWQiOiI4ODZmMWNmOGU3NDM0MjIyOWVjNGE4OWMzMzg2NGYyMCIsImZpbGVuYW1lIjoiVlkyS1djWDZYWVlrenl4WGp3Zk4ubXAzIiwidGltZXN0YW1wIjoxNzgxMzQ0ODAwMDAwMDAwfQ%3D%3D" },
  { n: 15, name: "Estela – Conversacional peninsular", role: "Mujer media", picked: true, url: "https://storage.googleapis.com/eleven-public-prod/database/workspace/c213a98773dd4adc98a22467e4517777/voices/iuYybvSfclFoJ9ab2Im6/5ScCYV7tbMNKkHsvBhjn.mp3" },
  { n: 10, name: "Milo – Conversational & Casual", role: "Hombre medio", picked: true, url: "https://storage.googleapis.com/eleven-public-prod/database/workspace/ac6c6c2475f34d58a92e059261e8230f/voices/v4b4rQBhckrIsOHsrbub/ngAKDI1Cq864TeDX2UjE.mp3" },
  { n: 11, name: "Javi – Relaxed and Natural (ES)", role: "Hombre medio", picked: true, url: "https://api.us.elevenlabs.io/v1/voices/gQLV6zBnMa9rDESaeDz9/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJjdXN0b20iLCJ3b3Jrc3BhY2VfaWQiOiJmNDQ5MDIwNmVlNmM0MTM3ODA3MWY4OWEwZDUxY2UwMiIsImZpbGVuYW1lIjoiYzMxZWFjMDYtMjE2Ni00ODY5LWIxNjAtZGM4ZTJkNzlkZjUyLm1wMyIsInRpbWVzdGFtcCI6MTc4MTM0NDgwMDAwMDAwMH0%3D" },
  { n: 21, name: "Efraim Yorman – Warm, Solid", role: "Hombre medio", picked: true, url: "https://api.us.elevenlabs.io/v1/voices/uVoJJFOcQglSD16zUGOl/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJjdXN0b20iLCJ3b3Jrc3BhY2VfaWQiOiJhYjdhMmM2Y2E2MzE0MWI3OTU5OTdiMmEwZjUwOWU3MSIsImZpbGVuYW1lIjoiaGlQRUxUeHI4aWZsaDQ5alZ4bXUubXAzIiwidGltZXN0YW1wIjoxNzgxMzY2NDAwMDAwMDAwfQ%3D%3D" },
  { n: 22, name: "Rosa – Neutral, Calm & Genuine", role: "Abuela (F mayor)", url: "https://storage.googleapis.com/eleven-public-prod/custom/voices/ypIbR1aohyRSdDv25DPr/pwTUKYxrmFPl0kglwrfb.mp3" },
  { n: 23, name: "Tete – Slow, Reflexive & Soft", role: "Abuela (F mayor)", url: "https://api.us.elevenlabs.io/v1/voices/RTuKyXJgRGAQSx8Qz8Mf/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJjdXN0b20iLCJ3b3Jrc3BhY2VfaWQiOiIxN2VkYjhlYThlMjY0YzlmOTBkMThmODc3ZGRlMmQ0MiIsImZpbGVuYW1lIjoiSEhjZHh3aHZRY0hoc0JDMWxsQlQubXAzIiwidGltZXN0YW1wIjoxNzgxNDQyMDAwMDAwMDAwfQ%3D%3D" },
  { n: 24, name: "Alegría Sana – Diplomatic & Confident", role: "Abuela (F mayor)", url: "https://api.us.elevenlabs.io/v1/voices/9oWKy782oltLmeuOUdq7/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJjdXN0b20iLCJ3b3Jrc3BhY2VfaWQiOiJlY2MzZjMxODRlMzY0NGZiYWUxZDI5YTIxY2U3ZTdkMyIsImZpbGVuYW1lIjoiYk4zSXdkTjh1aHpLZnh0UEFYSFoubXAzIiwidGltZXN0YW1wIjoxNzgxNDQyMDAwMDAwMDAwfQ%3D%3D" },
  { n: 25, name: "Luis – Polished, Mature & Credible", role: "Abuelo (M mayor)", url: "https://storage.googleapis.com/eleven-public-prod/database/workspace/8f832f68794e4e7cb6cdb17339b25e9c/voices/GojDwihhnL1f7RrBuXsJ/4QJcYrdP20KGernlza4s.mp3" },
  { n: 26, name: "Rafael – Expressive & Theatrical", role: "Abuelo (M mayor); ojo teatral", url: "https://storage.googleapis.com/eleven-public-prod/database/workspace/70aeebf22b3d4b519e6b9d205612971d/voices/orF2qy9215xjwqqxqsWW/SJmtVEhMG2bXkGRJXG69.mp3" },
];

export default function VocesESPage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Voces candidatas; Español de España</h1>
      <p style={{ color: "#888", marginBottom: 24 }}>
        Dale al play en cada una. Las del bloque inferior (22-26) son las voces mayores (abuelos), que es lo que falta decidir.
      </p>
      {VOICES.map((v) => (
        <div key={v.n} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderBottom: "1px solid #eee" }}>
          <span style={{ width: 28, textAlign: "right", fontWeight: 600, color: v.picked ? "#1d9e75" : "#c8841f" }}>{v.n}</span>
          <div style={{ width: 280 }}>
            <div style={{ fontWeight: 500 }}>{v.name}</div>
            <div style={{ fontSize: 13, color: "#888" }}>{v.role}{v.picked ? " · elegida" : ""}</div>
          </div>
          <audio controls preload="none" src={v.url} style={{ flex: 1, height: 36 }} />
        </div>
      ))}
    </main>
  );
}
