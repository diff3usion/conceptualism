"use strict"
import { doesArrayIntersectSet, isArrayInSet, arrayIntersectSetCount, assert, intersect, appendSet, arrayFilterInSet, arrayFilterNotInSet } from "./utils"

export enum ConceptDefaultMode {
    CanbeAnything = "CanbeAnything",
    IsNothing = "IsNothing",
}

export enum ConceptOrder {
    Cascading = "Cascading",
    Reverse = "Reverse",
}

export enum ConceptVerb {
    Is = "Is",
    Isnt = "Isnt",
    Canbe = "Canbe",
}

export enum ConceptGroupType {
    Or = "Or",
    And = "And",
    Oneof = "Oneof",
}

export type ConceptRelations = {
    is: Set<Concept>
    isnt: Set<Concept>
    canbe: Set<Concept>
}

export type ConceptAssertions = {
    is: Set<Concept>,
    isnt: Set<Concept>,
}

export type Concept = {
    name: string
    defaultMode: ConceptDefaultMode
    qualified: ConceptQualification[]
    resolved: ConceptRelations
}

export type ConceptGroup = {
    type: ConceptGroupType
    concepts: Concept[]
}

export type ConceptMatcher = {
    concept?: Concept,
    group?: ConceptGroup,
}

export type ConceptDeclaration = {
    verb: ConceptVerb
    concept: Concept
}

export type ConceptQualification = {
    negated: boolean
    matcher: ConceptMatcher
    declared: ConceptDeclaration[]
    resolved: ConceptRelations
}

export const initRelations: () => ConceptRelations
    = () => ({
        is: new Set<Concept>(),
        isnt: new Set<Concept>(),
        canbe: new Set<Concept>(),
    })

export const initAssertions: () => ConceptAssertions
    = () => ({
        is: new Set<Concept>(),
        isnt: new Set<Concept>(),
    })

export const initQualification: () => ConceptQualification
    = () => ({
        negated: false,
        matcher: {},
        declared: [],
        resolved: initRelations()
    })

export const initConcept: (name: string, mode: ConceptDefaultMode) => Concept
    = (name, mode) => {
        const c: Concept = {
            name,
            defaultMode: mode,
            resolved: initRelations(),
            qualified: [],
        }
        c.resolved.is.add(c)
        return c
    }

const pickRelationsSet: (rel: ConceptRelations, verb: ConceptVerb) => Set<Concept>
    = ({ is, isnt, canbe }, verb) => {
        switch (verb) {
            case ConceptVerb.Is: return is
            case ConceptVerb.Isnt: return isnt
            case ConceptVerb.Canbe: return canbe
        }
    }

const cloneRelations: (rel: ConceptRelations) => ConceptRelations
    = rel => ({
        is: new Set(rel.is),
        isnt: new Set(rel.isnt),
        canbe: new Set(rel.canbe),
    })

const appendTwoRelations: (rel0: ConceptRelations, rel1: ConceptRelations) => void
    = ({ is, isnt, canbe }, { is: _is, isnt: _isnt, canbe: _canbe }) => {
        appendSet(is, _is)
        appendSet(isnt, _isnt)
        appendSet(canbe, _canbe)
    }

const appendRelations: (rel0: ConceptRelations, ...rels: ConceptRelations[]) => void
    = (rel0, ...rels) => rels.forEach(r => appendTwoRelations(rel0, r))

export const appendQualificationDeclarations: (qualification: ConceptQualification, declarations: ConceptDeclaration[]) => void
    = (q, d) => {
        q.declared.push(...d)
        q.declared.forEach(d => pickRelationsSet(q.resolved, d.verb).add(d.concept))
    }

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
