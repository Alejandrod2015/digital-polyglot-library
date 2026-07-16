#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Expand compact practice-set specs into full scripts/_sets/<slug>.json.
Compact spec per story (a python dict):
  M = list of [word, "..[[target]].."(DE, <=14w), answerEN, d1EN, d2EN, d3EN]   meaning_in_context
  F = list of [word(DE answer), "..____.."(DE, <=12w), "..____.."(EN),           fill_blank
               d1DE, d2DE, d3DE, answerEN, t1EN, t2EN, t3EN]
  X = [[w1,a1],[w2,a2],[w3,a3],[w4,a4]]  match_meaning (options = the 4 answers)
Order: first 10 exercises featured, rest featured:false.  clipUrl is left out
(added later by 'genera audio'); audioClip carries sentence/targetWord/voiceId.
Coverage vs DB vocab is checked; refuses to write on gap / structural error.
"""
import json, re, sys, os
VOICE = "JW8DGEuLp9WxIS5IdxMM"  # andreti = ES LATAM narrator (practice voice for Friends)
R2 = None
def strip_br(s): return s.replace("[[","").replace("]]","")
def target_of(s):
    m = re.search(r"\[\[(.+?)\]\]", s); return m.group(1) if m else ""
def wc(s): return len(re.sub(r"\[\[|\]\]","",s).strip().split())

def build_meaning(word, sent, ans, d1, d2, d3, slug):
    tw = target_of(sent)
    return {"type":"meaning_in_context","word":word,"sentence":sent,
      "payload":{"prompt":"Choose the meaning in context.","answer":ans,
        "options":[ans,d1,d2,d3],
        "audioClip":{"storySlug":slug,"storySource":"user","sentence":strip_br(sent),
          "targetWord":tw,"language":"spanish","voiceId":VOICE}}}

def build_fill(word, sent, tr, d1, d2, d3, ta, t1, t2, t3, slug):
    filled = re.sub(r"_{3,}", word, sent)
    return {"type":"fill_blank","word":word,"sentence":sent,
      "payload":{"prompt":"Complete the sentence.","answer":word,
        "options":[word,d1,d2,d3],"translation":tr,
        "optionTranslations":[ta,t1,t2,t3],
        "audioClip":{"storySlug":slug,"storySource":"user","sentence":filled,
          "targetWord":word,"language":"spanish","voiceId":VOICE}}}

def build_match(pairs):
    answers=[a for _,a in pairs]
    return {"type":"match_meaning","word":",".join(w for w,_ in pairs),"sentence":"",
      "payload":{"prompt":"Match the words to their meanings.",
        "pairs":[{"word":w,"answer":a,"options":answers} for w,a in pairs],
        "audioClip":None}}

def build_story(spec, vocab_entries):
    slug=spec["slug"]; exs=[]
    for row in spec.get("M",[]): exs.append(build_meaning(*row, slug))
    for row in spec.get("F",[]): exs.append(build_fill(*row, slug))
    exs.append(build_match(spec["X"]))
    # featured: first 10 featured, rest pool
    for i,e in enumerate(exs):
        if i>=10: e["featured"]=False
    # local structural checks
    issues=[]
    words=[]
    for e in exs:
        if e["type"]=="match_meaning": words+=[p["word"] for p in e["payload"]["pairs"]]
        else: words.append(e["word"])
        if e["type"]=="meaning_in_context" and wc(e["sentence"])>14: issues.append(f"meaning>14w: {e['word']}")
        if e["type"]=="fill_blank" and wc(e["sentence"])>12: issues.append(f"fill>12w: {e['word']}")
        if "—" in json.dumps(e,ensure_ascii=False): issues.append(f"em-dash: {e['word']}")
    # coverage vs DB vocab (word||surface)
    def norm(s):
        import unicodedata
        return "".join(c for c in unicodedata.normalize("NFD",(s or "").lower()) if unicodedata.category(c)!="Mn").strip()
    def covers(target, entry):
        vw, vs = (entry.split("||")+[None])[:2]
        a,b=norm(target),norm(vw)
        if a==b: return True
        if vs and a==norm(vs): return True
        ta,tb=a.split()[0] if a else "", b.split()[0] if b else ""
        L=0
        while L<len(ta) and L<len(tb) and ta[L]==tb[L]: L+=1
        return L>=max(3,min(len(ta),len(tb))-3)
    missing=[e for e in vocab_entries if not any(covers(w,e) for w in words)]
    if missing: issues.append("NOT covered: "+", ".join(m.split('||')[0] for m in missing))
    dup=[w for w in set(words) if [norm(x) for x in words].count(norm(w))>1]
    if len(set(norm(w) for w in words))!=len(words): issues.append(f"reused targets ({len(words)} vs {len(set(norm(w) for w in words))})")
    feat=sum(1 for e in exs if e.get("featured")!=False)
    if feat!=min(10,len(exs)): issues.append(f"featured={feat}")
    return exs, issues

if __name__=="__main__":
    specmod = sys.argv[1]  # python file exposing SPECS list
    vocabf = sys.argv[2] if len(sys.argv) > 2 else "/tmp/expat67/vocab2345.json"
    vocab = json.load(open(vocabf,encoding="utf-8"))
    ns={}; exec(open(specmod,encoding="utf-8").read(), ns)
    SPECS = ns["SPECS"]
    allok=True
    os.makedirs("scripts/_sets",exist_ok=True)
    for spec in SPECS:
        slug=spec["slug"]
        entries=[(f"{v['w']}||{v['s']}" if v.get('s') else v['w']) for v in vocab[slug]]
        exs, issues = build_story(spec, entries)
        if issues:
            allok=False
            print(f"✗ {slug} ({len(exs)} ex): "+" | ".join(issues))
        else:
            json.dump(exs, open(f"scripts/_sets/{slug}.json","w",encoding="utf-8"), ensure_ascii=False, indent=1)
            print(f"✓ {slug} ({len(exs)} ex) written")
    sys.exit(0 if allok else 1)
