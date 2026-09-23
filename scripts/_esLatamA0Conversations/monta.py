"""Monta un tema ya sintetizado: normaliza, alarga pausas, mide F0, concatena y ajusta ritmo A0."""
import json,subprocess,sys
S='/private/tmp/claude-501/-Users-alejandrodelcarpio-digital-polyglot-library/7e4f9667-7057-4deb-9d2c-91c1c4b88c2c/scratchpad'
PY_QA='/Users/alejandrodelcarpio/.cache/dpl-qa/venv/bin/python'; PAUSAS=S+'/pausas.py'
tema=sys.argv[1]
def sh(a): return subprocess.run(a,capture_output=True,text=True)
def dur(f): return float(sh(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",f]).stdout)
def norm(src,dst):
    r=sh(["ffmpeg","-hide_banner","-nostats","-i",src,"-af","loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json","-f","null","-"]).stderr
    d=json.loads(r[r.rindex("{"):r.rindex("}")+1])
    af=("loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={input_i}:measured_TP={input_tp}:measured_LRA={input_lra}"
        ":measured_thresh={input_thresh}:offset={target_offset}:linear=true").format(**d)
    sh(["ffmpeg","-loglevel","error","-y","-i",src,"-af",af,"-ar","44100","-b:a","128k",dst])
for n in (1,2,3):
    O=f"t{tema}-historia{n}"; segs=json.load(open(f"{S}/piloto/segments-t{tema}-{n}.json"))
    sh(["ffmpeg","-loglevel","error","-y","-f","lavfi","-t","1.10","-i","anullsrc=r=44100:cl=mono","-b:a","128k",f"{O}/gap-title.mp3"])
    sh(["ffmpeg","-loglevel","error","-y","-f","lavfi","-t","0.45","-i","anullsrc=r=44100:cl=mono","-b:a","128k",f"{O}/gap.mp3"])
    lst=[]; extra=0.0; marcas={}
    for i,(sp,txt) in enumerate(segs):
        norm(f"{O}/s{i:02d}.mp3", f"{O}/n-s{i:02d}.mp3")
        a=dur(f"{O}/n-s{i:02d}.mp3")
        sh(["python3",PAUSAS,f"{O}/n-s{i:02d}.mp3",f"{O}/p-s{i:02d}.mp3","0.22"])
        extra += dur(f"{O}/p-s{i:02d}.mp3")-a
        kind='question' if txt.rstrip().endswith('?') else 'statement-multi'
        r=sh([PY_QA,'../../scripts/_f0gate.py',f"{O}/p-s{i:02d}.mp3",kind])
        try: dd=json.loads(r.stdout)
        except Exception: dd={}
        ends=[e['end'] for e in (dd.get('endings') or []) if e.get('end') is not None]
        if dd.get("ok") is False: marcas[i]=f"pregunta que no sube ({dd.get('end')} st)"
        elif ends and max(ends)>2: marcas[i]=f"afirmación que sube (+{max(ends)} st)"
        lst.append(f"p-s{i:02d}.mp3")
        if i==0: lst.append("gap-title.mp3")
        elif i<len(segs)-1: lst.append("gap.mp3")
    open(f"{O}/lista.txt","w").write("".join(f"file '{x}'\n" for x in lst))
    sh(["ffmpeg","-loglevel","error","-y","-f","concat","-safe","0","-i",f"{O}/lista.txt","-ar","44100","-b:a","128k",f"{O}/bruto.mp3"])
    d0=dur(f"{O}/bruto.mp3"); words=sum(len(t.split()) for _,t in segs); gaps=1.10+0.45*(len(segs)-2)
    rate=words/(d0-gaps-extra)
    sh(["ffmpeg","-loglevel","error","-y","-i",f"{O}/bruto.mp3","-filter:a",f"atempo={2.7/rate:.4f}","-ar","44100","-b:a","128k",f"{O}/t{tema}-historia{n}-final.mp3"])
    json.dump(marcas,open(f"{O}/marcas.json","w"))
    print(f"historia {n}: +{extra:.1f}s pausas · {rate:.2f} w/s · final {dur(f'{O}/t{tema}-historia{n}-final.mp3'):.1f}s · marcados {sorted(marcas) or 'ninguno'}")
