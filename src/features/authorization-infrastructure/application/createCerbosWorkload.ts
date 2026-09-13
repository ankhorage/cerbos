import type { InfraExecutionContext, InfraWorkloadSpec } from '@ankhorage/contracts/infra';

const CERBOS_CONFIG = `server:
  httpListenAddr: ":3592"
  grpcListenAddr: ":3593"
storage:
  driver: "disk"
  disk:
    directory: /policies
`;

/** Project Cerbos config and policy intent into one runtime-neutral workload. */
export function createCerbosWorkload(context: InfraExecutionContext): InfraWorkloadSpec {
  const policies =
    context.desired.authz?.provider === 'cerbos' ? context.desired.authz.policies : [];
  return {
    id: 'cerbos',
    artifact: { kind: 'image', image: 'ghcr.io/cerbos/cerbos:0.40.0' },
    args: ['server', '--config=/config/config.yaml'],
    ports: [
      { name: 'http', port: 3592 },
      { name: 'grpc', port: 3593 },
    ],
    files: [
      { path: '/config/config.yaml', content: { kind: 'literal', value: CERBOS_CONFIG } },
      ...[...(policies ?? [])]
        .sort((left, right) => left.path.localeCompare(right.path))
        .map(({ path, content }) => ({
          path: `/policies/${path}`,
          content: { kind: 'literal' as const, value: content },
        })),
    ],
    health: {
      kind: 'command',
      command: ['/cerbos', 'healthcheck', '--config=/config/config.yaml'],
    },
    exposure: 'internal',
    replicas: 1,
  };
}
