import { PrismaClient } from "@/generated/prisma"
const prisma = new PrismaClient()

async function main() {
  for (const id of ['cmqrtaj1p000032qtda86z6um', 'cmt5vxwgd0007324oesy195k8']) {
    const j = await prisma.journey.findUnique({ where: { id } })
    const stories = await prisma.journeyStory.findMany({
      where: { journeyId: id, NOT: { text: '' } },
      select: { title: true, text: true, topic: true },
      take: 4,
    })
    console.log(`\n=== ${j?.language}/${j?.variant} ${JSON.stringify(j?.levels ?? j?.level)} ===`)
    for (const s of stories) console.log(`\n[${s.topic}] ${s.title}\n${s.text?.slice(0, 260)}`)
  }
}
main().finally(() => prisma.$disconnect())
