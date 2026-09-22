"""Local preview and conservative, fiction-only rollback. Python stdlib only."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import signal
import sqlite3
import subprocess
import sys
import tarfile
import time
import urllib.request

REPO = Path(__file__).resolve().parents[1]
CONFIG = json.loads((REPO / 'config/fiction-release.json').read_text())

def git(*args, binary=False, repo=REPO):
    return subprocess.check_output(['git', '-C', str(repo), *args], text=not binary)

def commit(ref):
    return git('rev-parse', '--verify', ref + '^{commit}').strip()

def scoped(path):
    return any(path.startswith(p) for p in CONFIG['scope'])

def manifest(ref):
    files = {}
    for row in git('ls-tree', '-r', '-z', ref, binary=True).split(b'\0'):
        if not row:
            continue
        meta, name = row.split(b'\t', 1)
        mode, kind, oid = meta.decode().split()
        path = name.decode()
        if scoped(path) or path == 'favicon.svg':
            if kind != 'blob' or mode not in ('100644', '100755'):
                raise ValueError('Snapshot does not support symlinks/submodules: ' + path)
            files[path] = oid
    return files

def snapshot(ref, root):
    oid = commit(ref)
    root = Path(root).resolve()
    if root.exists():
        raise ValueError('Snapshot destination already exists; use a new directory')
    files = manifest(oid)
    archive = git('archive', '--format=tar', oid, '--', *files, binary=True)
    root.mkdir(parents=True)
    with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
        for item in tar:
            destination = (root / item.name).resolve()
            if not destination.is_relative_to(root) or not (item.isfile() or item.isdir()):
                raise ValueError('Unexpected archive member')
            if item.isdir():
                destination.mkdir(parents=True, exist_ok=True)
            else:
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(tar.extractfile(item).read())
    (root / '.fiction-source.json').write_text(json.dumps({'commit': oid, 'files': files}, indent=2)+'\n')
    return {'source': str(root), 'commit': oid}

def verify_source(source):
    meta = json.loads((source / '.fiction-source.json').read_text())
    if meta['files'] != manifest(meta['commit']):
        raise ValueError('Snapshot manifest differs from Git')
    for name, oid in meta['files'].items():
        data = (source / name).read_bytes()
        if hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest() != oid:
            raise ValueError('Snapshot modified: '+name)
    return meta

def managed(pid, data):
    # Linux process identity check: refuse to signal an unrelated/reused PID.
    try:
        args = Path(f'/proc/{pid}/cmdline').read_bytes().split(b'\0')
        return str(REPO / 'scripts/fiction-preview.mjs').encode() in args and str(data).encode() in args
    except FileNotFoundError:
        return False

def process_info(data):
    file = data / 'preview.json'
    return json.loads(file.read_text()) if file.exists() else {}

def start(args):
    source, data = Path(args.source).resolve(), Path(args.data).resolve()
    meta = verify_source(source)
    if data.is_relative_to(source) or data.is_relative_to(REPO):
        raise ValueError('Keep data outside source directories')
    data.mkdir(parents=True, exist_ok=True)
    old = process_info(data)
    if old and managed(old['pid'], data):
        raise ValueError('Preview already running for this data directory')
    node = args.node or os.environ.get('FICTION_NODE') or shutil.which('node')
    if not node or int(subprocess.check_output([node, '--version'], text=True).lstrip('v').split('.')[0]) < 22:
        raise ValueError('Node >=22 with node:sqlite is required; use --node')
    db = data / 'state.sqlite'
    if db.exists() and old.get('commit') != meta['commit']:
        backup = data / ('before-version-change-'+str(time.time_ns())+'.sqlite')
        with sqlite3.connect(db) as src, sqlite3.connect(backup) as dest:
            src.backup(dest)
    env = dict(os.environ)
    if args.mode == 'real' and args.vault_cli:
        result = subprocess.run([sys.executable, args.vault_cli, 'get', 'model-library'], env=env, capture_output=True, text=True)
        if result.returncode:
            raise ValueError('Credential lookup failed; no credential output logged')
        credential = json.loads(result.stdout)
        if credential.get('credential_status') != 'ok':
            raise ValueError('Credential is not active')
        def field(name):
            match = re.search(r'^'+re.escape(name)+r'[：:]\s*(\S+)\s*$', credential['content'], re.M | re.I)
            if not match:
                raise ValueError('Missing credential field: '+name)
            return match[1]
        base = field('Base URL').rstrip('/')
        env['UPSTREAM_BASE_URL'] = base if base.endswith('/v1') else base+'/v1'
        env['UPSTREAM_API_KEY'] = field('API Key')
    if args.mode == 'real' and not env.get('UPSTREAM_API_KEY'):
        raise ValueError('Real mode requires a model key; use --vault-cli or inherited environment')
    command = [node, str(REPO/'scripts/fiction-preview.mjs'), '--source', str(source), '--data', str(data), '--port', str(args.port), '--label', args.label, '--mode', args.mode]
    with (data/'server.log').open('ab') as log:
        proc = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=log, stderr=log, env=env, start_new_session=True)
    url = f'http://127.0.0.1:{args.port}'
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    ready = False
    for _ in range(60):
        if proc.poll() is not None:
            break
        try:
            with opener.open(url+'/__preview/health', timeout=1) as res:
                health = json.load(res)
            if health.get('label') == args.label:
                time.sleep(.15)
                ready = proc.poll() is None
                if ready:
                    break
        except OSError:
            pass
        time.sleep(.1)
    if not ready:
        if proc.poll() is None:
            proc.terminate()
            proc.wait(timeout=5)
        raise ValueError('Preview failed to start; inspect server.log')
    info = {'pid': proc.pid, 'commit': meta['commit'], 'source': str(source), 'data': str(data), 'url': url+'/games/fiction/', 'mode': args.mode, 'label': args.label}
    (data/'preview.json').write_text(json.dumps(info, indent=2)+'\n')
    return info

def stop(data):
    data = Path(data).resolve()
    info = process_info(data)
    if info and managed(info['pid'], data):
        os.kill(info['pid'], signal.SIGTERM)
        for _ in range(50):
            if not managed(info['pid'], data):
                return {'stopped': True, 'dataPreserved': True}
            time.sleep(.1)
        raise ValueError('Process still stopping; not sending SIGKILL')
    return {'stopped': False, 'reason': 'No matching managed process'}

def rollback(args):
    head, target = commit('HEAD'), commit(args.target)
    before, after = manifest(head), manifest(target)
    changed = sorted(p for p in set(before)|set(after) if scoped(p) and before.get(p) != after.get(p))
    if not args.apply:
        return {'dryRun': True, 'from': head, 'to': target, 'changed': changed, 'productionDatabaseTouched': False}
    if git('status', '--porcelain', '--untracked-files=all').strip():
        raise ValueError('Worktree must be clean, including untracked files')
    if not changed:
        return {'changed': [], 'message': 'Already at requested fiction version'}
    # The generic compatibility sampler covers single-player saves only.
    # Keep every published multiplayer interpreter: route NEW sessions back
    # instead of deleting code needed by pinned, externally stored histories.
    if any(p.startswith('functions/_lib/multiplayer/') or p == 'functions/api/fiction-rooms.js' for p in changed):
        raise ValueError('Multiplayer rollback is not covered by the single-player compatibility report; keep existing interpreters and switch the new-game host revision instead')
    if not args.compat:
        raise ValueError('--compat report is required')
    report = json.loads(Path(args.compat).read_text())
    if not (report.get('passed') is True and report.get('progressedStates', 0)>0 and report.get('baselineCommit')==target and report.get('candidateCommit')==head):
        raise ValueError('Compatibility report must pass, include progressed saves, and match both commits')
    if report.get('baselineFiles') != after or report.get('candidateFiles') != before:
        raise ValueError('Compatibility report source manifest differs from Git')
    # Conservative: changed persistence code needs a separate migration/backup review.
    # The generic save sampler is NOT a database-schema migration proof.
    sensitive = {'functions/_lib/fiction-service.js', 'functions/_lib/fiction-archives.js', 'functions/_lib/fiction-trace.js'}
    persistence = sorted(sensitive.intersection(changed))
    if persistence:
        review_path = getattr(args, 'persistence_review', None)
        if not review_path:
            raise ValueError('Persistence code changed: manual database/migration review required before rollback')
        review = json.loads(Path(review_path).read_text())
        if not (review.get('baselineCommit') == target and review.get('candidateCommit') == head
                and review.get('files') == persistence and review.get('schemaUnchanged') is True
                and review.get('storedStateUnchanged') is True and review.get('checks') and review.get('reviewer')):
            raise ValueError('Persistence review must match both commits/files and attest unchanged schema and stored state')
    # Added files can be ignored by .gitignore; never overwrite such files either.
    for p in changed:
        if p not in before and (REPO/p).exists():
            raise ValueError('Untracked path collision: '+p)
    subprocess.run(['git', '-C', str(REPO), 'restore', '--source='+target, '--staged', '--worktree', '--', *changed], check=True)
    subprocess.run(['git', '-C', str(REPO), 'commit', '-m', 'Restore complete fiction baseline '+target[:12]], check=True, stdout=subprocess.PIPE)
    return {'commit': commit('HEAD'), 'restored': target, 'changed': changed, 'deployed': False, 'productionDatabaseTouched': False}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    p=sub.add_parser('snapshot');p.add_argument('--ref', default='HEAD');p.add_argument('--out', required=True)
    p=sub.add_parser('tag');p.add_argument('--name', default=CONFIG['baselineTag']);p.add_argument('--ref', default=CONFIG['baselineCommit'])
    p=sub.add_parser('start');p.add_argument('--source', required=True);p.add_argument('--data', required=True);p.add_argument('--port', type=int, default=18882);p.add_argument('--label', default='candidate');p.add_argument('--mode', choices=['real','offline'], default='offline');p.add_argument('--node');p.add_argument('--vault-cli')
    for name in ('stop','status'):
        p=sub.add_parser(name);p.add_argument('--data', required=True)
    p=sub.add_parser('rollback');p.add_argument('--target', default=CONFIG['baselineTag']);p.add_argument('--apply', action='store_true');p.add_argument('--compat');p.add_argument('--persistence-review')
    args=parser.parse_args()
    if args.command=='snapshot':
        result=snapshot(args.ref,args.out)
    elif args.command=='tag':
        oid=commit(args.ref)
        subprocess.run(['git','-C',str(REPO),'tag','-a',args.name,oid,'-m','Verified production baseline; evaluate complete candidates against this version.'],check=True)
        result={'tag':args.name,'commit':oid,'pushed':False}
    elif args.command=='start':
        result=start(args)
    elif args.command=='stop':
        result=stop(args.data)
    elif args.command=='status':
        data=Path(args.data).resolve();result=process_info(data);result['running']=bool(result and managed(result['pid'],data))
    else:
        result=rollback(args)
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=='__main__':
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print('fiction_release: '+str(error),file=sys.stderr)
        sys.exit(1)
