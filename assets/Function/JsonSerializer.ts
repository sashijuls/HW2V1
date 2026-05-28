// JSON.stringify that skips already-visited objects to handle circular refs
export function serializeCircular(obj: object): string {
    const visited: object[] = [];
    return JSON.stringify(obj, function(key, value) {
        if (value !== null && typeof value === 'object') {
            if (visited.indexOf(value) >= 0) {
                return;
            }
            visited.push(value);
        }
        return value;
    });
}
