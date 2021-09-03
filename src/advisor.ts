import { ConceptRelations, ConceptContext, ConceptQualification, Concept, cloneRelations } from "./data"
import { verifyRelationsInContext, ContextVerifyingResult, assertTillVerified, areTwoRelationsCompatible } from "./deducer"

export class ConceptAdvisor {
    constructor(
        public rel: ConceptRelations,
        public ctx: ConceptContext,
        public overridable?: ConceptQualification[],
        public excludeConcepts?: Concept[],
        public excludeQualifications?: ConceptQualification[],
    ) { }

    get furtherConcepts(): Concept[] {
        const { resolved, incompatible, qualified } = verifyRelationsInContext(this.rel, this.ctx)
        if (incompatible.length) return []
        const relations = cloneRelations(this.rel)
        return Array.from(this.ctx.concepts.values())
            .filter(c => !relations.is.has(c) && !relations.isnt.has(c) && !resolved.is.has(c))
            .filter(c => !this.excludeConcepts?.includes(c))
            .filter(c => {
                relations.is.add(c)
                const verifyRes = verifyRelationsInContext(relations, this.ctx)
                const res = !verifyRes.incompatible.length && qualified
                    .filter(q => !this.overridable?.includes(q))
                    .every(q => verifyRes.qualified.includes(q))
                relations.is.delete(c)
                return res
            })
    }

    get furtherQualifications(): [ConceptQualification, ConceptRelations, ContextVerifyingResult][] {
        const res: [ConceptQualification, ConceptRelations, ContextVerifyingResult][] = []
        const { incompatible, unqualified } = verifyRelationsInContext(this.rel, this.ctx)
        if (incompatible.length) return res
        unqualified
            .filter(([_, res]) => !res.redundant.size)
            .map(([q]) => q)
            .forEach(q => {
                const attempt = assertTillVerified(this.rel, q)
                if (!areTwoRelationsCompatible(this.rel, attempt)) return
                const cvres = verifyRelationsInContext(attempt, this.ctx)
                if (!cvres.incompatible.length) res.push([q, attempt, cvres])
            })
            return res
    }
}
