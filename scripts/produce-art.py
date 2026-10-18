"""One-time original pixel artwork, rasterized by draw and draw-sheet. Not a build step."""
import json, math, random, subprocess, pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
TMP=pathlib.Path('/tmp/wick-art');TMP.mkdir(exist_ok=True)
INK='#101b24'; DARK='#27363d'; MID='#536362'; LIGHT='#aab6a0'; GOLD='#ba8248'; AMBER='#edb95e'; CREAM='#fff1b8'; TEAL='#64bbb0'
class Art:
 def __init__(self,w,h):self.w=w;self.h=h;self.ops=[]
 def rect(self,x,y,w,h,c):
  if w>0 and h>0:self.ops.append(dict(op='fill_rect',x=round(x),y=round(y),width=round(w),height=round(h),color=c))
 def dot(self,x,y,c):self.rect(x,y,1,1,c)
 def circle(self,x,y,r,c):self.ops.append(dict(op='fill_circle',cx=round(x),cy=round(y),r=max(0,round(r)),color=c))
 def line(self,x,y,xx,yy,c):self.ops.append(dict(op='line',x0=round(x),y0=round(y),x1=round(xx),y1=round(yy),color=c))
 def poly(self,points,c):
  for y in range(max(0,math.floor(min(p[1] for p in points))),min(self.h,math.ceil(max(p[1] for p in points))+1)):
   xs=[]
   for i,p in enumerate(points):
    q=points[(i+1)%len(points)]
    if (p[1]<=y<q[1])or(q[1]<=y<p[1]):xs.append(p[0]+(y-p[1])*(q[0]-p[0])/(q[1]-p[1]))
   xs.sort()
   for i in range(0,len(xs)-1,2):self.rect(math.ceil(xs[i]),y,max(1,math.floor(xs[i+1])-math.ceil(xs[i])+1),1,c)
 def ring(self,x,y,r,c):
  for i in range(180):
   a=i*math.tau/180;self.dot(x+math.cos(a)*r,y+math.sin(a)*r,c)
 def save(self,path,sheet=False):
  out=ROOT/'assets'/path;out.parent.mkdir(parents=True,exist_ok=True);log=TMP/'ops.json';log.write_text(json.dumps(self.ops));subprocess.run(['draw-sheet' if sheet else 'draw','render','--actions',str(log),'--out',str(out),'--width',str(self.w),'--height',str(self.h),'--no-layers'],check=True,stdout=subprocess.DEVNULL)
def lamp(f=0):
 a=Art(24,32);bob=[0,0,1,1,0,0][f];leg=[0,1,2,0,-1,-2][f];a.rect(7+leg,26,4,5,INK);a.rect(13-leg,26,4,5,INK);a.rect(7+leg,30,6,2,GOLD);a.rect(13-leg,30,6,2,GOLD)
 a.poly([(8,13+bob),(15,12+bob),(19,27),(5,27)],INK);a.poly([(9,15+bob),(14,14+bob),(17,26),(7,25)],'#6d7770');a.line(10,16,9,24,LIGHT);a.rect(7,24,10,3,DARK);a.rect(10,13+bob,4,4,GOLD);a.rect(8,6+bob,8,8,INK);a.rect(10,8+bob,7,5,'#c29e74');a.rect(13,9+bob,5,2,CREAM);a.dot(16,9+bob,INK);a.rect(6,5+bob,12,3,INK);a.rect(9,2+bob,6,5,DARK);a.rect(9,5+bob,7,1,GOLD);a.line(14,16,20,19,INK);a.line(15,17,20,17,LIGHT);a.rect(19,12+bob,1,15,GOLD);a.rect(16,13+bob,7,9,INK);a.rect(17,14+bob,5,6,GOLD);a.rect(18,15+bob,3,4,AMBER);a.dot(19,16+bob,CREAM);a.rect(17,21+bob,5,1,GOLD);return a
lamp().save('sprites/lamplighter/idle.png')
for f in range(6):lamp(f).save(f'sprites/lamplighter/walk/{f}.png',True)
sizes={'moth':20,'bat':20,'rat':24,'gnat':16,'beetle':28,'wisp':20,'spider':28,'crow':24,'shade':32,'hound':36,'mothwing':56,'owl':72,'dark':80}
for name,n in sizes.items():
 for f in range(4):
  a=Art(n,n);cx=n/2;cy=n/2;b=[0,1,2,-1][f];s=n/24
  def P(pts,c):a.poly([(cx+x*s,cy+(y+b)*s)for x,y in pts],c)
  def R(x,y,w,h,c):a.rect(cx+x*s,cy+(y+b)*s,w*s,h*s,c)
  def O(x,y,r,c):a.circle(cx+x*s,cy+(y+b)*s,r*s,c)
  if name in ['moth','mothwing','bat','gnat','crow']:
   wing=3+f%3*2
   for side in [-1,1]:
    pts=[(side*1,-4),(side*10,-wing-3),(side*11,2),(side*7,wing),(side*3,4)]
    P(pts,INK);P([(x*.85,y*.8)for x,y in pts], '#9c9c80' if name in ['moth','mothwing'] else '#596879');P([(side*2,0),(side*8,-wing),(side*7,3)],GOLD if name=='mothwing' else MID)
   O(0,0,3,INK);R(-1,-5,2,11,GOLD if name!='crow' else '#25333c');O(-1,-3,1,CREAM);O(1,-3,1,CREAM)
   if name=='mothwing':
    for side in [-1,1]:O(side*7,0,2,INK);O(side*7,0,1,AMBER)
   if name=='bat':
    P([(-3,-3),(-4,-10),(-1,-6),(2,-6),(4,-10),(3,-2)],INK)
    for side in [-1,1]:
     P([(side*3,2),(side*5,7),(side*7,1),(side*9,5),(side*10,-1)],INK)
   if name=='crow':
    P([(2,-5),(7,-4),(11,-1),(6,0),(3,5),(-2,10),(-6,11),(-4,4)],INK);P([(7,-4),(12,-1),(7,0)],GOLD);R(4,-3,1,1,AMBER)
   if name=='gnat':
    R(-1,-7,2,14,INK);a.line(cx,cy-5*s,cx-4*s,cy-9*s,LIGHT);a.line(cx,cy-5*s,cx+4*s,cy-9*s,LIGHT);R(-1,4,2,5,GOLD)
  elif name in ['rat','hound']:
   P([(-11,3),(-9,-4),(-5,-6),(1,-4),(6,-7),(10,-3),(11,2),(6,4),(2,5),(-5,5)],INK);P([(-9,1),(-7,-3),(-1,-3),(4,-1),(7,-5),(9,-2),(7,3),(-5,3)],'#777066' if name=='rat' else '#3d5155');P([(4,-5),(5,-10),(8,-6)],MID);R(-7+b,4,3,6,DARK);R(4-b,4,3,6,DARK);O(8,-2,1,AMBER);a.line(cx-9*s,cy+2*s,cx-12*s,cy+(7+b)*s,GOLD);R(8,1,3,1,LIGHT)
  elif name in ['beetle','spider']:
   for side in [-1,1]:
    for j in range(3 if name=='beetle' else 4):
     y=-6+j*4;a.line(cx+side*3*s,cy+y*s,cx+side*11*s,cy+(y+b*(j%2*2-1))*s,MID);a.line(cx+side*11*s,cy+(y+b*(j%2*2-1))*s,cx+side*12*s,cy+(y+4)*s,INK)
   O(0,1,7,INK);O(0,0,5,'#6d6d4e' if name=='beetle' else '#4b4d60');O(0,-6,4,INK);a.line(cx,cy-4*s,cx,cy+6*s,GOLD);O(-2,-6,1,AMBER);O(2,-6,1,AMBER);R(-3,-2,1,5,LIGHT)
  elif name in ['shade','dark','wisp']:
   P([(-9,10),(-8,-2),(-4,-10),(2,-11),(7,-5),(8,5),(11,11),(4,8),(1,11),(-3,7)],INK);P([(-6,8),(-5,-3),(-2,-8),(3,-6),(5,4),(7,9),(1,6),(-2,9)],'#28434c' if name=='wisp' else '#313743');P([(-4,-3),(0,-6),(4,-3),(3,1),(-3,1)],'#090e1b');R(-3,-3,2,1,TEAL if name=='wisp' else AMBER);R(2,-3,2,1,TEAL if name=='wisp' else AMBER)
   if name=='dark':
    for side in [-1,1]:P([(side*4,-6),(side*8,-12),(side*6,-2)],'#817865');a.line(cx+side*7*s,cy+2*s,cx+side*11*s,cy+9*s,GOLD)
   for j in range(4):a.dot((3+f*3+j*6)%n,(j*7+f)%n,TEAL if name=='wisp' else MID)
  elif name=='owl':
   P([(-10,-8),(-6,-5),(-2,-8),(3,-7),(8,-10),(10,4),(6,10),(-5,10),(-10,3)],INK);P([(-8,-6),(-3,-4),(0,-6),(7,-7),(8,3),(5,8),(-4,8),(-8,2)],'#777d76');O(-4,-2,3,'#c5b68c');O(4,-2,3,'#c5b68c');O(-4,-2,2,INK);O(4,-2,2,INK);O(-4,-2,1,AMBER);O(4,-2,1,AMBER);P([(-1,0),(2,0),(0,4)],GOLD)
   for j in range(3):R(-4+j*3,5+(j%2),1,2,DARK)
  a.save(f'sprites/enemies/{name}/{f}.png',True)
for f in range(4):
 a=Art(24,24)
 for i in range(9):
  angle=i*math.tau/9;d=3+f*2;a.circle(12+math.cos(angle)*d,12+math.sin(angle)*d,max(1,3-f),['#a7b7a088','#75998b99','#52766a88','#3e585555'][f])
 a.save(f'sprites/puff/{f}.png',True)
for i,(tier,n) in enumerate([('small',8),('medium',12),('large',16)]):
 a=Art(n,n);a.poly([(n/2,0),(n-1,n/3),(n-2,n*.7),(n/2,n-1),(0,n*.6),(1,n*.25)],INK);a.poly([(n/2,1),(n-2,n*.35),(n/2,n-2),(1,n*.4)],TEAL);a.poly([(n/2,1),(n/2,n-3),(2,n*.4)],'#b6e6c1');a.dot(n/2,2,CREAM)
 if i==2:a.line(2,n/2,n-3,n/2,CREAM)
 a.save(f'sprites/gems/{tier}.png')
# Seamless, restrained hand-set cobbles with weathered joints and moss.
a=Art(64,64);a.rect(0,0,64,64,'#18272c');random.seed(18)
for y in range(-16,64,16):
 for x in range(-24,88,24):
  xx=x+(12 if y%32==0 else 0);a.rect(xx+1,y+1,22,14,random.choice(['#213137','#233338','#25353a']));a.line(xx+2,y+1,xx+21,y+1,'#2b3c3e');a.line(xx+1,y+2,xx+1,y+12,'#293c3c');a.line(xx+2,y+14,xx+21,y+14,'#14242a')
for i in range(80):
 x=random.randrange(64);y=random.randrange(64);a.dot(x,y,random.choice(['#2c403f','#1a2c30','#304341']))
a.save('sprites/ground.png')
# Tool effects: translucent engraved arcs, oil pools, crystal and fire.
effects={'taper':(120,40,1),'ember':(16,16,1),'pin':(12,12,1),'lantern':(28,28,1),'halo':(160,160,1),'oil-splash':(100,100,1),'spark':(80,80,4),'shard':(16,16,1),'sconce':(24,24,4),'flare':(128,128,6),'pyre':(120,40,1),'beacon':(16,16,1),'hail':(12,12,1),'chandelier':(28,28,1),'corona':(160,160,1),'blaze':(100,100,1)}
for name,(w,h,frames) in effects.items():
 evolved=name in ['pyre','beacon','hail','chandelier','corona','blaze'];color=TEAL if evolved else AMBER;hi='#d4fff0' if evolved else CREAM
 for f in range(frames):
  a=Art(w,h);cx=w/2;cy=h/2
  if name in ['taper','pyre']:
   a.poly([(0,h*.7),(w*.7,0),(w-1,h*.2),(w*.8,h*.7),(w*.1,h-1)],color+'55');a.poly([(0,h*.7),(w*.78,3),(w-1,h*.22),(w*.73,8)],hi);a.line(18,31,95,13,color)
  elif name in ['halo','corona','flare']:
   radius=w/2-3 if frames==1 else 12+f*9
   for rr in [radius,radius-2,radius-6]:a.ring(cx,cy,rr,color+('88' if rr==radius else '44'))
   for i in range(24):
    t=i*math.tau/24;a.circle(cx+math.cos(t)*radius,cy+math.sin(t)*radius,1,hi)
  elif name in ['oil-splash','blaze']:
   a.circle(cx,cy,42,'#080f1dbb');a.ring(cx,cy,42,color+'99');a.ring(cx,cy,34,color+'44')
   for i in range(22):
    t=i*2.4;r=10+(i*11%30);x=cx+math.cos(t)*r;y=cy+math.sin(t)*r;a.line(x,y,x+2,y-6,color+'99');a.dot(x+1,y-7,hi)
  elif name=='spark':
   a.ring(cx,cy,15+f*6,color+'88');a.poly([(45+f,0),(27,34),(41,34),(30-f,65),(55,26),(40,26)],hi);a.line(10,54,30,42,color);a.line(60,57,53,44,color)
  elif name in ['lantern','chandelier']:
   a.circle(cx,cy,12,color+'22');a.rect(cx-6,cy-7,12,15,INK);a.rect(cx-4,cy-5,8,10,color);a.rect(cx-2,cy-4,4,7,hi);a.rect(cx-6,cy-7,12,2,GOLD);a.rect(cx-6,cy+6,12,2,GOLD);a.ring(cx,cy-8,3,GOLD);a.line(cx,cy-5,cx,cy+5,INK)
   if evolved:a.rect(2,11,3,9,color);a.rect(23,11,3,9,color)
  elif name=='sconce':
   for side in [-1,1]:
    t=f*math.pi/4;x=cx+side*math.cos(t)*7;y=cy+side*math.sin(t)*7;a.circle(x,y,4,INK);a.circle(x,y,3,GOLD);a.circle(x,y-1,1,hi)
   a.line(4,12,20,12,GOLD);a.circle(cx,cy,3,color)
  elif name in ['pin','hail','shard']:
   a.poly([(0,cy),(cx,cy-3),(w-1,cy),(cx,cy+3)],INK);a.poly([(1,cy),(cx,cy-2),(w-1,cy),(cx,cy+2)],color);a.line(3,cy,w-2,cy,hi)
  else:
   a.circle(cx,cy,w*.4,color+'44');a.poly([(cx,h-1),(2,cy),(cx,0),(w-2,cy)],color);a.circle(cx,cy,3,hi)
  a.save(f'sprites/effects/{name}.png' if frames==1 else f'sprites/effects/{name}/{f}.png',frames>1)
# Every icon is an object in a tiny cabinet: bespoke silhouettes and highlights.
weapons=list(effects);passives=['wick','oil','glass','brass','mirror','bellows','tallow','tinder','soot','lure'];names=weapons+passives+['lamp-oil']
for i,name in enumerate(names):
 a=Art(24,24);c=TEAL if name in ['pyre','beacon','hail','chandelier','corona','blaze'] else AMBER
 base={'pyre':'taper','beacon':'ember','hail':'pin','chandelier':'lantern','corona':'halo','blaze':'oil-splash'}.get(name,name)
 if base=='wick':
  a.poly([(6,19),(8,9),(11,4),(15,3),(17,7),(13,12),(12,20)],INK);a.line(8,18,11,9,GOLD);a.line(11,9,15,5,CREAM);a.rect(5,20,11,2,GOLD);a.poly([(16,1),(19,5),(17,8),(15,5)],AMBER)
 elif base=='tallow':
  for x,y in [(4,9),(10,4),(16,11)]:
   a.rect(x,y,4,12,INK);a.rect(x+1,y+1,2,10,CREAM);a.dot(x+2,y-2,AMBER)
  a.rect(3,21,19,2,GOLD)
 elif base=='soot':
  a.poly([(3,18),(7,11),(12,13),(17,7),(22,20),(18,22),(6,22)],INK);a.poly([(6,18),(8,14),(12,16),(17,11),(19,19)],MID);a.dot(7,7,MID);a.dot(14,4,LIGHT);a.dot(19,3,MID);a.dot(5,3,DARK)
 elif base=='tinder':
  a.rect(4,9,16,12,INK);a.rect(5,10,14,10,'#88583c');a.rect(6,11,12,2,GOLD);a.poly([(9,18),(12,10),(17,16),(14,20)],AMBER);a.line(7,7,16,3,LIGHT);a.dot(16,3,AMBER)
 elif base=='lure':
  a.line(3,4,16,4,GOLD);a.line(16,4,19,7,GOLD);a.line(19,7,19,16,GOLD);a.poly([(19,16),(17,21),(12,22),(9,19),(9,16),(11,16),(12,19),(15,19),(17,16)],LIGHT);a.poly([(9,8),(13,12),(9,16),(5,12)],TEAL)
 elif base=='brass':
  a.poly([(4,4),(12,2),(21,4),(19,16),(12,23),(5,16)],INK);a.poly([(6,6),(12,4),(19,6),(17,15),(12,20),(7,15)],GOLD);a.poly([(12,6),(16,7),(15,14),(12,17)],AMBER);a.line(8,8,8,13,CREAM)
 elif base=='mirror':
  a.rect(10,16,4,7,GOLD);a.circle(12,9,8,INK);a.circle(12,9,7,GOLD);a.circle(12,9,5,TEAL);a.line(9,10,14,5,CREAM);a.line(11,13,16,8,LIGHT)
 elif base=='lamp-oil':
  a.poly([(6,9),(16,9),(17,13),(22,10),(21,14),(17,17),(16,21),(5,21),(3,15)],INK);a.poly([(6,11),(14,11),(15,16),(13,19),(6,19),(5,15)],GOLD);a.rect(8,6,4,3,AMBER);a.poly([(10,1),(13,5),(10,7),(8,5)],CREAM);a.line(17,14,21,12,GOLD)
 elif base=='oil-splash':
  a.poly([(2,15),(7,12),(11,14),(16,11),(22,15),(20,20),(14,22),(6,21),(1,18)],INK);a.line(4,17,19,17,c);a.poly([(8,2),(12,9),(8,12),(5,9)],c);a.dot(8,8,CREAM);a.poly([(18,3),(21,8),(17,9)],GOLD)
 elif base=='shard':
  a.poly([(2,20),(9,9),(21,2),(17,15)],INK);a.poly([(4,18),(10,10),(19,4),(15,14)],TEAL);a.line(6,17,17,6,CREAM);a.line(3,6,6,9,GOLD);a.dot(19,19,GOLD)
 elif base=='sconce':
  a.poly([(2,7),(6,8),(10,15),(15,15),(19,8),(23,7),(19,18),(12,22),(5,18)],INK);a.poly([(4,10),(8,15),(12,18),(17,15),(21,10),(17,19),(8,19)],GOLD)
  for x in [4,20]:a.poly([(x,1),(x+3,6),(x,10),(x-2,6)],c);a.dot(x,6,CREAM)
 elif base in ['taper']:


  a.rect(8,9,7,12,INK);a.rect(9,9,5,10,'#e6d7a6');a.rect(9,10,2,8,CREAM);a.poly([(12,1),(16,7),(12,10),(9,7)],c);a.dot(12,5,CREAM)
 elif base in ['oil','lamp-oil','oil-splash','soot','tinder']:
  a.rect(9,3,6,4,GOLD);a.poly([(9,6),(15,6),(19,11),(18,21),(6,21),(5,11)],INK);a.poly([(10,7),(14,7),(17,12),(16,19),(8,19),(7,12)],'#647c76');a.rect(9,12,7,6,c);a.line(8,10,8,16,CREAM)
 elif base in ['glass','mirror','shard']:
  a.poly([(12,2),(20,10),(15,20),(8,22),(3,12)],GOLD);a.poly([(12,4),(18,10),(14,18),(8,20),(5,12)],TEAL);a.line(8,15,14,7,CREAM);a.line(10,17,15,12,LIGHT)
 elif base in ['halo','flare','brass','lure']:
  a.ring(12,12,9,GOLD);a.ring(12,12,7,c);a.ring(12,12,6,c);a.poly([(12,6),(15,12),(12,17),(9,12)],CREAM if base=='flare' else DARK);a.dot(5,5,CREAM)
 elif base in ['lantern','sconce']:
  a.ring(12,5,3,GOLD);a.rect(5,7,14,14,INK);a.rect(7,9,10,9,c);a.rect(10,10,4,7,CREAM);a.rect(5,6,14,3,GOLD);a.rect(5,20,14,2,GOLD);a.line(12,9,12,18,INK)
 elif base=='bellows':
  a.poly([(3,7),(10,3),(19,14),(12,21)],GOLD)
  for j in range(4):a.line(4+j*2,8+j*2,10+j*2,4+j*2,INK)
  a.line(17,15,22,20,LIGHT)
 elif base=='spark':
  a.poly([(14,1),(5,13),(11,13),(8,23),(20,8),(13,8)],c);a.line(11,11,15,5,CREAM)
 elif base=='ember':
  a.poly([(12,1),(14,8),(18,6),(20,15),(15,22),(7,21),(3,15),(8,8),(8,13)],c);a.poly([(12,9),(16,16),(13,20),(9,18)],CREAM)
 elif base=='pin':
  for j in range(3):a.line(3,6+j*5,20,6+j*5,c);a.poly([(17,3+j*5),(22,6+j*5),(17,9+j*5)],CREAM)
 if name in ['pyre','beacon','hail','chandelier','corona','blaze']:a.dot(2,2,CREAM);a.line(1,3,3,1,TEAL);a.dot(21,21,TEAL)
 a.save(f'icons/{name}.png')
for name in ['chest','bread','draft']:
 a=Art(24,24)
 if name=='chest':
  a.rect(3,7,18,14,INK);a.rect(4,8,16,12,'#6e4935');a.rect(5,9,14,3,GOLD);a.rect(5,14,14,5,'#94643e');a.rect(7,8,2,12,AMBER);a.rect(16,8,2,12,AMBER);a.rect(10,12,4,5,INK);a.rect(11,13,2,3,CREAM)
 elif name=='bread':
  a.poly([(2,13),(6,7),(17,5),(22,10),(21,16),(7,20),(2,17)],INK);a.poly([(3,13),(7,8),(17,6),(21,10),(20,15),(7,18),(3,16)],GOLD);a.line(7,11,10,14,CREAM);a.line(12,9,15,12,CREAM);a.line(16,8,19,10,AMBER)
 else:
  a.rect(9,3,6,3,GOLD);a.poly([(10,6),(14,6),(14,10),(20,18),(18,22),(6,22),(4,18),(10,10)],INK);a.poly([(11,7),(13,7),(13,11),(18,18),(17,20),(7,20),(6,18),(11,11)],TEAL);a.line(8,17,11,12,CREAM);a.dot(16,4,TEAL)
 a.save(f'sprites/pickups/{name}.png')
print('Artwork complete')
# Original title illustration, the last lit corner of the city.
a=Art(640,720);a.rect(0,0,640,720,'#101d25');a.circle(386,210,137,'#1a2c32');a.circle(386,210,99,'#21363a');a.circle(386,210,64,'#2b4140')
random.seed(82)
for i in range(80):a.dot(random.randrange(640),random.randrange(420),random.choice(['#364949','#4d5d53','#25383e']))
for x,y,w,h in [(-20,240,150,300),(110,305,120,200),(460,180,210,390),(300,370,150,180)]:
 a.rect(x,y,w,h,'#0a151e');a.poly([(x-12,y),(x+w/2,y-65),(x+w+10,y)],'#0b1720');a.line(x+w-2,y,x+w-2,y+h,'#293b3e')
 for wx in range(x+18,x+w-10,32):
  for wy in range(y+25,y+h-20,51):
   a.rect(wx,wy,12,22,'#192b31');a.rect(wx+2,wy+3,8,17,'#25373a');a.rect(wx+6,wy+3,1,17,'#13212a')
a.poly([(0,600),(295,470),(640,580),(640,720),(0,720)],'#1d3034')
for i in range(10):a.line(0,520+i*i*2,640,540+i*i*2,'#2b3e3d')
for i in range(-7,8):a.line(310+i*19,493,310+i*100,720,'#13252d')
# Wrought iron standard and stained amber lantern.
a.rect(369,254,12,305,INK);a.rect(372,256,3,300,'#637064');a.rect(361,550,28,9,INK);a.rect(355,559,40,9,'#17252b');a.rect(363,279,24,6,GOLD);a.rect(363,396,24,5,'#5a6559');a.poly([(335,184),(413,184),(405,260),(345,260)],INK);a.poly([(343,190),(405,190),(399,251),(351,251)],'#d59d54');a.poly([(351,195),(395,195),(391,246),(356,246)],'#f3ce7d');a.poly([(365,195),(383,195),(381,246),(368,246)],CREAM);a.rect(372,191,5,62,'#927348');a.line(340,216,404,216,'#977043');a.poly([(327,182),(375,156),(422,182)],INK);a.line(330,181,417,181,GOLD);a.rect(367,146,16,10,INK);a.circle(375,141,5,GOLD);a.rect(341,257,68,7,INK);a.rect(348,265,54,5,'#536358')
# A traveler beneath it.
a.poly([(283,494),(308,490),(330,569),(268,569)],INK);a.poly([(289,505),(303,502),(316,558),(279,560)],'#64766c');a.rect(283,568,12,39,INK);a.rect(306,568,13,39,INK);a.rect(277,602,22,7,'#536055');a.rect(304,602,24,7,'#536055');a.rect(286,470,27,27,INK);a.rect(295,477,24,13,'#c19e73');a.rect(277,468,44,6,INK);a.rect(287,454,25,15,'#273d42');a.rect(288,464,25,3,GOLD);a.line(306,509,341,521,'#89937c');a.rect(337,510,13,19,INK);a.rect(340,513,7,12,AMBER);a.dot(343,517,CREAM)
for x,y in [(310,221),(446,250),(411,322),(339,341),(285,181),(468,158)]:
 a.poly([(x,y),(x-11,y-7),(x-9,y+5),(x,y+2),(x+11,y-7),(x+9,y+5)],'#a39e7a');a.line(x,y-2,x,y+5,INK)
a.save('sprites/title-scene.png')
