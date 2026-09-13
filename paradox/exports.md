# Public API

## createInfraAdapter

Kind: `function`
Module: `src/features/authorization-infrastructure/composition/createInfraAdapter.ts`
Source: `src/features/authorization-infrastructure/composition/createInfraAdapter.ts:21:1`

Create the canonical runtime-neutral Cerbos authorization adapter.

Cerbos contributes one portable workload plus policy files. The selected runtime owns their
concrete materialization; this provider contains no Kubernetes or Compose branches.

### Signatures

- `() => InfraServiceAdapter`
  - returns: `InfraServiceAdapter`

## infraAdapterDescriptor

Kind: `value`
Module: `src/constants/infra.ts`
Source: `src/constants/infra.ts:5:14`
