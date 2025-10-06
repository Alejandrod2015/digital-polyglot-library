import type { StructureResolver } from "sanity/structure";

export const structure: StructureResolver = (S) =>
  S.list()
    .title("Content")
    .items([
      S.listItem()
        .title("📘 Published Books")
        .schemaType("book")
        .child(
          S.documentList()
            .title("Published Books")
            .filter('_type == "book" && published == true')
        ),
      S.listItem()
        .title("📚 All Books")
        .schemaType("book")
        .child(S.documentTypeList("book").title("All Books")),
      S.listItem()
        .title("📝 Published Stories")
        .schemaType("story")
        .child(
          S.documentList()
            .title("Published Stories")
            .filter('_type == "story" && published == true')
        ),
      S.listItem()
        .title("📄 All Stories")
        .schemaType("story")
        .child(S.documentTypeList("story").title("All Stories")),
    ]);
