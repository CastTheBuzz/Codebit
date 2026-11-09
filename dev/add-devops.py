# Parses course/devops.txt and places the track before Problem solving in public/course.json. Safe to re-run.
import json,re
C=json.load(open('public/course.json'))
slug=lambda s:re.sub(r'^-|-$','',re.sub(r'[^a-z0-9]+','-',s.lower()))
tr=None;mod=None;task=None;f=None;buf=[]
def flush():
    global buf
    txt='\n'.join(buf).rstrip('\n');buf=[]
    if f=='theory':mod['theory']=txt
    elif f=='body':task['body']=txt
    elif f=='hint':task['hint']='One way uses: '+txt
for l in open('course/devops.txt',encoding='utf8').read().split('\n'):
    m=re.match(r'^@(track|module|task|hint)\s*(.*)$',l)
    if not m:buf.append(l);continue
    flush();k,a=m.groups()
    if k=='track':
        i,n,la,b=[x.strip() for x in a.split('|')];tr={'id':i,'name':n,'blurb':b,'modules':[]};f=None
    elif k=='module':mod={'id':slug(a),'title':a,'tasks':[]};tr['modules'].append(mod);f='theory'
    elif k=='task':
        kind,d,t=a.split(' ',2);task={'id':'devops-'+slug(t),'kind':kind,'d':int(d),'title':t,'tests':[]};mod['tasks'].append(task);f='body'
    else:f='hint'
flush()
C['tracks']=[t for t in C['tracks'] if t['id']!='devops']
i=[t['id'] for t in C['tracks']].index('algo');C['tracks'].insert(i,tr)
ids=[x['id'] for t in C['tracks'] for m in t['modules'] for x in m['tasks']];assert len(ids)==len(set(ids))
assert all(x.get('hint') and x.get('body') for m in tr['modules'] for x in m['tasks']) and all(m.get('theory') for m in tr['modules'])
json.dump(C,open('public/course.json','w'),separators=(',',':'),ensure_ascii=False)
print(len(tr['modules']),'stages',sum(len(m['tasks']) for m in tr['modules']),'labs, total',len(ids))
