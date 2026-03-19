import type { StructureResolver } from "sanity/structure";

export const structure: StructureResolver = (S) =>
  S.list()
    .title("Content")
    .items([
      S.listItem()
        .title("📚 Books → Stories")
        .schemaType("book")
        .child(
          S.documentTypeList("book")
            .title("Books")
            .child((bookId: string) => {
              const publishedBookId = bookId.replace(/^drafts\./, "");
              const draftBookId = `drafts.${publishedBookId}`;
              return (
              S.documentList()
                .title("Stories in this Book")
                .filter('_type == "story" && (references($publishedBookId) || references($draftBookId))')
                .params({ publishedBookId, draftBookId })
                .initialValueTemplates([
                  S.initialValueTemplateItem("story-from-book", {
                    bookId: publishedBookId,
                    sourceBookId: bookId,
                  }),
                ])
              );
            })
        ),

      S.divider(),

      S.listItem()
        .title("📚 All Books")
        .schemaType("book")
        .child(S.documentTypeList("book").title("All Books")),

      S.listItem()
        .title("📘 Published Books")
        .schemaType("book")
        .child(
          S.documentList()
            .title("Published Books")
            .filter('_type == "book" && published == true')
        ),

      S.listItem()
        .title("📝 Published Stories")
        .schemaType("story")
        .child(
          S.documentList()
            .title("Published Stories")
            .filter('_type == "story" && published == true')
        ),

      S.listItem()
        .title("🧭 Published Individual Stories")
        .schemaType("standaloneStory")
        .child(
          S.documentList()
            .title("Published Individual Stories")
            .filter('_type == "standaloneStory" && published == true')
        ),

      S.listItem()
        .title("Polyglot Stories")
        .schemaType("standaloneStory")
        .child(
          S.documentList()
            .title("Polyglot Stories")
            .filter('_type == "standaloneStory" && sourceType == "create"')
        ),

      S.listItem()
        .title("📄 All Stories")
        .schemaType("story")
        .child(S.documentTypeList("story").title("All Stories")),

      S.listItem()
        .title("🧭 All Individual Stories")
        .schemaType("standaloneStory")
        .child(S.documentTypeList("standaloneStory").title("All Individual Stories")),

      S.divider(),

      S.listItem()
        .title("📅 Story Scheduler")
        .child(
          S.document()
            .schemaType("storyScheduler")
            .documentId("storyScheduler")
            .title("Story Scheduler")
        ),
    ]);
