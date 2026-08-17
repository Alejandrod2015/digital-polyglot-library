import { getTapGlossesForSlug } from "@/lib/tapGlosses";
for(const slug of ["el-que-se-enoja-pierde","camaron-que-se-duerme","todo-es-weon","el-mismo-chabon"]){
  const g=getTapGlossesForSlug(slug);
  console.log(slug, "->", g?Object.keys(g).length+" glosses; weón="+JSON.stringify(g["weón"]??g["albur"]??"?"):"NULL");
}
