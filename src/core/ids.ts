const createId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
export const createPartId = () => createId('part');
export const createOperationId = () => createId('op');
export const createProjectId = () => createId('prj');
