#!/usr/bin/env python3
import json
import subprocess
import sys


def run(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or 'command failed')
    return result.stdout.strip()


def get_service_uptimes(service_ids):
    """Returns dict {service_name -> uptime_string} for running tasks."""
    if not service_ids:
        return {}
    try:
        output = run([
            'docker', 'service', 'ps',
            '--filter', 'desired-state=running',
            '--format', '{{.Name}}|{{.CurrentState}}',
            '--no-trunc',
            *service_ids
        ])
        uptimes = {}
        for line in output.split('\n'):
            if not line.strip():
                continue
            parts = line.split('|', 1)
            if len(parts) != 2:
                continue
            task_name, state = parts
            # task_name like "vision_contractsservice.1" → strip trailing .N
            dot_pos = task_name.rfind('.')
            svc_name = task_name[:dot_pos] if dot_pos > 0 else task_name
            # state like "Running 2 hours ago" → extract "2 hours ago"
            if state.startswith('Running '):
                uptime = state[len('Running '):]
            else:
                uptime = state
            if svc_name and svc_name not in uptimes:
                uptimes[svc_name] = uptime
        return uptimes
    except Exception:
        return {}


def list_services():
    output = run([
        'docker', 'service', 'ls',
        '--format', '{{.ID}}|{{.Name}}|{{.Replicas}}|{{.Image}}'
    ])

    if not output:
        return []

    services = []
    for line in output.split('\n'):
        if not line.strip():
            continue
        parts = line.split('|')
        if len(parts) != 4:
            continue
        sid, name, replicas, image = parts
        running_count = 0
        if '/' in replicas:
            try:
                running_count = int(replicas.split('/')[0])
            except ValueError:
                pass
        services.append({
            'id': sid,
            'name': name,
            'status': replicas,
            'image': image,
            'running': running_count > 0,
            'uptime': '',
        })

    uptimes = get_service_uptimes([s['id'] for s in services])
    for s in services:
        s['uptime'] = uptimes.get(s['name'], '')

    return services


def control(action, names):
    if action not in ('start', 'stop'):
        raise RuntimeError('invalid action')
    if not names:
        return {'changed': 0}
    if action == 'stop':
        scale_args = [f'{n}=0' for n in names]
        run(['docker', 'service', 'scale', *scale_args])
    else:
        # Scale to 1 first, then force-update to re-deploy any stuck tasks
        scale_args = [f'{n}=1' for n in names]
        run(['docker', 'service', 'scale', *scale_args])
        for n in names:
            run(['docker', 'service', 'update', '--force', n])
    return {'changed': len(names)}


def main():
    try:
        if len(sys.argv) < 2:
            raise RuntimeError('usage: docker_control.py [list|start|stop] [names...]')

        command = sys.argv[1]

        if command == 'list':
            print(json.dumps({'ok': True, 'containers': list_services()}))
            return

        if command in ('start', 'stop'):
            names = sys.argv[2:]
            result = control(command, names)
            print(json.dumps({'ok': True, **result}))
            return

        raise RuntimeError('unknown command')
    except Exception as exc:
        print(json.dumps({'ok': False, 'error': str(exc)}))
        sys.exit(1)


if __name__ == '__main__':
    main()
