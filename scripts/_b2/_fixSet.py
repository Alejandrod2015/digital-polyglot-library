"""Cambia la frase de un meaning_in_context (y su audioClip) de un set: python3 _fixSet.py slug word 'nueva [[frase]]' [targetWord]"""
import json,sys
slug,word,new=sys.argv[1:4]; f=f"scripts/_sets/{slug}.json"; ex=json.load(open(f))
h=[e for e in ex if e['word']==word and e['type']=='meaning_in_context']; assert len(h)==1,(slug,word,len(h))
e=h[0]; e['sentence']=new; ac=e['payload']['audioClip']; ac['sentence']=new.replace('[[','').replace(']]','')
if len(sys.argv)>4: ac['targetWord']=sys.argv[4]
json.dump(ex,open(f,'w'),ensure_ascii=False,indent=2); print('set',slug,word,'->',new)
