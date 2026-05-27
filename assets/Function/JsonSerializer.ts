/**
 * JSON serialization helper that handles circular object references.
 * Objects that have already been visited are skipped to prevent infinite loops.
 */
export function serializeCircular(obj: object): string {
    const visited: object[] = [];
    return JSON.stringify(obj, function(key, value) {
        if (value !== null && typeof value === 'object') {
            if (visited.indexOf(value) >= 0) {
                return; // skip already-visited object to break circular reference
            }
            visited.push(value);
        }
        return value;
    });
}
