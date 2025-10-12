// /src/sanity/structure.ts
import type { StructureResolver } from "sanity/structure";

export const structure: StructureResolver = (S) =>
  S.list()
    .title("Content")
    .items([
      // 📚 Libros con sus historias asociadas
      S.listItem()
        .title("📚 Books → Stories")
        .schemaType("book")
        .child(
          S.documentTypeList("book")
            .title("Books")
            // Al entrar en un libro, mostramos solo sus historias
            .child((bookId) =>
              S.documentList()
                .title("Stories in this Book")
                .filter('_type == "story" && references($bookId)')
                .params({ bookId })
                // ✨ Asegura que el botón nativo "Create new document"
                // cree una historia ya vinculada al libro actual
                .initialValueTemplates([
                  S.initialValueTemplateItem("story-from-book", { bookId }),
                ])
            )
        ),

      S.divider(),

      // 📚 Todos los libros (publicados o no)
      S.listItem()
        .title("📚 All Books")
        .schemaType("book")
        .child(S.documentTypeList("book").title("All Books")),

      // 📘 Libros publicados
      S.listItem()
        .title("📘 Published Books")
        .schemaType("book")
        .child(
          S.documentList()
            .title("Published Books")
            .filter('_type == "book" && published == true')
        ),

      // 📝 Historias publicadas
      S.listItem()
        .title("📝 Published Stories")
        .schemaType("story")
        .child(
          S.documentList()
            .title("Published Stories")
            .filter('_type == "story" && published == true')
        ),

      // 📄 Todas las historias
      S.listItem()
        .title("📄 All Stories")
        .schemaType("story")
        .child(S.documentTypeList("story").title("All Stories")),
    ]);
