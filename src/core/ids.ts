const createId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
export const createPartId = () => createId('part');
export const createOperationId = () => createId('op');
export const createProjectId = () => createId('prj');
export const createJointId = () => createId('jnt');
export const createHardwareId = () => createId('hw');
export const createGasSpringId = () => createId('gas');
