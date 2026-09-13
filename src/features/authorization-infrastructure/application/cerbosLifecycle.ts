import type {
  InfraDestroyRequest,
  InfraExecutionContext,
  InfraOutput,
  InfraOwnedResource,
  InfraPlanAction,
  InfraReconcileResult,
  InfraResourceStatus,
  InfraResult,
} from '@ankhorage/contracts/infra';

/** Validate that this adapter is invoked only for an explicit Cerbos selection. */
export function validateCerbos(context: InfraExecutionContext): InfraResult<null> {
  return context.desired.authz?.provider === 'cerbos'
    ? { ok: true, value: null, diagnostics: [] }
    : invalidSelection();
}

/** Plan the logical Cerbos service owner around its runtime-owned workload. */
export function planCerbos(
  context: InfraExecutionContext,
): InfraResult<readonly InfraPlanAction[]> {
  const validation = validateCerbos(context);
  if (!validation.ok) return validation;
  const owner = createCerbosOwner(context);
  const exists = hasPreviousOwner(context, owner);
  return {
    ok: true,
    value: [
      {
        owner: owner.identity,
        operation: exists ? 'noop' : 'create',
        impact: 'none',
        detail: `Cerbos authorization service: ${exists ? 'noop' : 'create'}.`,
        dependsOn: owner.dependsOn,
      },
    ],
    diagnostics: [],
  };
}

/** Record the logical provider owner and its non-secret in-network endpoint. */
export function reconcileCerbos(context: InfraExecutionContext): InfraResult<InfraReconcileResult> {
  const validation = validateCerbos(context);
  if (!validation.ok) return validation;
  const owner = createCerbosOwner(context);
  return {
    ok: true,
    value: { resources: [owner], outputs: [createCerbosOutput(owner)] },
    diagnostics: [],
  };
}

/** Report logical state; the selected runtime separately reports workload health. */
export function getCerbosStatus(
  context: InfraExecutionContext,
): InfraResult<readonly InfraResourceStatus[]> {
  const validation = validateCerbos(context);
  if (!validation.ok) return validation;
  const owner = createCerbosOwner(context);
  return {
    ok: true,
    value: [
      { owner: owner.identity, state: hasPreviousOwner(context, owner) ? 'ready' : 'absent' },
    ],
    diagnostics: [],
  };
}

/** Remove only the logical provider owner after exact destructive confirmation. */
export function destroyCerbos(
  context: InfraExecutionContext,
  request: InfraDestroyRequest,
): InfraResult<InfraReconcileResult> {
  if (!isConfirmed(context, request)) return unconfirmedDestroy();
  return { ok: true, value: { resources: [], outputs: [] }, diagnostics: [] };
}

function createCerbosOwner(context: InfraExecutionContext): InfraOwnedResource {
  return {
    identity: {
      projectId: context.projectId,
      environment: context.environment,
      adapter: 'cerbos',
      resourceId: 'service',
    },
    externalId: `${context.projectId}-${context.environment}-cerbos`,
    persistent: false,
    retention: 'delete-on-destroy',
    dependsOn: [
      {
        projectId: context.projectId,
        environment: context.environment,
        adapter: context.desired.deployment.runtime.provider,
        resourceId: 'workload:cerbos',
      },
    ],
  };
}

function createCerbosOutput(owner: InfraOwnedResource): InfraOutput {
  return {
    owner: owner.identity,
    name: 'http',
    visibility: 'public',
    value: 'http://cerbos:3592',
    environmentVariable: 'CERBOS_URL',
  };
}

function hasPreviousOwner(context: InfraExecutionContext, owner: InfraOwnedResource): boolean {
  return (
    context.previous?.resources.some(
      ({ identity }) =>
        identity.projectId === owner.identity.projectId &&
        identity.environment === owner.identity.environment &&
        identity.adapter === owner.identity.adapter &&
        identity.resourceId === owner.identity.resourceId,
    ) ?? false
  );
}

function isConfirmed(context: InfraExecutionContext, request: InfraDestroyRequest): boolean {
  return (
    request.projectId === context.projectId &&
    request.environment === context.environment &&
    request.confirmation.projectId === context.projectId &&
    request.confirmation.environment === context.environment
  );
}

function invalidSelection(): InfraResult<never> {
  return {
    ok: false,
    diagnostics: [
      {
        severity: 'error',
        code: 'cerbos-selection-invalid',
        message: 'Cerbos requires the canonical Cerbos authorization selection.',
      },
    ],
  };
}

function unconfirmedDestroy(): InfraResult<never> {
  return {
    ok: false,
    diagnostics: [
      {
        severity: 'error',
        code: 'cerbos-destroy-unconfirmed',
        message: 'Cerbos destroy requires exact project and environment confirmation.',
      },
    ],
  };
}
