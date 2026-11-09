# Adds an optional "hint" (tools one solution uses, or a technique) to each task in public/course.json.
import json,re
C=json.load(open('public/course.json'));S=json.load(open('dev/sols.json'))
PY=['input','int','float','str','range','len','sum','min','max','sorted','abs','list','set','dict','map','zip','enumerate','any','all','ord','chr','isinstance','type','next']
PYM=['split','strip','join','upper','lower','replace','count','find','append','pop','sort','get','items','values','setdefault','isalnum','isdigit','add']
PYK=[('try','`try` / `except`'),('raise','`raise`'),('class','`class`'),('super','`super()`'),('nonlocal','`nonlocal`'),('yield','`yield`'),('lambda','`lambda`'),('while','`while`'),('for','`for`'),('if','`if`'),('def','`def`')]
JS=['input','Number','String','parseInt','Promise','JSON.parse','JSON.stringify','Math.floor','Math.round','Math.max','Object.keys','Object.entries','Array.isArray','setTimeout','new Map','new Set','new Error']
JSM=['split','join','map','filter','reduce','sort','reverse','slice','includes','toUpperCase','padStart','push','pop','shift','forEach','every','has','get','set','then','match','race','all','localeCompare']
JSK=[('switch','`switch`'),('for','`for`'),('while','`while`'),('class','`class`'),('async','`async`'),('await','`await`'),('try','`try` / `catch`'),('throw','`throw`'),('get ','`get`'),('...','`...` (spread)')]
CPPW=['cin','cout','getline','vector','string','map','set','stack','priority_queue','unordered_set','sort','reverse','make_unique','unique_ptr','move','template','class','struct','virtual','new','delete','fixed','setprecision','long long','operator','abs','gcd','isupper','islower','min','max','&','*']
CW=['scanf','printf','fgets','malloc','realloc','free','qsort','strlen','strcpy','strcspn','memcpy','sizeof','struct','typedef','while','for','if','static','long','double','unsigned','^','>>']
SQLK=['WHERE','ORDER BY','LIMIT','DESC','GROUP BY','HAVING','LEFT JOIN','JOIN','COUNT','SUM','AVG','MAX','MIN','LIKE','IN','IS NULL','IS NOT NULL','COALESCE','WITH','substr','ROUND','DENSE_RANK','OVER','PARTITION BY','INSERT INTO','UPDATE','DELETE FROM','CREATE TABLE','CHECK','NOT NULL']
ALGO={
'maximum':'Walk the numbers once and remember the biggest so far.',
'maximum-subarray':'At each number: extend the current run, or start again from here. Keep the best sum seen.',
'range-sums':'Prefix sums: build them once, then answer each range with one subtraction.',
'best-time-to-buy':'Walk once and remember the lowest price so far.',
'first-repeat':'A set of values seen so far.',
'two-sum':'A set of values seen so far. For each x, what would you need to have seen?',
'subarrays-with-sum-k':'Keep a running prefix sum and a map counting how often each prefix sum appeared.',
'longest-consecutive-run':'A set. Only start counting from a value with no value just below it.',
'pair-in-a-sorted-list':'Two pointers, one at each end.',
'longest-with-no-repeats':'Sliding window, plus the last position of each letter.',
'shortest-with-sum-at-least-s':'Sliding window: grow on the right, shrink on the left while the sum is enough.',
'container-with-most-water':'Two pointers at the ends. Move the shorter side.',
'evaluate-postfix':'A stack of numbers.',
'valid-brackets':'A stack of open brackets.',
'next-greater-element':'A monotonic stack of positions.',
'largest-rectangle-in-a-histogram':'A stack of positions with rising heights. Work out areas when you pop.',
'lookups':'Binary search for each query.',
'first-and-last-position':'Two binary searches: first position, and first position after it.',
'integer-square-root':'Binary search on the answer.',
'ship-in-d-days':'Binary search on the capacity. For one capacity, simulate the days.',
'merge-sorted-lists':'Two positions, one in each list.',
'merge-intervals':'Sort by start, then walk once.',
'count-inversions':'Merge sort. Count while merging.',
'kth-smallest-fast':'Partition around a pivot and keep only the side holding k. Sorting also passes.',
'all-permutations-count-check':'Recursion: pick each remaining letter in turn.',
'subset-sum-count':'Recursion: at each item, take it or leave it.',
'generate-brackets':'Recursion: track open and closed counts.',
'n-queens':'Backtracking row by row. Track used columns and both diagonals.',
'climbing-stairs':'Each answer comes from the previous two.',
'fewest-coins':'`dp[x]` is the fewest coins for amount x.',
'house-robber':'For each house: skip it, or take it plus the best from two back.',
'longest-common-subsequence':'`dp[i][j]` is the answer for the first i and first j letters.',
'knapsack':'`dp[c]` is the best value with capacity c. Walk capacity downwards for each item.',
'edit-distance':'`dp[i][j]` is the cost for the first i and first j letters.',
'connected-components':'Union-find, or DFS from each unvisited node.',
'shortest-path-unweighted':'BFS with a queue and an adjacency list.',
'count-islands':'From each unvisited `#`, flood out with a stack.',
'dijkstra':'A priority queue of (distance, node).',
'course-order':'Count incoming edges. Use a min-heap of nodes at zero.',
'most-meetings':'Sort by end time.',
'jump-game':'Greedy: track the furthest reach of the current jump and of the next.',
'gas-station':'If the running tank goes negative, restart from the next station.',
'minimum-platforms':'Sort arrivals and departures apart, then walk both.'}
def tick(n):return f'`{n}`'
miss=[];n=0
for t in C['tracks']:
 for m in t['modules']:
  for x in m['tasks']:
   if x['kind']=='predict':continue
   tail=x['id'].split('-',1)[1]; sol=S.get(x['id'],'')
   if t['id']=='algo':
     if tail in ALGO:x['hint']=ALGO[tail];n+=1
     else:miss.append(x['id'])
     continue
   code=re.sub(r'(?<![fF])"(?:\\.|[^"\\\n])*"|\'(?:\\.|[^\'\\\n])*\'','""',sol)
   hits=[]
   L=t['id']
   if L=='python':
     for k,lab in PYK:
       if re.search(r'\b'+k+r'\b',code):hits.append((code.find(k),lab))
     for f in PY:
       i=re.search(r'(?<![\w.])'+f+r'\(',code)
       if i:hits.append((i.start(),tick(f+'()')))
     for f in PYM:
       i=re.search(r'\.'+f+r'\(',code)
       if i:hits.append((i.start(),tick('.'+f+'()')))
     if 'for' in code and re.search(r'[\[\{(]\S.* for ',code):hits.append((9999,'a comprehension'))
     if re.search(r'\[[^\]]*:[^\]]*\]',code):hits.append((9999,'slices'))
     hits=[h for h in hits if h[1] not in('`if`','`def`') or len(hits)<3]
   elif L=='js':
     for f in JS:
       i=code.find(f)
       if i>=0:hits.append((i,tick(f+('()' if not f.startswith('new') and f[0].islower() or f in('Number','String','parseInt') or '.' in f else ''))))
     for f in JSM:
       i=re.search(r'\.'+f+r'\(',code)
       if i:hits.append((i.start(),tick('.'+f+'()')))
     for k,lab in JSK:
       i=code.find(k)
       if i>=0 and (k=='...' or re.search(r'\b'+k.strip()+r'\b',code)):hits.append((i,lab))
   elif L in('cpp','c'):
     for k in (CPPW if L=='cpp' else CW):
       i=re.search(r'(?<![\w])'+re.escape(k)+(r'\b' if k[-1].isalnum() else ''),code)
       if i:hits.append((i.start(),tick(k)))
     if L=='cpp':hits=[h for h in hits if h[1] not in('`&`','`*`') or 'pointer' in m['title'].lower()]
   elif L=='sql':
     u=code
     for k in SQLK:
       i=re.search(r'\b'+k+r'\b',u)
       if i:hits.append((i.start(),tick(k)))
     if any(h[1]=='`LEFT JOIN`' for h in hits):hits=[h for h in hits if h[1]!='`JOIN`']
   seen=[];
   for _,l in sorted(hits):
     if l not in seen:seen.append(l)
   seen=seen[:8]
   if seen:
     x['hint']='One way uses: '+', '.join(seen)+'.';n+=1
   else:miss.append(x['id'])
json.dump(C,open('public/course.json','w'),separators=(',',':'),ensure_ascii=False)
print(n,'hints; none for',miss)
