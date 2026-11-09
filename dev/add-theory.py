# Adds worked examples and look-up guidance to public/course.json. Safe to re-run. Order after a build:
# build-course.mjs, add-hints.py, add-devops.py, add-theory.py
import json
C=json.load(open('public/course.json'))
TASKS="""## How tasks run your code

The app runs your program once for each test and types the input for it. Each read takes the **next line** of that input. Your code must read what it needs and never contain the example values.

If an example's input has two lines, your program has to read two lines.
"""
X={}
X[('python','input-output-variables')]=TASKS+"""
Try this with the input `Ana` and then `Ben`:

```python
name = input()
print(name.upper())
```

It prints `ANA`, then `BEN`. The same code works for both, which is the whole aim. `input()` always gives text, so wrap it in `int()` when you need a number.
"""
X[('js','values-and-variables')]=TASKS+"""
`input()` gives the next line as text. Wrap it in `Number()` when you need a number.
"""
X[('cpp','basics')]=TASKS+"""
`cin >> x` reads the next value, and it does not care whether that value is on the same line or the next one.
"""
X[('c','basics-and-printf')]=TASKS+"""
`scanf("%d", &x)` reads the next value, and it does not care whether that value is on the same line or the next one.
"""
X[('algo','thinking-about-cost')]="""## Reading "n, then n numbers"

Most tasks here send a count on the first line and the numbers on the second:

```
4
1 9 -2 3
```

Python, read both lines:

```python
n = int(input())
nums = list(map(int, input().split()))
```

JavaScript:

```js
const n = Number(input());
const nums = input().split(" ").map(Number);
```

C++, reading one value at a time:

```cpp
int n;
cin >> n;
vector<int> nums(n);
for (int& x : nums) cin >> x;
```

C:

```c
int n;
scanf("%d", &n);
for (int i = 0; i < n; i++) {
    int x;
    scanf("%d", &x);
}
```

For very large inputs in Python, `sys.stdin.read().split()` reads everything at once and is faster.
"""
LOOK="""## Stuck? Look it up

Nobody memorises all of this. Good engineers are quick at finding answers. Use this order:

1. Read the error slowly. It usually names the problem.
2. `command --help` shows the options.
3. `man command` is the full manual. In it, `/word` searches and `q` quits.
4. `tldr command` shows common examples. On Arch, install the `tealdeer` package.
5. Search the [Arch Wiki](https://wiki.archlinux.org/). It is useful on any Linux.
6. Search the exact error message in quotes.

Write what you learn in the lab's notes box. Your notes page under **You** becomes your own cheat sheet.
"""
D={}
D['linux-finding-your-way-around']="""## Checking the system

```bash
uname -r    # kernel version
df -h       # disk space
free -h     # memory
uptime      # time since boot
whoami      # current user
```

`-h` means human-readable sizes, such as 12G rather than a long number.

## Worked example: reading permissions

```
$ touch notes.txt
$ ls -l notes.txt
-rw-r--r-- 1 kristian kristian 0 Nov  4 18:42 notes.txt
```

Split `-rw-r--r--` like this:

- `-`: the type. `-` is a file, `d` is a folder.
- `rw-`: the **owner** can read and write.
- `r--`: the **group** can read.
- `r--`: **everyone else** can read.

**With numbers**, add up each group: read 4, write 2, run 1.

- `7` = 4+2+1 = `rwx`
- `6` = 4+2 = `rw-`
- `5` = 4+1 = `r-x`
- `4` = `r--`
- `0` = `---`

So `chmod 640` means owner 6, group 4, others 0:

```
$ chmod 640 notes.txt
$ ls -l notes.txt
-rw-r----- 1 kristian kristian 0 Nov  4 18:42 notes.txt
```

**With letters**, change one part and leave the rest. `u` is the owner, `g` the group, `o` others, `a` everybody. `+` adds and `-` removes:

```bash
chmod u+x script.sh    # owner may run it
chmod o-r notes.txt    # others may no longer read it
chmod a+r notes.txt    # everybody may read it
```

On a **folder**, `x` means you may enter it, so a folder usually needs `x` as well as `r`.

"""+LOOK
D['text-pipes-and-search']="""## Worked example: build a pipeline one step at a time

Do not write a long pipeline in one go. Add one command, look at the output, then add the next.

Given `app.log`:

```
INFO boot
ERROR disk
INFO ok
ERROR disk
ERROR net
```

```bash
grep ERROR app.log                    # keep the error lines
grep ERROR app.log | sort             # put equal lines together
grep ERROR app.log | sort | uniq -c   # count each one
grep ERROR app.log | sort | uniq -c | sort -rn   # biggest count first
```

The last one prints:

```
      2 ERROR disk
      1 ERROR net
```

`uniq` only merges lines that are **next to each other**, which is why `sort` comes first.

`journalctl -n 2000 --no-pager` prints the last 2,000 log lines, ready for a pipe. Look at a few lines first to see which column holds what you need.

## Look it up

`man grep`, `man sort`, `tldr awk`, `tldr sed`. For `awk` and `sed`, the small examples in `tldr` cover most daily use.
"""
D['processes-and-services']="""## Worked example: a service from start to finish

1. Write the script and make it executable. Use full paths, because services do not run from your folder.
2. Create `/etc/systemd/system/demo.service` with `sudo`, using the unit file above.
3. Tell systemd about the new file, then start it:

```bash
sudo systemctl daemon-reload
sudo systemctl start demo
systemctl status demo
```

Reading `status`: `active (running)` is good. `failed` means look at the log. The lines at the bottom are the last log lines.

4. When it fails, read why:

```bash
journalctl -u demo -n 30 --no-pager
```

Common causes: the script is not executable, a path is wrong, or you forgot `daemon-reload` after an edit.

5. Clean up afterwards:

```bash
sudo systemctl disable --now demo
sudo rm /etc/systemd/system/demo.service
sudo systemctl daemon-reload
```

**Timers** come as a pair with the same name: `demo.service` does the work, and `demo.timer` says when. You enable the timer rather than the service. Test a calendar rule with `systemd-analyze calendar '*:0/5'`.

## Look it up

`man systemd.service`, `man systemd.timer`, and the Arch Wiki pages for systemd and systemd timers.
"""
D['bash-scripting']="""## Worked example: a small script

```bash
#!/usr/bin/env bash
set -euo pipefail
name="${1:-world}"
echo "hello $name"
```

```
$ chmod +x greet.sh
$ ./greet.sh
hello world
$ ./greet.sh Chris
hello Chris
$ echo $?
0
```

Line by line:

- `#!/usr/bin/env bash` says which program runs the file.
- `set -euo pipefail` stops at the first problem rather than carrying on with bad data.
- `${1:-world}` is the first argument, or `world` if there is none.
- `$?` is the exit code of the last command. 0 means it worked.

**Exiting with an error**, the pattern every script needs:

```bash
if [[ ! -d "$1" ]]; then
    echo "no such folder: $1" >&2
    exit 1
fi
```

`>&2` sends the message to the error stream.

**Build it in small steps:** get one line working in the terminal, paste it into the script, run it, then add the next. Run `bash -x script.sh` to see each line as it runs.

## Look it up

`man bash` is huge, so search it with `/`. [ShellCheck](https://www.shellcheck.net/) explains every warning it gives. Use `help test` for what works inside `[[ ]]`.
"""
D['git']="""## Worked example: a merge conflict

Two branches changed the same line, so Git stops:

```
CONFLICT (content): Merge conflict in f
Automatic merge failed; fix conflicts and then commit the result.
```

The file now holds both versions:

```
<<<<<<< HEAD
three
=======
two
>>>>>>> idea
```

The top part is your current branch, and the bottom part is the branch coming in. To fix it:

1. Edit the file so it holds what you really want. Delete the three marker lines.
2. `git add f`
3. `git commit`

`git status` tells you what state you are in and often suggests the next command. If it goes wrong, `git merge --abort` puts you back.

## Look it up

`git help commit` opens the manual for any command. [Pro Git](https://git-scm.com/book/en/v2) is the free full book.
"""
D['networking']="""## Worked example: why is this site not loading?

Test one layer at a time and stop at the first failure:

```bash
dig +short example.com          # 1. Does the name give an IP?
ping -c 3 example.com           # 2. Does the machine answer?
curl -I https://example.com     # 3. Does the web server answer?
```

- Step 1 empty: a DNS problem.
- Step 2 fails: it may be network, or the host may simply block ping, so continue anyway.
- Step 3 gives a status code: the server is up, and the code tells you the rest.

On the server itself, is the program listening?

```bash
ss -tlnp
```

Read the Local Address column. `127.0.0.1:8000` means this machine only. `0.0.0.0:8000` means every network. If the port is missing, the program is not running.

`dig` comes in the `bind` package on Arch. `ss` and `ip` come in `iproute2`. `tailscale ip` shows your Tailscale address.

## Look it up

`man ss`, `man dig`, `tldr ip`, and the [MDN HTTP docs](https://developer.mozilla.org/en-US/docs/Web/HTTP).
"""
D['ssh-and-remote-machines']="""## Worked example: first key login

From the machine you connect **from**:

```bash
ssh-keygen -t ed25519          # press Enter for the default path; a passphrase is wise
ssh-copy-id kristian@100.x.x.x # puts the public key on the other machine
ssh kristian@100.x.x.x
```

`ssh-copy-id` does not exist on Windows. There, print your key with `type $env:USERPROFILE\\.ssh\\id_ed25519.pub`, and add that one line to `~/.ssh/authorized_keys` on the laptop.

SSH refuses keys when permissions are too open. On the server:

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

When login fails, ask for details:

```bash
ssh -v kristian@100.x.x.x
journalctl -u sshd -n 30 --no-pager    # on the server
```

Before you restart `sshd` after editing its config, run `sudo sshd -t`. No output means the config is valid.

## Look it up

`man ssh_config`, `man sshd_config`, and the Arch Wiki pages for OpenSSH and SSH keys.
"""
D['docker']="""## Worked example: reading a run command

```bash
docker run -d --name web -p 8080:80 nginx
```

- `-d`: run in the background.
- `--name web`: a name you choose.
- `-p 8080:80`: **host port : container port**. Your browser uses 8080, and nginx listens on 80.
- `nginx`: the image.

Now open `http://localhost:8080`.

Check on it and clean up:

```bash
docker ps              # running containers
docker logs web        # its output
docker exec -it web sh # a shell inside it
docker rm -f web       # stop and delete
```

**If it will not start:** `docker ps -a` shows stopped containers too, and `docker logs NAME` usually gives the reason.

"permission denied" on the Docker socket means your user cannot reach Docker. Use `sudo`, or add yourself to the `docker` group and log in again.

To see what is using space: `docker system df`. `docker system prune` removes unused data, so read its warning first.

## Look it up

`docker run --help`, the [Docker docs](https://docs.docker.com/), and the page for each image on Docker Hub, which lists its ports and settings.
"""
D['docker-compose']="""## Worked example: a good working loop

1. Add **one** service to `compose.yaml`.
2. `docker compose up -d --build`
3. `docker compose ps`: is it running or healthy?
4. `docker compose logs -f NAME`: read the errors.
5. Only then add the next service.

`docker compose config` prints the final file with your variables filled in, which is handy for finding typos.

YAML cares about spaces. Use two spaces per level and never tabs.

Connecting from the web container to `localhost` reaches the web container itself. To reach the database, use the service name, `db`. That one mistake causes most "connection refused" errors here.

A `.env` file beside `compose.yaml` looks like this. Keep it out of Git and commit a `.env.example` with fake values:

```
DB_PASSWORD=choose-your-own
```

## Look it up

The [Compose file reference](https://docs.docker.com/reference/compose-file/) lists every option.
"""
D['ci-cd']="""## Worked example: reading a failed run

1. Open the **Actions** tab on GitHub and click the red run.
2. Click the failed job, then the failed step. Read from the first red line, because later errors are often caused by the first.
3. Try the same command on your machine.

A workflow only runs if it is on the branch and in exactly `.github/workflows/`. A file in the wrong place gives no error, it just does nothing.

Secrets are added under **Settings, Secrets and variables, Actions**. They are read like this:

```yaml
- run: ./deploy.sh
  env:
    API_TOKEN: ${{ secrets.API_TOKEN }}
```

Test a tiny pipeline first, with one step that only runs `echo hello`, then build on it.

## Look it up

The [GitHub Actions docs](https://docs.github.com/en/actions). Each action's own GitHub page shows how to use it and its latest version.
"""
D['cloud-basics']="""## Worked example: what a Worker project is made of

- `wrangler.jsonc`: the name, the entry file and the database bindings.
- `src/worker.js`: your code. It runs for each request.
- `env`: how your code reaches databases and secrets.

```js
export default {
  async fetch(req, env) {
    return Response.json({ ok: true, hasKey: !!env.API_KEY });
  },
};
```

Daily commands:

```bash
npx wrangler dev       # run on your machine
npx wrangler deploy    # publish
npx wrangler tail      # live logs
npx wrangler secret put API_KEY
```

Your apps sit on your personal Cloudflare account. Make sure you are not on the business one before you change anything: `npx wrangler whoami`.

Use a new test Worker for experiments, so your real apps stay safe.

## Look it up

The [Cloudflare Workers docs](https://developers.cloudflare.com/workers/), and `npx wrangler --help`.
"""
D['infrastructure-as-code']="""## Worked example: reading a plan

`terraform plan` ends with a line like `Plan: 1 to add, 0 to change, 0 to destroy.`

The symbols before each resource mean:

- `+` create
- `~` change in place
- `-` destroy
- `-/+` destroy, then create again

Daily loop: edit the file, `terraform fmt`, `terraform validate`, `terraform plan`, read it, `terraform apply`.

A variable and a loop:

```hcl
variable "names" {
  default = ["a", "b", "c"]
}

resource "local_file" "f" {
  for_each = toset(var.names)
  filename = "${path.module}/${each.key}.txt"
  content  = "hello ${each.key}"
}
```

Add to `.gitignore`: `.terraform/`, `*.tfstate` and `*.tfstate.*`.

## Look it up

The [Terraform docs](https://developer.hashicorp.com/terraform/docs), and the [provider registry](https://registry.terraform.io/), which documents every resource with examples.
"""
D['kubernetes']="""## Worked example: why is my Pod not running?

```bash
kubectl get pods
```

Read the STATUS column:

- `Running`: good.
- `Pending`: waiting for room in the cluster.
- `ImagePullBackOff`: it cannot get the image. Check the name and tag.
- `CrashLoopBackOff`: the program starts and dies. Read its logs.

Then dig in:

```bash
kubectl describe pod NAME        # read Events at the bottom
kubectl logs NAME
kubectl logs NAME --previous     # the run before the crash
kubectl get events --sort-by=.lastTimestamp
```

Reach a Service from your machine with `kubectl port-forward service/web 8080:80`.

If `minikube` uses too much memory, stop it with `minikube stop`. `minikube delete` removes it completely.

## Look it up

`kubectl explain deployment.spec` documents any field. The [Kubernetes docs](https://kubernetes.io/docs/home/) have a good Tasks section.
"""
D['monitoring-and-incidents']="""## Worked example: first metrics

A minimal `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: node
    scrape_interval: 15s
    static_configs:
      - targets: ["node-exporter:9100"]
```

Prometheus visits each target and stores the numbers. Its web page is on port 9090, and **Status, Targets** shows whether each is up. Check that before you touch Grafana.

In Grafana on port 3000, add Prometheus as a data source, with the address `http://prometheus:9090`. Try this query for free memory:

```
node_memory_MemAvailable_bytes
```

A postmortem can be this short:

```
Summary: what broke and for how long
Timeline: times, what you saw, what you did
Cause: why it happened
Fixes: what stops it happening again
```

## Look it up

The [Prometheus docs](https://prometheus.io/docs/) and the [Grafana docs](https://grafana.com/docs/grafana/latest/).
"""
D['final-project-ship-it-for-real']="""## How to approach it

Every part of this has been a lab already, so go back to your notes page first.

Build the smallest version that works end to end, then improve it. One page, one table, one test and an automatic deploy beats a big app that never ships.

Before you make the repo public, search its history for secrets:

```bash
git log -p | grep -iE 'password|token|secret'
```

Anything real that appears must be changed at the source, and not only removed from the code.
"""
n=0
for t in C['tracks']:
    for m in t['modules']:
        e=X.get((t['id'],m['id'])) or (t['id']=='devops' and D.pop(m['id'],None)) or None
        if e and e.strip() not in m['theory']:
            m['theory']=(e.strip()+'\n\n'+m['theory']) if t['id']!='devops' else (m['theory']+'\n\n'+e.strip()); n+=1
assert not D,D.keys()
json.dump(C,open('public/course.json','w'),separators=(',',':'),ensure_ascii=False)
print('updated',n)
