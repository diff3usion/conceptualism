"use strict"
import { ConceptRelations, Concept, ConceptQualification, ConceptAssertions, ConceptGroupType, appendRelations, cloneRelations } from "./data"
import { doesArrayIntersectSet, isArrayInSet, arrayIntersectSetCount, assert, intersect, appendSet, arrayFilterInSet, arrayFilterNotInSet } from "./utils"

export type ConsistencyResult = {
    inconsistency: ConceptAssertions
    result: boolean
}
const initConsistencyResult: (inconsistency: ConceptAssertions) => ConsistencyResult =
    inconsistency => ({
        inconsistency,
        result: !inconsistency.is.size && !inconsistency.isnt.size,
    })
export const areTwoRelationsCompatible: (rel0: ConceptRelations, rel1: ConceptRelations) => ConsistencyResult
    = ({ is, isnt }, { is: _is, isnt: _isnt }) =>
        initConsistencyResult({
            is: intersect(is, _isnt),
            isnt: intersect(isnt, _is),
        })
export const isQualificationConsistent: (q: ConceptQualification) => ConsistencyResult
    = ({ negated, matcher: { concept, group }, resolved }) => {
        const inconsistency = areTwoRelationsCompatible(resolved, resolved).inconsistency
        const { is, isnt } = resolved

        if (concept) {
            if ((negated ? isnt : is).has(concept))
                (negated ? inconsistency.isnt : inconsistency.is).add(concept)
        } else {
            assert(group)
            const { type, concepts } = group
            if (negated) {
                if (type === ConceptGroupType.And) {
                    if (isArrayInSet(concepts, is))
                        appendSet(inconsistency.is, concepts)
                } else if (type === ConceptGroupType.Or) {
                    if (doesArrayIntersectSet(concepts, is))
                        appendSet(inconsistency.is, arrayFilterInSet(concepts, is))
                } else if (type === ConceptGroupType.Oneof) {
                    if (arrayIntersectSetCount(concepts, is) === 1 &&
                        arrayIntersectSetCount(concepts, isnt) === concepts.length - 1) {
                        appendSet(inconsistency.is, arrayFilterInSet(concepts, is))
                        appendSet(inconsistency.isnt, arrayFilterInSet(concepts, isnt))
                    }
                }
            } else {
                if (type === ConceptGroupType.And) {
                    if (doesArrayIntersectSet(concepts, isnt))
                        appendSet(inconsistency.is, arrayFilterInSet(concepts, isnt))
                } else if (type === ConceptGroupType.Or) {
                    if (isArrayInSet(concepts, isnt))
                        appendSet(inconsistency.isnt, concepts)
                } else if (type === ConceptGroupType.Oneof) {
                    if (arrayIntersectSetCount(concepts, is) > 1)
                        appendSet(inconsistency.is, arrayFilterInSet(concepts, is))
                }
            }
        }
        return initConsistencyResult(inconsistency)
    }

export type VerifyingResult = {
    missing: Set<Concept>
    redundant: Set<Concept>
    result: boolean
}
const initVerifyingResult: (missing: Set<Concept>, redundant: Set<Concept>) => VerifyingResult =
    (missing, redundant) => ({
        missing,
        redundant,
        result: !missing.size && !redundant.size
    })
export const verifyRelations: (relations: ConceptRelations, qualification: ConceptQualification) => VerifyingResult
    = ({ is }, { negated, matcher: { concept, group } }) => {
        const missing = new Set<Concept>(), redundant = new Set<Concept>()
        if (concept) {
            if (negated === is.has(concept))
                (negated ? redundant : missing).add(concept)
        } else {
            assert(group)
            const { type, concepts } = group
            if (type === ConceptGroupType.And) {
                if (negated === isArrayInSet(concepts, is)) {
                    if (negated) {
                        appendSet(redundant, concepts)
                    } else {
                        appendSet(missing, arrayFilterNotInSet(concepts, is))
                    }
                }
            } else if (type === ConceptGroupType.Or) {
                if (negated === doesArrayIntersectSet(concepts, is)) {
                    if (negated) {
                        appendSet(redundant, arrayFilterInSet(concepts, is))
                    } else {
                        appendSet(missing, concepts)
                    }
                }
            } else if (type === ConceptGroupType.Oneof) {
                const intersects = new Set(arrayFilterInSet(concepts, is))
                if (negated === (intersects.size === 1)) {
                    if (negated) {
                        appendSet(redundant, intersects)
                        appendSet(missing, arrayFilterNotInSet(concepts, intersects))
                    } else {
                        if (intersects.size < 1) appendSet(missing, concepts)
                        else appendSet(redundant, arrayFilterInSet(concepts, is))
                    }
                }
            }
        }
        return initVerifyingResult(missing, redundant)
    }

export type ContextVerifyingResult = {
    resolved: ConceptRelations,
    qualified: ConceptQualification[],
    unqualified: [ConceptQualification, VerifyingResult][],
    incompatible: [ConceptQualification, ConsistencyResult][],
}
export const verifyRelationsInContext: (relations: ConceptRelations, qualifications: ConceptQualification[]) => ContextVerifyingResult
    = (relations, qualifications) => {
        let resolved = cloneRelations(relations)
        const maybeQualified: Set<ConceptQualification> = new Set()
        const notQualified: Set<ConceptQualification> = new Set()
        const unqualifiedResults: Map<ConceptQualification, VerifyingResult> = new Map()
        const resolveMaybeQualified = () => {
            resolved = cloneRelations(relations)
            appendRelations(resolved, ...Array.from(maybeQualified).map(q => q.resolved))
        }
        const findNolongerQualified: () => ConceptQualification[]
            = () => Array.from(maybeQualified).filter(q => {
                const qres = verifyRelations(resolved, q)
                if (!qres.result) unqualifiedResults.set(q, qres)
                return !qres.result || !areTwoRelationsCompatible(resolved, q.resolved!).result
            })
        const solveRecursiveConflicts: () => void
            = () => {
                let nolongerQualified: ConceptQualification[]
                do {
                    nolongerQualified = findNolongerQualified()
                    nolongerQualified.forEach(q => {
                        maybeQualified.delete(q)
                        notQualified.add(q)
                    })
                    resolveMaybeQualified()
                } while (nolongerQualified.length)
            }

        let newlyQualified: ConceptQualification[]
        let incompatible: [ConceptQualification, ConsistencyResult][]
        do {
            incompatible = []
            newlyQualified = qualifications
                .filter(q => !notQualified.has(q) && !maybeQualified.has(q))
                .filter(q => {
                    const res = verifyRelations(resolved, q)
                    if (!res.result) unqualifiedResults.set(q, res)
                    return res.result
                })
                .filter(q => {
                    const res = areTwoRelationsCompatible(resolved, q.resolved!)
                    if (!res.result) incompatible.push([q, res])
                    return res.result
                })
            if (newlyQualified.length) {
                appendSet(maybeQualified, newlyQualified)
                resolveMaybeQualified()
            }
            if (maybeQualified.size) solveRecursiveConflicts()
        } while (newlyQualified.length)
        return {
            resolved,
            qualified: Array.from(maybeQualified),
            unqualified: Array.from(unqualifiedResults).filter(([q]) => !maybeQualified.has(q)),
            incompatible: Array.from(incompatible),
        }
    }
