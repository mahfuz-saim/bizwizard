#!/usr/bin/env python3
import fcntl
import hashlib
import os
from pathlib import Path, PurePosixPath
import re
import shlex
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.request


ROOT = Path('/srv/bizwizard')


def run(args, cwd=None, env=None):
    subprocess.run(args, cwd=cwd, env=env, check=True)


def validate_archive(archive):
    allowed = {'dist', 'prisma', 'package.json', 'package-lock.json'}
    expanded = 0
    for member in archive.getmembers():
        path = PurePosixPath(member.name)
        if (path.is_absolute() or '..' in path.parts or not path.parts
                or path.parts[0] not in allowed
                or not (member.isfile() or member.isdir())):
            raise ValueError('Unexpected or unsafe archive entry')
        expanded += member.size
        if expanded > 256 * 1024 * 1024:
            raise ValueError('Expanded release exceeds the size limit')


def environment():
    result = dict(os.environ)
    for line in Path('/etc/bizwizard/backend.env').read_text().splitlines():
        if line.strip() and not line.lstrip().startswith('#'):
            key, value = line.split('=', 1)
            parsed = shlex.split(value, comments=False)
            result[key] = parsed[0] if parsed else ''
    result['HOME'] = str(ROOT / 'shared')
    result['PATH'] = '/usr/local/bin:/usr/bin:/bin'
    return result


def healthy():
    try:
        with urllib.request.urlopen('http://127.0.0.1:5000/test', timeout=2) as res:
            return res.status == 200
    except (OSError, TimeoutError):
        return False


def point_current(release):
    link = ROOT / 'current.next'
    if link.is_symlink():
        link.unlink()
    elif link.exists():
        raise RuntimeError('Unexpected current.next path; refusing to overwrite')
    link.symlink_to(release, target_is_directory=True)
    link.replace(ROOT / 'current')


def main():
    command = os.environ.get('SSH_ORIGINAL_COMMAND', '')
    if not command and len(sys.argv) == 4:
        command = ' '.join(sys.argv[1:])
    match = re.fullmatch(r'deploy ([0-9a-f]{40}) ([0-9a-f]{64})', command)
    if not match:
        raise ValueError('Only deploy COMMIT_SHA ARCHIVE_SHA256 is permitted')
    commit, expected_hash = match.groups()
    os.umask(0o027)
    with (ROOT / 'shared' / 'deploy.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        incoming = ROOT / 'incoming' / (commit + '.tar.gz')
        digest = hashlib.sha256()
        size = 0
        with incoming.open('wb') as out:
            while block := sys.stdin.buffer.read(65536):
                size += len(block)
                if size > 64 * 1024 * 1024:
                    raise ValueError('Uploaded release exceeds the size limit')
                digest.update(block)
                out.write(block)
        if digest.hexdigest() != expected_hash:
            raise ValueError('Release checksum mismatch')
        current = ROOT / 'current'
        if current.exists() and not current.is_symlink():
            raise RuntimeError('Current release must be a symbolic link')
        previous = current.resolve() if current.is_symlink() else None
        release = Path(tempfile.mkdtemp(prefix=commit + '-', dir=ROOT / 'releases'))
        with tarfile.open(incoming, 'r:gz') as archive:
            validate_archive(archive)
            archive.extractall(release, filter='data')
        for required in ('dist/server.js', 'package.json', 'package-lock.json', 'prisma/schema.prisma'):
            if not (release / required).is_file():
                raise ValueError('Release is missing a required file')
        for name in ('logs', 'uploads'):
            (release / name).symlink_to(ROOT / 'shared' / name, target_is_directory=True)
        env = environment()
        install_env = dict(os.environ, HOME=str(ROOT / 'shared'), PATH=env['PATH'])
        run(['npm', 'ci', '--include=dev', '--ignore-scripts', '--no-audit', '--no-fund'], release, install_env)
        run(['node_modules/.bin/prisma', 'generate'], release, env)
        run(['sudo', '-n', '/usr/bin/systemctl', 'start', 'bizwizard-backup.service'])
        run(['node_modules/.bin/prisma', 'migrate', 'deploy'], release, env)
        run(['npm', 'prune', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], release, install_env)
        run(['node', '-e', "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.$queryRaw`SELECT 1`.then(()=>p.$disconnect()).catch(async()=>{await p.$disconnect();process.exitCode=1;});"], release, env)
        switched = False
        try:
            point_current(release)
            switched = True
            run(['sudo', '-n', '/usr/bin/systemctl', 'restart', 'bizwizard.service'])
            for _ in range(30):
                if healthy():
                    break
                time.sleep(1)
            else:
                raise RuntimeError('Backend readiness check failed')
        except Exception:
            if switched:
                if previous:
                    point_current(previous)
                    run(['sudo', '-n', '/usr/bin/systemctl', 'restart', 'bizwizard.service'])
                else:
                    run(['sudo', '-n', '/usr/bin/systemctl', 'stop', 'bizwizard.service'])
                    current.unlink()
            raise
        incoming.unlink()
        print('Deployed ' + commit + '; database connection and backend readiness passed.', flush=True)


if __name__ == '__main__':
    main()
