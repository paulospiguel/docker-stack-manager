#!/usr/bin/env python3
import json
import subprocess
import sys


def run(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or 'command failed')
    return result.stdout.strip()


def strip_task_slot(task_name):
    """'vision_redis.1.abc123' -> 'vision_redis'; 'vision_redis.1' -> 'vision_redis'"""
    parts = task_name.split('.')
    if len(parts) >= 3:
        return '.'.join(parts[:-2])
    if len(parts) == 2:
        return parts[0]
    return task_name


def get_service_tasks(service_ids):
    """Returns the most recent task info for each service.

    Result: {service_name -> {taskState, taskDesiredState, taskError}}
    """
    if not service_ids:
        return {}
    try:
        output = run([
            'docker', 'service', 'ps',
            '--no-trunc',
            '--format', '{{.Name}}|{{.DesiredState}}|{{.CurrentState}}|{{.Error}}',
            *service_ids
        ])
    except Exception:
        return {}

    tasks = {}
    for line in output.split('\n'):
        if not line.strip():
            continue
        parts = line.split('|', 3)
        if len(parts) < 4:
            continue
        task_name, desired_state, current_state, error = parts
        svc_name = strip_task_slot(task_name)
        # docker lists the newest task first for each service
        if not svc_name or svc_name in tasks:
            continue
        if error.startswith('"') and error.endswith('"'):
            error = error[1:-1]
        tasks[svc_name] = {
            'taskState': current_state,
            'taskDesiredState': desired_state,
            'taskError': error,
        }
    return tasks


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
            svc_name = strip_task_slot(task_name)
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


def get_update_states(service_ids):
    """Returns {service_id -> {updateState, updateMessage}}."""
    if not service_ids:
        return {}
    try:
        output = run([
            'docker', 'service', 'inspect',
            '--format', '{{.ID}}|{{.UpdateStatus.State}}|{{.UpdateStatus.Message}}',
            *service_ids
        ])
    except Exception:
        return {}

    states = {}
    for line in output.split('\n'):
        if not line.strip():
            continue
        parts = line.split('|', 2)
        if len(parts) < 3:
            continue
        sid, state, message = parts
        states[sid] = {
            'updateState': '' if state == '<no value>' else state,
            'updateMessage': '' if message == '<no value>' else message,
        }
    return states


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
    tasks = get_service_tasks([s['id'] for s in services])
    update_states = get_update_states([s['id'] for s in services])
    for s in services:
        s['uptime'] = uptimes.get(s['name'], '')
        task = tasks.get(s['name'], {})
        s['taskState'] = task.get('taskState', '')
        s['taskDesiredState'] = task.get('taskDesiredState', '')
        s['taskError'] = task.get('taskError', '')
        update = update_states.get(s['id'])
        if update is None:
            update = next(
                (value for key, value in update_states.items() if key.startswith(s['id'])),
                {},
            )
        s['updateState'] = update.get('updateState', '')
        s['updateMessage'] = update.get('updateMessage', '')

    return services


def control(action, names):
    if action not in ('start', 'stop'):
        raise RuntimeError('invalid action')
    if not names:
        return {'changed': 0}

    failures = []
    changed = 0
    for name in names:
        try:
            if action == 'stop':
                run(['docker', 'service', 'scale', '--detach', f'{name}=0'])
            else:
                # Set replicas and force a brand-new task in a single update.
                # This also resumes updates that are paused after a failed task.
                try:
                    run([
                        'docker', 'service', 'update',
                        '--replicas', '1',
                        '--force',
                        '--detach',
                        '--with-registry-auth',
                        name,
                    ])
                except RuntimeError as exc:
                    # --replicas is invalid for global/job services; just force a new task
                    if 'replicated' not in str(exc).lower():
                        raise
                    run([
                        'docker', 'service', 'update',
                        '--force',
                        '--detach',
                        '--with-registry-auth',
                        name,
                    ])
            changed += 1
        except Exception as exc:
            failures.append(f'{name}: {exc}')

    if failures and changed == 0:
        raise RuntimeError('; '.join(failures))

    result = {'changed': changed}
    if failures:
        result['failed'] = failures
        result['warning'] = f'{len(failures)} service(s) failed to {action}: ' + '; '.join(failures)
    return result


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
