import type {GoldenRule, SegmentContext} from './types';
import {FILLER_WIDTHS} from './constants';

/**
 * Default golden rules for common segment widths.
 * Articles are placeholders — real articles come from the catalog.
 */
const DEFAULT_RULES: GoldenRule[] = [];

export interface FillerMatch {
    rule: GoldenRule;
    fillerWidth: number;
}

/**
 * Golden Table — a lookup structure mapping (context, width) → module articles.
 * Provides exact match and filler-augmented lookup.
 */
export class GoldenTable {
    private rules: GoldenRule[];

    constructor(initialRules?: GoldenRule[]) {
        this.rules = initialRules ? [...initialRules] : [...DEFAULT_RULES];
    }

    /** Exact match for a given context and width. */
    lookup(context: SegmentContext, width: number): GoldenRule | null {
        return (
            this.rules.find((r) => r.context === context && r.width === width) ?? null
        );
    }

    /**
     * Try to find a rule by subtracting each filler width from the target.
     * Returns the matching rule and the filler width needed, or null.
     */
    lookupWithFiller(
        context: SegmentContext,
        width: number,
    ): FillerMatch | null {
        for (const fw of FILLER_WIDTHS) {
            const reduced = width - fw;
            if (reduced <= 0) continue;

            const rule = this.lookup(context, reduced);
            if (rule) {
                return {rule, fillerWidth: fw};
            }
        }
        return null;
    }

    /** Add a new rule. */
    addRule(rule: GoldenRule): void {
        this.rules.push(rule);
    }

    /** Remove the first rule matching context and width. */
    removeRule(context: SegmentContext, width: number): boolean {
        const idx = this.rules.findIndex(
            (r) => r.context === context && r.width === width,
        );
        if (idx === -1) return false;
        this.rules.splice(idx, 1);
        return true;
    }

    /** Update the first rule matching context and width. */
    updateRule(
        context: SegmentContext,
        width: number,
        moduleArticles: string[],
    ): boolean {
        const rule = this.rules.find(
            (r) => r.context === context && r.width === width,
        );
        if (!rule) return false;
        rule.moduleArticles = moduleArticles;
        return true;
    }

    /** Return a copy of all current rules. */
    getRules(): GoldenRule[] {
        return [...this.rules];
    }
}
