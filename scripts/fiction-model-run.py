"""Run a local evaluation/preview with vault credentials in child env only.

Usage: python fiction-model-run.py --vault-cli <credential_vault.py> -- <node> <script> [args]
The vault CLI is the only interface to credentials. No secrets are written to
files, command arguments, or diagnostic output. Works with the caller's Python.
"""
import argparse
import json
import os
import re
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--vault-cli', required=True)
    parser.add_argument('command', nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ['--'] else args.command
    if not command:
        parser.error('Provide the child command after --')
    env = dict(os.environ)
    for name, key_var, base_var, default_base in [
        ('model-library', 'UPSTREAM_API_KEY', 'UPSTREAM_BASE_URL', None),
        ('deepseek-harness', 'DEEPSEEK_API_KEY', 'DEEPSEEK_BASE_URL', 'https://api.deepseek.com'),
    ]:
        if env.get(key_var):
            continue
        result = subprocess.run([sys.executable, args.vault_cli, 'get', name],
                                capture_output=True, text=True, env=env)
        if result.returncode:
            raise RuntimeError('Credential lookup failed: ' + name)
        credential = json.loads(result.stdout)
        if credential.get('credential_status') != 'ok':
            raise RuntimeError('Credential not active: ' + name)
        content = credential['content']
        key = re.search(r'^API\s*Key[：:]\s*(\S+)\s*$', content, re.M | re.I)
        base = re.search(r'^Base URL[：:]\s*(\S+)\s*$', content, re.M | re.I)
        if not key or not base and not default_base:
            raise RuntimeError('Credential fields incomplete: ' + name)
        env[key_var] = key.group(1)
        env[base_var] = (base.group(1) if base else default_base).rstrip('/')
    return subprocess.run(command, env=env).returncode


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (RuntimeError, ValueError, OSError) as error:
        # Exception messages from parsers/processes must not echo secret input.
        print('Unable to start fiction model command (' + type(error).__name__ + ')', file=sys.stderr)
        sys.exit(1)
