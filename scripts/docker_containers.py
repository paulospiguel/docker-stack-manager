#!/usr/bin/env python3
"""
docker_containers.py — manages raw Docker containers (not Swarm services).
Commands: list [--all] | start <id...> | stop <id...> | restart <id...>
"""
import json
import subprocess
import sys


def run(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or 'command failed')
    return result.stdout.strip()


def list_containers(include_all=False):
    fmt = '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.State}}|{{.Ports}}'
    cmd = ['docker', 'ps', '--format', fmt]
    if include_all:
        cmd.append('--all')

    output = run(cmd)
    if not output:
        return []

    containers = []
    for line in output.split('\n'):
        if not line.strip():
            continue
        parts = line.split('|', 5)
        if len(parts) < 5:
            continue
        cid, names, image, status, state = parts[0], parts[1], parts[2], parts[3], parts[4]
        ports = parts[5] if len(parts) > 5 else ''

        running = state.lower() == 'running'
        # Extract uptime from status like "Up 2 hours" or "Exited (0) 3 minutes ago"
        uptime = ''
        if running and status.startswith('Up '):
            uptime = status[3:]
        elif not running and status:
            uptime = status

        containers.append({
            'id': cid,
            'name': names.lstrip('/'),
            'image': image,
            'status': status,
            'state': state,
            'ports': ports,
            'running': running,
            'uptime': uptime,
        })

    return containers


def control(action, ids):
    if action not in ('start', 'stop', 'restart'):
        raise RuntimeError('invalid action')
    if not ids:
        return {'changed': 0}
    run(['docker', action, *ids])
    return {'changed': len(ids)}


def main():
    try:
        if len(sys.argv) < 2:
            raise RuntimeError('usage: docker_containers.py [list|start|stop|restart] [--all] [ids...]')

        command = sys.argv[1]

        if command == 'list':
            include_all = '--all' in sys.argv
            result = list_containers(include_all)
            print(json.dumps({'ok': True, 'containers': result}))
            return

        if command in ('start', 'stop', 'restart'):
            ids = [a for a in sys.argv[2:] if not a.startswith('--')]
            result = control(command, ids)
            print(json.dumps({'ok': True, **result}))
            return

        raise RuntimeError('unknown command')
    except Exception as exc:
        print(json.dumps({'ok': False, 'error': str(exc)}))
        sys.exit(1)


if __name__ == '__main__':
    main()
