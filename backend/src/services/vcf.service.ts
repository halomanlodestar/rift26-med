
const TARGET_GENES = new Set([
    'CYP2D6',
    'CYP2C19',
    'CYP2C9',
    'SLCO1B1',
    'TPMT',
    'DPYD',
]);

export interface ParsedVariant {
    gene: string;
    rsId: string;
    starAllele?: string;
    chromosome: string;
    position: string;
    ref: string;
    alt: string;
    info: Record<string, string>;
}

export class VcfService {
    /**
     * Parse raw VCF text and return relevant variants for the target genes.
     */
    public parseVcf(vcfContent: string): ParsedVariant[] {
        const variants: ParsedVariant[] = [];
        const lines = vcfContent.split('\n');

        for (const line of lines) {
            if (!line || line.startsWith('#')) continue;

            const parts = line.split('\t');
            // VCF standard columns:
            // 0: CHROM, 1: POS, 2: ID, 3: REF, 4: ALT, 5: QUAL, 6: FILTER, 7: INFO
            if (parts.length < 8) continue;

            const [chrom, pos, id, ref, alt, _qual, _filter, infoStr] = parts;

            if (!chrom || !pos || !ref || !alt || !infoStr) continue;

            // Parse INFO field
            const info: Record<string, string> = {};
            const infoParts = infoStr.split(';');
            for (const part of infoParts) {
                const [key, value] = part.split('=');
                if (key && value) {
                    info[key] = value;
                } else if (key) {
                    info[key] = 'true'; // Flag
                }
            }

            // Check for GENE in INFO
            let gene = info['GENE'];

            // If no GENE in INFO, we skip it for this specific hackathon scope 
            // where user said "VCF INFO fields: GENE".
            if (!gene) continue;

            // Handle multiple genes if present (e.g. comma separated)? 
            // User said "VCF may contain many genes. Filter ONLY these 6."
            // Assuming simple match for now.
            if (!TARGET_GENES.has(gene)) continue;

            const starAllele = info['STAR'];

            variants.push({
                gene,
                rsId: id && id !== '.' ? id : '', // Use standard ID column for RS
                starAllele: starAllele || undefined,
                chromosome: chrom,
                position: pos,
                ref,
                alt,
                info
            });
        }

        return variants;
    }
}

export const vcfService = new VcfService();
