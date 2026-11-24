/** Shared types for skills-marketplace-sync. */
/** Thrown for usage/configuration problems (exit code 2). */
export class UsageError extends Error {
    constructor(message) {
        super(message);
        this.name = "UsageError";
    }
}
