/** A document has one owning cabinet. Settling a previous one releases its lock before the next acquires it. */
let owner: { token: object; settle: () => void } | undefined;
export function acquire(token: object, settle: () => void) {
  if (owner && owner.token !== token) owner.settle();
  owner = { token, settle };
}
export function release(token: object) {
  if (owner?.token === token) owner = undefined;
}
