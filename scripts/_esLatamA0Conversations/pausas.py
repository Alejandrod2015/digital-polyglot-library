"""Alarga las pausas internas de un mp3 ya narrado (sin gastar creditos).
   uso: pausas.py <in.mp3> <out.mp3> [extra_s] [umbral_s]"""
import subprocess,sys,re,os,tempfile
src,dst=sys.argv[1],sys.argv[2]
extra=float(sys.argv[3]) if len(sys.argv)>3 else 0.22
umbral=float(sys.argv[4]) if len(sys.argv)>4 else 0.20
def sh(a): return subprocess.run(a,capture_output=True,text=True)
log=sh(["ffmpeg","-hide_banner","-nostats","-i",src,"-af","silencedetect=n=-38dB:d=0.08","-f","null","-"]).stderr
dur=float(sh(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",src]).stdout)
pares=re.findall(r"silence_start: (-?[\d.]+)[\s\S]*?silence_end: ([\d.]+) \| silence_duration: ([\d.]+)",log)
cortes=[(float(a),float(b)) for a,b,c in pares if float(c)>=umbral and float(a)>0.05 and float(b)<dur-0.05]
if not cortes:
    sh(["ffmpeg","-loglevel","error","-y","-i",src,"-c","copy",dst]); print("sin pausas que alargar"); raise SystemExit
tmp=tempfile.mkdtemp(); partes=[]; ini=0.0
sil=os.path.join(tmp,"sil.mp3")
sh(["ffmpeg","-loglevel","error","-y","-f","lavfi","-t",str(extra),"-i","anullsrc=r=44100:cl=mono","-b:a","128k",sil])
for n,(a,b) in enumerate(cortes):
    medio=(a+b)/2
    p=os.path.join(tmp,f"p{n}.mp3")
    sh(["ffmpeg","-loglevel","error","-y","-i",src,"-ss",str(ini),"-to",str(medio),"-ar","44100","-b:a","128k",p])
    partes += [p,sil]; ini=medio
p=os.path.join(tmp,"pz.mp3")
sh(["ffmpeg","-loglevel","error","-y","-i",src,"-ss",str(ini),"-ar","44100","-b:a","128k",p]); partes.append(p)
lista=os.path.join(tmp,"l.txt"); open(lista,"w").write("".join(f"file '{x}'\n" for x in partes))
sh(["ffmpeg","-loglevel","error","-y","-f","concat","-safe","0","-i",lista,"-ar","44100","-b:a","128k",dst])
print(f"{len(cortes)} pausas alargadas +{extra}s ·", round(float(sh(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",dst]).stdout),2),"s")
