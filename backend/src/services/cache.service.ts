import { createHash } from 'crypto';

export class CacheService {
    private cache: Map<string, any> = new Map();

    /**
     * Generates a deterministic signature from a list of variant IDs.
     * Signature = SHA256(sorted(rsids))
     */
    public generateSignature(identifiers: string[]): string {
        // Filter out empty IDs and sort strictly
        const sortedIds = identifiers.filter(id => !!id).sort();
        const data = sortedIds.join('|'); // Use a separator to avoid concatenation collisions
        return createHash('sha256').update(data).digest('hex');
    }

    public get(key: string): any | undefined {
        return this.cache.get(key);
    }

    public set(key: string, value: any): void {
        this.cache.set(key, value);
    }

    public clear(): void {
        this.cache.clear();
    }
}

export const cacheService = new CacheService();
