import sys, numpy as np, cv2
from PIL import Image, ImageFilter
inp, outp = sys.argv[1], sys.argv[2]
im = Image.open(inp).convert("RGB"); arr = np.asarray(im).astype(np.float32)
H,W = arr.shape[:2]
def skinmask(a):
    R,G,B=a[...,0],a[...,1],a[...,2]
    lips=(R>150)&((R-G)>72)&(G<155)
    return ((R>95)&(R>G+8)&(G>B-2)&((R-B)>12)&((R-B)<135)&(R<250)&(G>60)&(~lips))
skin=skinmask(arr)
mask=cv2.morphologyEx((skin*255).astype(np.uint8),cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
n,lab,stats,_=cv2.connectedComponentsWithStats(mask,8)
out=arr.copy()
big=np.zeros((H,W),bool)
for i in range(1,n):
    if stats[i,cv2.CC_STAT_AREA] < (H*W*0.0012): continue
    comp=(lab==i); big|=comp
    y=stats[i,cv2.CC_STAT_TOP]; h=stats[i,cv2.CC_STAT_HEIGHT]
    top=comp.copy(); top[y+max(1,h//4):,:]=False
    px=arr[top] if top.sum()>30 else arr[comp]
    Lp=0.3*px[:,0]+0.59*px[:,1]+0.11*px[:,2]
    ref=np.median(px[Lp>=np.percentile(Lp,55)] if len(px)>40 else px,axis=0)
    L0=max(0.3*ref[0]+0.59*ref[1]+0.11*ref[2],1)
    L=0.3*arr[...,0]+0.59*arr[...,1]+0.11*arr[...,2]
    scale=np.clip(L/L0,0.45,1.55)
    a=0.9
    for c in range(3):
        out[...,c]=np.where(comp,out[...,c]*(1-a)+ref[c]*scale*a,out[...,c])
# BORRAR pecas: median fuerte (radio 6) SOLO en piel
med=np.asarray(Image.fromarray(np.clip(out,0,255).astype(np.uint8)).filter(ImageFilter.MedianFilter(7))).astype(np.float32)
# suavizar bordes de la mascara para no dejar costura
mf=cv2.GaussianBlur(big.astype(np.float32),(0,0),3)[...,None]
out=out*(1-mf)+ (out*0.0+med)*mf
# segunda pasada: donde el pixel de piel es mas oscuro que su version suavizada (peca), usar la suave
Image.fromarray(np.clip(out,0,255).astype(np.uint8)).save(outp)
print("deblush strong ->",outp)
