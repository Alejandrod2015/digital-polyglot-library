import { NextRequest } from "next/server";

// Server-side proxy for free ElevenLabs preview MP3s.
// Why this exists: ElevenLabs serves preview URLs with `Content-Type: text/plain`
// (whether storage.googleapis.com `.mp3` URLs or api.us.elevenlabs.io payload URLs).
// Some browsers/configurations download instead of playing inline. By proxying
// here and forcing `Content-Type: audio/mpeg`, every modern browser plays inline.
//
// Whitelisted IDs only — no SSRF. To add a voice, paste its preview_url here.
// Source: GET /v1/shared-voices (free; no generation, no credit cost).

const VOICE_PREVIEWS: Record<string, string> = {
  // Approved Spanish dialogue cast
  Po9nYFo9ScA7odSuQLIW: "https://storage.googleapis.com/eleven-public-prod/database/workspace/5c98d742b3a64cc9ace764f1f030f624/voices/Po9nYFo9ScA7odSuQLIW/xUd7Qr2rDXUbIIUk2NlR.mp3",
  "57D8YIbQSuE3REDPO6Vm": "https://storage.googleapis.com/eleven-public-prod/database/workspace/1da06ea679a54975ad96a2221fe6530d/voices/57D8YIbQSuE3REDPO6Vm/cab399de-2979-428d-8fff-86236bc92d22.mp3",
  "1ZhMG5ZZgJ6XpkOrB8Az": "https://storage.googleapis.com/eleven-public-prod/database/workspace/ca5aa978cbdf45d0a5bb6025dc22b785/voices/1ZhMG5ZZgJ6XpkOrB8Az/jn86qbxh2loi5B2JRMXv.mp3",
  "3ttovAt5bt3Kk38UGIob": "https://storage.googleapis.com/eleven-public-prod/database/workspace/c4a1a4b6cffe410ba65d7e02c9c25b5e/voices/3ttovAt5bt3Kk38UGIob/preview.mp3",
  nAFxIJGj7iSTeltygOfB: "https://storage.googleapis.com/eleven-public-prod/database/workspace/a81cffb0e9d040f3bb0eb2db26c4603d/voices/nAFxIJGj7iSTeltygOfB/ywHX7pYF0WbKuamEHkAK.mp3",
  PoLFkTquRWtbexdwW3Xa: "https://storage.googleapis.com/eleven-public-prod/database/workspace/968825d5b11844ebbcea86fbb7b5a642/voices/PoLFkTquRWtbexdwW3Xa/kDXWCdCiodQ12VAMe5aJ.mp3",
  "9rvdnhrYoXoUt4igKpBw": "https://storage.googleapis.com/eleven-public-prod/database/user/L2B5JJnBamUGYrPZi70BRhGxUGo2/voices/9rvdnhrYoXoUt4igKpBw/eJt2Mk4mAxdLDY9DMynR.mp3",
  acHf5gp7AGOY30tJjvD4: "https://api.us.elevenlabs.io/v1/voices/acHf5gp7AGOY30tJjvD4/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJjdXN0b20iLCJ3b3Jrc3BhY2VfaWQiOiIxZGEwNmVhNjc5YTU0OTc1YWQ5NmEyMjIxZmU2NTMwZCIsImZpbGVuYW1lIjoiNWY1NDVmYmItZTBhYS00ZGZlLTk1MGUtM2NhYWU5NzE2MmRiLm1wMyIsInRpbWVzdGFtcCI6MTc4MDMxMTYwMDAwMDAwMH0%3D",

  // Approved German dialogue cast
  Ww7Sq9tx9CCOiNOwWgsx: "https://storage.googleapis.com/eleven-public-prod/voices/Ww7Sq9tx9CCOiNOwWgsx/preview.mp3",
  WHaUUVTDq47Yqc9aDbkH: "https://storage.googleapis.com/eleven-public-prod/voices/WHaUUVTDq47Yqc9aDbkH/preview.mp3",
  KSEa36Zojh7KLdIkb8Qu: "https://storage.googleapis.com/eleven-public-prod/voices/KSEa36Zojh7KLdIkb8Qu/preview.mp3",
  "8SdTD5IMgFKT1jp7JbPC": "https://storage.googleapis.com/eleven-public-prod/voices/8SdTD5IMgFKT1jp7JbPC/preview.mp3",

  // Approved last 2 rounds (Mexican F young, Mexican M middle, Chilean F young, Chilean M young)
  ewn5JTa3lNPY8QVuZJi6: "https://api.us.elevenlabs.io/v1/voices/ewn5JTa3lNPY8QVuZJi6/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJjdXN0b20iLCJ3b3Jrc3BhY2VfaWQiOiI2OWY3NDgwMDVhZjQ0YjhlODYyMGMwZmIxN2ViYWVkMCIsImZpbGVuYW1lIjoiNWZkMzJlN2YtOWM5YS00NGIyLTg2M2UtMDdmMWEzOWFkM2Y3Lm1wMyIsInRpbWVzdGFtcCI6MTc4MDMxNTIwMDAwMDAwMH0%3D",
  DV9FrN0pQkPWIoxW5dvT: "https://storage.googleapis.com/eleven-public-prod/database/workspace/1da06ea679a54975ad96a2221fe6530d/voices/DV9FrN0pQkPWIoxW5dvT/jiLhPcPfQFwfY7RzjG3Y.mp3",
  "6Gr4AVmTax1pMJO0lHRK": "https://storage.googleapis.com/eleven-public-prod/database/workspace/9ddf7c8ac80844a1b0abfd7800976c4b/voices/6Gr4AVmTax1pMJO0lHRK/y83Q678pQRdvmhICWICE.mp3",
  "6WgXEzo1HGn3i7ilT4Fh": "https://api.us.elevenlabs.io/v1/voices/6WgXEzo1HGn3i7ilT4Fh/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJjdXN0b20iLCJ1c2VyX2lkIjoiUGE1bzNaOFR1NU9ua2VLMzBuUzJPSTZzVmwwMyIsImZpbGVuYW1lIjoiOGY3ODdlNWYtZjMyOS00NTYxLWIxMmEtNDAyNDhhYjAzYWVmLm1wMyIsInRpbWVzdGFtcCI6MTc4MDMxNTIwMDAwMDAwMH0%3D",
  pBabaO9WxfrjXjKADHma: "https://storage.googleapis.com/eleven-public-prod/database/workspace/8a368ff2097c43af8a97e0526b68dce3/voices/pBabaO9WxfrjXjKADHma/a63b8831-b2d2-4689-bdfb-3fedd9b61a06.mp3",
  "77K94gl6ZCRVTHG8Gi1w": "https://storage.googleapis.com/eleven-public-prod/database/workspace/1da06ea679a54975ad96a2221fe6530d/voices/77K94gl6ZCRVTHG8Gi1w/8f8f7cf8-0b4a-4cfb-92d1-86c4798da2cd.mp3",
  UK00oAtGYBrHBUbesfMv: "https://storage.googleapis.com/eleven-public-prod/database/workspace/fcf849da20ce45a190ce7bd22d9445b6/voices/UK00oAtGYBrHBUbesfMv/qh8fxynvU2KCUjUfsBzL.mp3",
  "6Mo5ciGH5nWiQacn5FYk": "https://storage.googleapis.com/eleven-public-prod/database/workspace/b278ac7736434d48b8a05b2a6162de00/voices/6Mo5ciGH5nWiQacn5FYk/o4HrLH8KpxJUp60etPjT.mp3",

  // German candidate round (June 2026) — 10 voices to evaluate for the
  // German conversational beta (3 mini-casts Berlin/München/Hamburg).
  // Slots: 2× F young, 2× F older, 2× M older, 2× M middle-aged (alt to
  // Moritz), 2× M young (alt to Michael). Metadata is creator-set and
  // unreliable; user verifies accent/age by ear.
  e3bIMyLemdwvh75g9Vpt: "https://api.us.elevenlabs.io/v1/voices/e3bIMyLemdwvh75g9Vpt/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJjdXN0b20iLCJ3b3Jrc3BhY2VfaWQiOiJiNjZlZWQ5NWRjZTU0N2NhOTdmZmQ5ZGNhYjQ1ZmZiYiIsImZpbGVuYW1lIjoiVDVSMElUdEVocGllZGJUajZZWTYubXAzIiwidGltZXN0YW1wIjoxNzgwNDczNjAwMDAwMDAwfQ%3D%3D",
  SJJe86Va82zRzg6zi2dX: "https://api.us.elevenlabs.io/v1/voices/SJJe86Va82zRzg6zi2dX/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJjdXN0b20iLCJ3b3Jrc3BhY2VfaWQiOiJiNjZlZWQ5NWRjZTU0N2NhOTdmZmQ5ZGNhYjQ1ZmZiYiIsImZpbGVuYW1lIjoieUt0YnRBVmdoVmJnUFRGQTUybEMubXAzIiwidGltZXN0YW1wIjoxNzgwNDczNjAwMDAwMDAwfQ%3D%3D",
  oBVK5gDykyUkoVXUPyCU: "https://storage.googleapis.com/eleven-public-prod/database/workspace/631bf5a20c2d45ffacc1311eb5dec41f/voices/oBVK5gDykyUkoVXUPyCU/ibaSyNVKW59ny0nykqPP.mp3",
  hOBDmVrVUuqtp1I3KsIq: "https://storage.googleapis.com/eleven-public-prod/database/workspace/4af5070bca234973ba91bbc4cc73bf1e/voices/hOBDmVrVUuqtp1I3KsIq/Hr68oXo9f3AQmslfxTGM.mp3",
  NXRbaD5sq9vvgN6umlmm: "https://storage.googleapis.com/eleven-public-prod/database/workspace/a519d3af105741949de6a8a14a47cf62/voices/NXRbaD5sq9vvgN6umlmm/BNVD5wRVRkYqfbJoP202.mp3",
  xDveu0m1VTIcyigteOIZ: "https://storage.googleapis.com/eleven-public-prod/database/workspace/37563820710a40f1a5149c62903e99c7/voices/xDveu0m1VTIcyigteOIZ/q53z6WJBpUNWG2xjfbUu.mp3",
  IQuqJPpP2hMHjjDY2QTe: "https://storage.googleapis.com/eleven-public-prod/database/workspace/e669e33beddf448dbe62f313318a4a36/voices/IQuqJPpP2hMHjjDY2QTe/f1ec8e6e-3257-40e9-8c99-028f18dfa2c9.mp3",
  vTifwvQGTZT1q7epCu2b: "https://storage.googleapis.com/eleven-public-prod/database/workspace/617861a1e8ec461b8880f67d46063291/voices/vTifwvQGTZT1q7epCu2b/vbOmMIWWToiXjhhCVRi4.mp3",
  "95KdOEhYVFqJAU4IIlRK": "https://api.us.elevenlabs.io/v1/voices/95KdOEhYVFqJAU4IIlRK/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJjdXN0b20iLCJ3b3Jrc3BhY2VfaWQiOiI0ZjkxNTM2Y2JkNDA0Yjg2OGZhN2FjNTI2Y2QwODdlMCIsImZpbGVuYW1lIjoiRTlCSGQwS1NqcGNLc2l6OVl4TlEubXAzIiwidGltZXN0YW1wIjoxNzgwNDczNjAwMDAwMDAwfQ%3D%3D",
  "1QykRgkluVRz9xfOVUsh": "https://storage.googleapis.com/eleven-public-prod/database/workspace/ff74bcc1751a4a3d933a8622466e2c83/voices/1QykRgkluVRz9xfOVUsh/MMkHqrRgq4mz2VgZtv97.mp3",

  // German round 2 (June 2026) — 6 more for M older + M young slots
  pfvZahoGcT3NdpxRuNkg: "https://api.us.elevenlabs.io/v1/voices/pfvZahoGcT3NdpxRuNkg/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJjdXN0b20iLCJ3b3Jrc3BhY2VfaWQiOiJiMjhjYzRhOWQwMzg0Y2Y5ODU3ODQwNjQ0YjQyOTI4MSIsImZpbGVuYW1lIjoianhHdWRnQlFRd3FpcUJ2TGwwNEoubXAzIiwidGltZXN0YW1wIjoxNzgwNDczNjAwMDAwMDAwfQ%3D%3D",
  R3XXDwKMU2YHwBcuYUH3: "https://api.us.elevenlabs.io/v1/voices/R3XXDwKMU2YHwBcuYUH3/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJjdXN0b20iLCJ3b3Jrc3BhY2VfaWQiOiJiMjhjYzRhOWQwMzg0Y2Y5ODU3ODQwNjQ0YjQyOTI4MSIsImZpbGVuYW1lIjoiTUF3R09EbTBBVWxYTEh0SWFwVVoubXAzIiwidGltZXN0YW1wIjoxNzgwNDczNjAwMDAwMDAwfQ%3D%3D",
  "2HmIg4yvRgcH2ZDgiwGz": "https://storage.googleapis.com/eleven-public-prod/database/user/6PepXtO6L5eOWtYyGObg2TDYJex2/voices/2HmIg4yvRgcH2ZDgiwGz/KvLob4tdGz64nANs4Yup.mp3",
  GoXyzBapJk3AoCJoMQl9: "https://storage.googleapis.com/eleven-public-prod/database/user/8lFbpyj9WaVPcRPynJQfb7WMid32/voices/GoXyzBapJk3AoCJoMQl9/888d825f-bada-4624-82c2-07daf6a09c59.mp3",
  "8aPaMtDocayOBFDFyWHp": "https://api.us.elevenlabs.io/v1/voices/8aPaMtDocayOBFDFyWHp/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJjdXN0b20iLCJ3b3Jrc3BhY2VfaWQiOiJlNzY1MGI0ZDQ1ZTk0MmQzYmNmNGZhMWVkZDA3NWQyNSIsImZpbGVuYW1lIjoiM2U5eW9GQ09WU1FEdmJ2WkpPcTkubXAzIiwidGltZXN0YW1wIjoxNzgwNDczNjAwMDAwMDAwfQ%3D%3D",
  ygoBNrnmTEdu5NtDTmAY: "https://api.us.elevenlabs.io/v1/voices/ygoBNrnmTEdu5NtDTmAY/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJjdXN0b20iLCJ3b3Jrc3BhY2VfaWQiOiJiMjhjYzRhOWQwMzg0Y2Y5ODU3ODQwNjQ0YjQyOTI4MSIsImZpbGVuYW1lIjoiZ2dXT1ByelVmVUpjNzJkdDZuVjMubXAzIiwidGltZXN0YW1wIjoxNzgwNDczNjAwMDAwMDAwfQ%3D%3D",

  // German round 2 STRICT (June 2026) — filtered hard: only conversational
  // / narrative_story use_cases, no animation/fantasy/animal names.
  DsY1TMHF6R6uylNq96bs: "https://storage.googleapis.com/eleven-public-prod/database/user/W2pNjDhk8AeW0y0LyxBmbq5Jw5h1/voices/DsY1TMHF6R6uylNq96bs/Ox1x5yUbqEbRppErDrI4.mp3",
  cLemPw4efsDYbUMhZbhl: "https://storage.googleapis.com/eleven-public-prod/database/workspace/c698efeee7724b5a8434c36336a49f0f/voices/cLemPw4efsDYbUMhZbhl/ddb0679c-5336-454c-8f86-1120128af48d.mp3",
  nZpMT2RjIpaat0IaA7Sd: "https://api.us.elevenlabs.io/v1/voices/nZpMT2RjIpaat0IaA7Sd/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJjdXN0b20iLCJ3b3Jrc3BhY2VfaWQiOiI5MDY3NjljZWQ1NjA0MWQyOWNiMzAyMzhlMzZhNWRkMSIsImZpbGVuYW1lIjoiQ2w4S3FyVkxPS1diYlFFTXFnUlQubXAzIiwidGltZXN0YW1wIjoxNzgwNDczNjAwMDAwMDAwfQ%3D%3D",
  qIvYM790licxrEuzK2qI: "https://api.us.elevenlabs.io/v1/voices/qIvYM790licxrEuzK2qI/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJjdXN0b20iLCJ3b3Jrc3BhY2VfaWQiOiI2Mzg5YmUxNTgzYzI0MzIwYWM0OGY0Njk4ZTUyNzcyNCIsImZpbGVuYW1lIjoiM1NzSVFrM1diMzFGeGRWN3JUZ3oubXAzIiwidGltZXN0YW1wIjoxNzgwNDczNjAwMDAwMDAwfQ%3D%3D",
  HLL5Lh99l3pwG8HZW1N5: "https://api.us.elevenlabs.io/v1/voices/HLL5Lh99l3pwG8HZW1N5/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJjdXN0b20iLCJ3b3Jrc3BhY2VfaWQiOiJlZDliMDVlNjMyNGM0NTc2ODU0OTAzNTJlOWExZWM5MCIsImZpbGVuYW1lIjoiZG1YdnVxZXpLT2pZYWN0YWtQTlcubXAzIiwidGltZXN0YW1wIjoxNzgwNDczNjAwMDAwMDAwfQ%3D%3D",
  Ky0R9LbsUYxZtUQrNzTT: "https://api.us.elevenlabs.io/v1/voices/Ky0R9LbsUYxZtUQrNzTT/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJjdXN0b20iLCJ1c2VyX2lkIjoiN2VFNGNkbE5jSU5kclUzSkpGSFpKb3F1UFY2MyIsImZpbGVuYW1lIjoiYjkzNTA0ZmMtZTRiMi00MWJkLTljN2QtZGE4YWNmZWU5ZWU0Lm1wMyIsInRpbWVzdGFtcCI6MTc4MDQ3MzYwMDAwMDAwMH0%3D",

  // German round 3 (M young alt — 3 more to compare against Pascal R)
  JDXBO1etYlVlJZRMoYzH: "https://storage.googleapis.com/eleven-public-prod/database/workspace/4f186a9c36e44105845eef8c92cb4857/voices/JDXBO1etYlVlJZRMoYzH/4bCFlOi6bjwzEWYjOc1Y.mp3",
  DWwtG6caf2ejed9VskEg: "https://storage.googleapis.com/eleven-public-prod/database/workspace/09830338be95492e897a18bc75422543/voices/DWwtG6caf2ejed9VskEg/6e203d4e-24b0-40c9-b16c-609bbbbfae34.mp3",
  Jim99kfwxzjlhP4r2Q6J: "https://storage.googleapis.com/eleven-public-prod/database/user/gYEAvBjsLWSbftewdHUuFsgYqzm1/voices/Jim99kfwxzjlhP4r2Q6J/aG2pFg9Ef4ToHPVHuIVX.mp3",

  // German round 4 — M older candidates (4 conversational; dropped a 5th
  // "Gentle Santa Claus" as theatrical).
  PyRxkbWo30pCafyP2T3t: "https://storage.googleapis.com/eleven-public-prod/database/workspace/1a718c1a9a5843568ac9ad0b3151eb30/voices/PyRxkbWo30pCafyP2T3t/9RdkYNx83LqF8v3VHqqC.mp3",
  uAGsNqwYZTQBpvJk6b0J: "https://storage.googleapis.com/eleven-public-prod/database/workspace/3927b7dd5a0d4aeb81372239e1dce3b5/voices/uAGsNqwYZTQBpvJk6b0J/NesW7o28TxaWWFejoi2i.mp3",
  ztKVRvw89zjvli0JDeZR: "https://storage.googleapis.com/eleven-public-prod/database/workspace/9d5daecd4210450281f8157fe899598f/voices/ztKVRvw89zjvli0JDeZR/DrxBqj5DYjPORuc2qr2H.mp3",
  wcqN36SUOZ0EhToc2OIu: "https://storage.googleapis.com/eleven-public-prod/database/workspace/2713c612d38b43508f102281808cb9a6/voices/wcqN36SUOZ0EhToc2OIu/5uJKmSbvCXz0O7tzCSfN.mp3",

  // Previous Spanish candidate round (June 2026)
  oqO5cdAzjE5Ik5xWIZRL: "https://storage.googleapis.com/eleven-public-prod/database/user/KvY1FoWUsvcW7pJIBqtQgoHlSad2/voices/oqO5cdAzjE5Ik5xWIZRL/breqON7QZP0TKZiWbprM.mp3",
  "1hB7zCGWj11SeMuBseeI": "https://storage.googleapis.com/eleven-public-prod/database/workspace/5ce745e745794994ba2cb09963f9df13/voices/1hB7zCGWj11SeMuBseeI/61a7318f-fde0-4344-b428-e0139d39c62e.mp3",
  "80lPKtzJMPh1vjYMUgwe": "https://storage.googleapis.com/eleven-public-prod/database/workspace/f5ece55944454e93adeeae7c95a0bccd/voices/80lPKtzJMPh1vjYMUgwe/OdLhfMeDosUS2KjiTnPS.mp3",
  jI8zlZKtaOjhGPBV6elt: "https://storage.googleapis.com/eleven-public-prod/database/workspace/643d6ff739de47f48bc19e4fe4afd15a/voices/jI8zlZKtaOjhGPBV6elt/b3KecUcpfa1tLzBvIL2u.mp3",
  prblQcKOdF08ozhxP2mk: "https://storage.googleapis.com/eleven-public-prod/database/user/4eEn1XHsbXPotYgXL4dl1Vkc4tp2/voices/prblQcKOdF08ozhxP2mk/205da2a0-2615-4388-afc3-ea1635f07554.mp3",
  dyTONAae6PhdRb3hMKPM: "https://storage.googleapis.com/eleven-public-prod/database/workspace/f78f937dc6ee4a439a63795ce7ff139e/voices/dyTONAae6PhdRb3hMKPM/KYUWCzwNB7uZaXav7rsL.mp3",
  ebdrtet3LErOzR0r2i60: "https://storage.googleapis.com/eleven-public-prod/database/workspace/81f58d58997f4f138c89d54f3e867004/voices/ebdrtet3LErOzR0r2i60/MmPqtEpNqIpuyP4XNOkg.mp3",
  p1Q3ihQuPjyyENa1RGtl: "https://storage.googleapis.com/eleven-public-prod/database/user/aaPjxuXAcUd7Vh0Ph6AQ6SqqhIp1/voices/p1Q3ihQuPjyyENa1RGtl/9uChkxn9F6NdRCMmjIeD.mp3",
  A1TMPwTwXl0r3bwjaTFc: "https://storage.googleapis.com/eleven-public-prod/database/user/XDKQ0dHQAtWYQT2DVQ4macQKcKB3/voices/A1TMPwTwXl0r3bwjaTFc/dfBtrXKCTwurOqOu5BY8.mp3",
  yA5jrK1S9cpCAojBYyMu: "https://storage.googleapis.com/eleven-public-prod/database/user/0Fxn4XyfXfQ0sQ4RXHblZGBnRP23/voices/yA5jrK1S9cpCAojBYyMu/6m8A8BPRqNphBM5Isxsv.mp3",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ voiceId: string }> }
) {
  const { voiceId } = await params;
  const upstream = VOICE_PREVIEWS[voiceId];
  if (!upstream) {
    return new Response("Voice not whitelisted", { status: 404 });
  }

  try {
    const res = await fetch(upstream, { cache: "force-cache" });
    if (!res.ok || !res.body) {
      return new Response(`Upstream ${res.status}`, { status: 502 });
    }
    // Re-stream with audio/mpeg so every browser plays inline (no download).
    return new Response(res.body, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
        "Accept-Ranges": "bytes",
      },
    });
  } catch (err) {
    return new Response(`Proxy error: ${(err as Error).message}`, { status: 502 });
  }
}
