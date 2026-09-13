import type { InfraExecutionContext } from '@ankhorage/contracts/infra';
import { expect, it } from 'bun:test';

import { createInfraAdapter } from './index';

it('contributes one deterministic runtime-neutral Cerbos workload', async () => {
  const adapter = createInfraAdapter();
  const context = createContext();

  expect((await adapter.validateAsync(context)).ok).toBe(true);
  const workloads = await adapter.desiredWorkloadsAsync(context);
  expect(workloads.ok).toBe(true);
  if (!workloads.ok) return;
  expect(workloads.value).toEqual([
    {
      id: 'cerbos',
      artifact: { kind: 'image', image: 'ghcr.io/cerbos/cerbos:0.40.0' },
      args: ['server', '--config=/config/config.yaml'],
      ports: [
        { name: 'http', port: 3592 },
        { name: 'grpc', port: 3593 },
      ],
      files: [
        {
          path: '/config/config.yaml',
          content: {
            kind: 'literal',
            value:
              'server:\n  httpListenAddr: ":3592"\n  grpcListenAddr: ":3593"\nstorage:\n  driver: "disk"\n  disk:\n    directory: /policies\n',
          },
        },
        { path: '/policies/a.yaml', content: { kind: 'literal', value: 'policy-a' } },
        { path: '/policies/z.yaml', content: { kind: 'literal', value: 'policy-z' } },
      ],
      health: {
        kind: 'command',
        command: ['/cerbos', 'healthcheck', '--config=/config/config.yaml'],
      },
      exposure: 'internal',
      replicas: 1,
    },
  ]);
  expect(JSON.stringify(workloads.value)).not.toContain('Deployment');
  expect(JSON.stringify(workloads.value)).not.toContain('docker-compose');
});

it('tracks a logical owner and exposes only the non-secret in-network endpoint', async () => {
  const adapter = createInfraAdapter();
  const context = createContext();
  const initial = await adapter.planAsync(context);
  expect(initial.ok && initial.value[0]?.operation).toBe('create');

  const reconciled = await adapter.reconcileAsync(context, []);
  expect(reconciled.ok).toBe(true);
  if (!reconciled.ok) return;
  expect(reconciled.value.outputs).toEqual([
    {
      owner: {
        projectId: 'sample',
        environment: 'local',
        adapter: 'cerbos',
        resourceId: 'service',
      },
      name: 'http',
      visibility: 'public',
      value: 'http://cerbos:3592',
      environmentVariable: 'CERBOS_URL',
    },
  ]);

  const convergedContext: InfraExecutionContext = {
    ...context,
    previous: {
      schemaVersion: 1,
      projectId: 'sample',
      environment: 'local',
      resources: reconciled.value.resources,
      artifacts: [],
    },
  };
  const converged = await adapter.planAsync(convergedContext);
  expect(converged.ok && converged.value[0]?.operation).toBe('noop');
  const status = await adapter.statusAsync(convergedContext);
  expect(status.ok && status.value[0]?.state).toBe('ready');
});

it('requires exact confirmation and rejects invocation without Cerbos selection', async () => {
  const adapter = createInfraAdapter();
  const context = createContext();
  const rejected = await adapter.destroyAsync(context, {
    projectId: 'sample',
    environment: 'local',
    confirmation: { projectId: 'wrong', environment: 'local' },
    persistence: { policy: 'retain' },
  });
  expect(rejected.ok).toBe(false);
  const destroyed = await adapter.destroyAsync(context, createDestroyRequest());
  expect(destroyed.ok && destroyed.value.resources).toEqual([]);

  const unselected: InfraExecutionContext = {
    ...context,
    desired: { deployment: context.desired.deployment },
  };
  expect((await adapter.validateAsync(unselected)).ok).toBe(false);
});

function createContext(): InfraExecutionContext {
  return {
    projectId: 'sample',
    environment: 'local',
    desired: {
      deployment: {
        compute: { provider: 'local' },
        runtime: { provider: 'docker-compose' },
      },
      authz: {
        provider: 'cerbos',
        kind: 'ABAC',
        policies: [
          { path: 'z.yaml', content: 'policy-z' },
          { path: 'a.yaml', content: 'policy-a' },
        ],
      },
    },
    credentials: { resolveAsync: () => Promise.resolve({ ok: true, value: {}, diagnostics: [] }) },
    secrets: { resolveAsync: () => Promise.resolve({ ok: true, value: '', diagnostics: [] }) },
  };
}

function createDestroyRequest() {
  return {
    projectId: 'sample',
    environment: 'local' as const,
    confirmation: { projectId: 'sample', environment: 'local' as const },
    persistence: { policy: 'retain' as const },
  };
}
