E={
1:[("Sie ist wieder in Bremen.","Sie ist zurück in Bremen."),("Jan trinkt seinen Tee.","Jan trinkt still seinen Tee."),
   ("Der Zettel ist aus der Schulzeit.","Der Zettel ist sehr alt.")],
2:[("denn die Anna auf dem Foto ist so jung","denn Anna auf dem Foto ist so jung"),("Die Treppe ist kalt.","Die Treppe ist kalt und still."),
   ('q("Jetzt sind wir drei")+", sagt Anna."','q("Jetzt sind wir drei. Das ist besser")+", sagt Anna."')],
3:[("sitzt zwischen Jan und Nele.","sitzt neben Jan."),("Felix erklärt schnell.","Felix erklärt sehr schnell."),
   ("Anna steht an der Spüle.","Anna steht müde an der Spüle."),("Der Würfel fällt vom Tisch.","Der Würfel fällt unter den Tisch."),
   ('"Annas Augen werden nass, denn das alte Spiel ist kaputt. Sie wischt die Augen schnell.",','"Annas Augen werden nass, denn das alte Spiel ist kaputt. Sie wischt die Augen schnell. Jan ist auch traurig.",'),
   ("Es ist spät.","Es ist spät und still."),("Alle schauen auf das Brett.","Alle schauen nervös auf das Brett."),
   ("Sie würfelt. Eine Vier!","Sie würfelt. Eine Vier, endlich!"),('"Anna lacht. Felix stellt','"Anna lacht stolz. Felix stellt')],
4:[("Der Schrank ist voll mit Büchern.","Der Schrank ist hoch und voll mit Büchern."),("Johanna rennt in den zweiten Stock.","Johanna rennt sofort in den zweiten Stock."),
   ('q("Grün? Das Buch ist leider nicht mehr hier. Eine Frau aus Hamburg liest es jetzt."),','q("Grün? Das Buch ist leider nicht mehr hier."),\n q("Wo ist es?"),\n q("Jemand aus Hamburg liest es jetzt."),'),
   ('q("Der Titel reicht. Ich besorge das Buch für dich."),','q("Der Titel reicht. Ich besorge das Buch bald."),'),
   ('q("Die Küche ist auch gut."),','q("Die Küche ist auch schön."),'),
   ("Die beiden essen Suppe und sagen lange nichts.","Die beiden essen Suppe und sagen lange nichts. Jan ist froh.")],
5:[('q("Ich spiele Schlagzeug. Felix spielt Klavier. Und du singst."),','q("Ich spiele Schlagzeug. Ein Freund spielt Klavier. Und du singst."),'),
   ("lacht viel.","lacht oft."),('q("Ich singe nicht mehr. Meine Stimme ist alt."),','q("Ich singe nicht mehr gern. Meine Stimme ist alt."),'),
   ('q("Deine Stimme ist nicht alt. Bitte, für Jan."),','q("Deine Stimme ist nicht alt. Bitte, das ist wichtig. Für Jan."),'),
   ("Die tiefen Töne sind gut.","Die tiefen Töne sind nicht schlecht."),
   ("Felix sitzt am Klavier.","Ein Freund sitzt am Klavier."),("Felix spielt noch einmal die Melodie.","Der Freund am Klavier spielt noch einmal die Melodie.")],
6:[("Die Suppe ist verbrannt.","Die Suppe ist verbrannt und hart."),("Sie hält den heißen Deckel in der linken Hand.","Sie hält den heißen Deckel vorsichtig in der linken Hand."),
   ('q("Nach München? Ich weiß nicht. Ich brauche Zeit."),','q("Nach München? Ich weiß nicht. Ich brauche Zeit. Ich antworte später."),'),
   ("Nele, Felix, Johanna und Tim sitzen mit Jan am Tisch.","Die Nachbarn sitzen mit Jan am Tisch."),("Alle sind satt.","Alle sind satt und zufrieden.")],
7:[("Er ist nett, aber streng.","Er ist nett und freundlich, aber streng."),
   ('q("Hallo Anna. Eine Frau aus Hamburg will die Wohnung auch."),','q("Hallo Anna. Eine Frau aus Hamburg will die Wohnung leider auch."),'),
   ("Anna mag den Blick in den Hof.","Anna mag den Blick in den Hof. Das Fenster ist offen."),
   ("Sie schreibt unter Bremen: Jan, Nele, Donnerstag, Tims Lied.","Sie schreibt unter Bremen: Jan, Freunde, Donnerstag, Musik."),
   ('q("Geld, Büro, Arbeit. Jan, Nele, Donnerstag")','q("Geld, Büro, Arbeit. Jan, Freunde, Donnerstag")'),
   (" Sie geht in Jans Küche.",""),('q("Und München?"),','q("Und München? Bist du sicher?"),')],
}
for t,edits in E.items():
    p=f"scripts/_deA0Friends/t{t}-draft.py"; s=open(p).read()
    for a,b in edits:
        if s.count(a)!=1: print("NO/MULTI",t,a[:50],s.count(a)); continue
        s=s.replace(a,b)
    open(p,"w").write(s)
