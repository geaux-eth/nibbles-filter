# Kit clean-up with no redraw (26 Nov): the cock kit's open beaks (frames 5 and 8) had a scratchy back corner, dark flecks
# over the brown, brown flecks in the black and broken bits of lower beak. Inside a box round the corner each pixel takes
# the colour most of its neighbours have (in the kit picture's own colours), and pieces of beak too small to be a beak
# take the colour round them. The upper beak, its tip and everything above it stay as they are. (An image tool's redraw
# of frame 5 came back with a different mouth, no tongue and a thicker lower beak, so it couldn't be used.)
# Usage: python3 tools/kit_corner_clean.py <kit> <frame> x0 x1 y0 y1 box   (26 Nov: 310 5|8 590 790 600 760 9)
#   writes m<frame>_new.webp and cmp_m<frame>.png in the current folder
import numpy as np, sys
from PIL import Image
from scipy import ndimage
from scipy.cluster.vq import kmeans2
ref,k=sys.argv[1],sys.argv[2]; x0,x1,y0,y1,R=map(int,sys.argv[3:8])
K=np.asarray(Image.open(f'faces/{ref}/m{k}.webp').convert('RGBA')).astype(float)
reg=K[480:800,380:820]; px=reg[...,:3][reg[...,3]>250]; C,_=kmeans2(px[::7],9,minit='++',seed=1)
F=K[...,:3]; cls=((F[:,:,None,:]-C[None,None])**2).sum(3).argmin(2)
win=np.zeros((1000,1000),bool); win[y0:y1,x0:x1]=True
# majority class in an R x R box
best=np.zeros(cls.shape); mode=cls.copy()
for c in range(len(C)):
    cnt=ndimage.uniform_filter((cls==c).astype(float),R)
    better=cnt>best; best[better]=cnt[better]; mode[better]=c
yel=(F[...,0]>200)&(F[...,1]>170)&(F[...,2]<200)&(K[...,3]>200)
yu=yel.copy(); yu[668:]=False; lab,_=ndimage.label(yu); up=lab==lab[600,700]
near=ndimage.binary_dilation(up,iterations=12); up=np.isin(lab,np.unique(lab[near&yu]))&(lab>0)
keep=ndimage.binary_dilation(up,iterations=3)
for x in range(x0,x1):
    ys=np.where(up[:,x])[0]
    if len(ys): keep[:ys.max()+1,x]=True
# tiny yellow islands inside the corner (broken bits of beak): the colour round them
ly,_=ndimage.label(yel&win&~keep); sz=ndimage.sum(np.ones_like(ly),ly,range(1,ly.max()+1)) if ly.max() else []
small=np.isin(ly,[i+1 for i,v in enumerate(sz) if v<120])
if small.any():
    best2=np.zeros(cls.shape); mode2=cls.copy()
    for c in range(len(C)):
        cnt=ndimage.uniform_filter(((cls==c)&~small).astype(float),25)
        b=cnt>best2; best2[b]=cnt[b]; mode2[b]=c
    mode[small]=mode2[small]
ch=win&~keep&(mode!=cls)&(K[...,3]>200)
out=K.copy(); out[ch,:3]=C[mode[ch]]
Image.fromarray(out.astype(np.uint8)).save(f'm{k}_new.webp','WEBP',lossless=True)
b=Image.open(f'faces/{ref}/base.webp').convert('RGBA'); W=Image.new('RGB',(800,400))
for c,src in enumerate([f'faces/{ref}/m{k}.webp',f'm{k}_new.webp']):
    im=b.copy(); im.alpha_composite(Image.open(src).convert('RGBA')); bg=Image.new('RGBA',im.size,(255,255,255,255)); bg.alpha_composite(im)
    W.paste(bg.convert('RGB').crop((600,560,800,760)).resize((400,400)),(c*400,0))
W.save(f'cmp_m{k}.png'); print(k,'changed',int(ch.sum()))
