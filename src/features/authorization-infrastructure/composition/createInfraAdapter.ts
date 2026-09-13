import type { InfraServiceAdapter } from '@ankhorage/contracts/infra';

import { infraAdapterDescriptor } from '../../../constants/infra';
import {
  destroyCerbos,
  getCerbosStatus,
  planCerbos,
  reconcileCerbos,
  validateCerbos,
} from '../application/cerbosLifecycle';
import { createCerbosWorkload } from '../application/createCerbosWorkload';

/***
 * Create the canonical runtime-neutral Cerbos authorization adapter.
 *
 * Cerbos contributes one portable workload plus policy files. The selected runtime owns their
 * concrete materialization; this provider contains no Kubernetes or Compose branches.
 *
 * @readme
 */
export function createInfraAdapter(): InfraServiceAdapter {
  return {
    descriptor: infraAdapterDescriptor,
    validateAsync: (context) => Promise.resolve(validateCerbos(context)),
    planAsync: (context) => Promise.resolve(planCerbos(context)),
    desiredWorkloadsAsync: (context) => {
      const validation = validateCerbos(context);
      return Promise.resolve(
        validation.ok
          ? { ok: true, value: [createCerbosWorkload(context)], diagnostics: [] }
          : validation,
      );
    },
    reconcileAsync: (context) => Promise.resolve(reconcileCerbos(context)),
    statusAsync: (context) => Promise.resolve(getCerbosStatus(context)),
    destroyAsync: (context, request) => Promise.resolve(destroyCerbos(context, request)),
  };
}
