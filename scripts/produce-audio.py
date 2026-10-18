"""One-time authored Wick sound palette and score; never invoked by Vite."""
import pathlib,json,subprocess,wave,struct,math
ROOT=pathlib.Path(__file__).resolve().parents[1];TMP=pathlib.Path('/tmp/wick-audio');TMP.mkdir(exist_ok=True);(ROOT/'assets/audio').mkdir(exist_ok=True)
def call(tool,cfg,*args):subprocess.run([tool,'--config',str(cfg),*map(str,args)],check=True,stdout=subprocess.DEVNULL)
def config(name,duration,music=False):
 p=TMP/(name+'.json');data=dict(sample_rate=22050,channels='stereo',max_duration_ms=duration,seed=71,actions=str(TMP/(name+'-ops.json')),preview=str(TMP/(name+'.png')),wav=str(ROOT/'assets/audio'/(name+'.wav')))
 if music:data.update(mid=str(ROOT/'assets/audio/music.mid'),instrument_bank='cinematic')
 p.write_text(json.dumps(data));return p
sounds={'hit':(180,65,'noise'),'kill':(940,100,'triangle'),'gem':(1200,65,'sine'),'hurt':(110,300,'saw'),'level-up':(440,600,'triangle'),'choose':(780,130,'sine'),'chest':(260,600,'triangle'),'evolve':(330,950,'triangle'),'pickup':(520,180,'sine'),'fallen':(165,1800,'triangle'),'dawn':(440,2200,'sine'),'menu-move':(480,45,'triangle'),'menu-confirm':(640,120,'triangle'),'hum':(110,3000,'sine')}
for name,(freq,dur,w) in sounds.items():
 cfg=config(name,dur+200);call('sfx-synth',cfg,'init');call('sfx-synth',cfg,'add-voice','--name','body','--wave',w,'--freq',freq,'--gain',-38 if name=='hum' else -17,'--dur',dur);call('sfx-synth',cfg,'set-envelope','--voice','body','--env','gate' if name=='hum' else 'swell' if name in ['fallen','dawn'] else 'pluck')
 if name in ['level-up','evolve','dawn','chest']:
  for j,ratio in enumerate([1.25,1.5,2]):
   call('sfx-synth',cfg,'add-voice','--name',f'bell{j}','--wave','sine','--freq',freq*ratio,'--gain',-22,'--start',j*80+70,'--dur',max(100,dur-300));call('sfx-synth',cfg,'set-envelope','--voice',f'bell{j}','--env','pluck')
 if name in ['hurt','fallen']:call('sfx-synth',cfg,'set-pitch','--voice','body','--slide-to',freq/3,'--over',dur)
 call('sfx-synth',cfg,'render')
cfg=config('music',33000,True);call('music',cfg,'init');call('music',cfg,'set-tempo','--bpm',60)
for name,w,g,env in [('night','sine',-27,'swell'),('glass','triangle',-25,'pluck'),('steps','sine',-29,'pluck')]:
 call('music',cfg,'define-track','--name',name,'--instrument',w);call('music',cfg,'set-track-fx','--track',name,'--gain',g,'--env',env,'--reverb',0.2)
for bar,chord in enumerate([[45,52,57],[41,48,53],[48,55,60],[43,50,55]]*2):
 for pitch in chord:call('music',cfg,'add-note','--track','night','--pitch',pitch,'--t',bar*4,'--dur',3.8,'--velocity',65)
 for j in range(4):
  call('music',cfg,'add-note','--track','glass','--pitch',chord[[0,2,1,2][j]]+24,'--t',bar*4+j,'--dur',0.8,'--velocity',45+j*5)
  if j%2==0:call('music',cfg,'add-note','--track','steps','--pitch',chord[0]-12,'--t',bar*4+j,'--dur',1,'--velocity',65)
call('music',cfg,'render')
# An imperceptible edge taper guarantees sample-continuous loops.
for name in ['music','hum']:
 path=ROOT/'assets/audio'/(name+'.wav')
 with wave.open(str(path),'rb') as f:params=f.getparams();raw=f.readframes(f.getnframes())
 if name=='hum':
  # Two seconds from the steady body contain exactly 220 fundamental cycles.
  start=int(params.framerate*.5)*params.nchannels*2;raw=raw[start:start+params.framerate*2*params.nchannels*2]
 data=list(struct.unpack('<'+'h'*(len(raw)//2),raw));frames=len(data)//params.nchannels;fade=0 if name=='hum' else min(int(params.framerate*.025),frames//2)
 for i in range(fade):
  for c in range(params.nchannels):data[i*params.nchannels+c]=round(data[i*params.nchannels+c]*i/fade);ix=(frames-1-i)*params.nchannels+c;data[ix]=round(data[ix]*i/fade)
 with wave.open(str(path),'wb') as f:f.setparams(params);f.writeframes(struct.pack('<'+'h'*len(data),*data))
print('Audio complete')
