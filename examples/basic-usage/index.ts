import { createInfraAdapter, infraAdapterDescriptor } from '@ankhorage/cerbos';

const adapter = createInfraAdapter();

console.log(infraAdapterDescriptor.id, adapter.descriptor.package);
