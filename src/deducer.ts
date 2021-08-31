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
    resolved: ConceptRelations
    qualified: ConceptQualification[]
}

export type ConceptGroup = {
    type: ConceptGroupType
    concepts: Concept[]
}

export type ConceptDeclaration = {
    verb: ConceptVerb
    concept: Concept
}

export type ConceptQualification = {
    negated: boolean,
    concept?: Concept
    group?: ConceptGroup
    declared: ConceptDeclaration[]
    resolved: ConceptRelations
}

export const initRelations = () => ({
    is: new Set<Concept>(),
    isnt: new Set<Concept>(),
    canbe: new Set<Concept>(),
})

export const initAssertions = () => ({
    is: new Set<Concept>(),
    isnt: new Set<Concept>(),
})

const checkRelationsInconsistency: (relations: ConceptRelations) => Set<Concept>
    = ({ is, isnt, canbe }) => intersect(is, isnt)

export class ConsistencyResult {
    constructor(
        readonly inconsistency: ConceptAssertions,
    ) { }
    get result(): boolean {
        return !this.inconsistency.is.size && !this.inconsistency.isnt.size
    }
}

export class VerifyingResult {
    constructor(
        readonly missing: Set<Concept>,
        readonly redundant: Set<Concept>,
    ) { }
    get result(): boolean {
        return !this.missing.size && !this.redundant.size
    }
}


export const checkTwoRelationsCompatibility: (rel0: ConceptRelations, rel1: ConceptRelations) => ConsistencyResult
    = ({ is, isnt }, { is: _is, isnt: _isnt }) => new ConsistencyResult({
        is: intersect(is, _isnt),
        isnt: intersect(isnt, _is),
    })

const checkQualificationConsistency: (qualification: ConceptQualification) => ConsistencyResult
    = ({ negated, concept, group, resolved }) => {
        const { is, isnt } = resolved!
        let result = true
        const inconsistency = initAssertions()
        if (concept) {
            result = !(negated ? isnt : is).has(concept)
            if (!result) (negated ? inconsistency.isnt : inconsistency.is).add(concept)
        } else {
            assert(group)
            const { type, concepts } = group
            if (negated) {
                if (type === ConceptGroupType.And) {
                    result = !isArrayInSet(concepts, is)
                    if (!result) appendSet(inconsistency.is, concepts)
                } else if (type === ConceptGroupType.Or) {
                    result = !doesArrayIntersectSet(concepts, is)
                    if (!result) appendSet(inconsistency.is, arrayFilterInSet(concepts, is))
                } else if (type === ConceptGroupType.Oneof) {
                    result = arrayIntersectSetCount(concepts, is) !== 1 ||
                        arrayIntersectSetCount(concepts, isnt) !== concepts.length - 1
                    if (!result) {
                        appendSet(inconsistency.is, arrayFilterInSet(concepts, is))
                        appendSet(inconsistency.isnt, arrayFilterInSet(concepts, isnt))
                    }
                }
            } else {
                if (type === ConceptGroupType.And) {
                    result = !doesArrayIntersectSet(concepts, isnt)
                    if (!result) appendSet(inconsistency.is, arrayFilterInSet(concepts, isnt))
                } else if (type === ConceptGroupType.Or) {
                    result = !isArrayInSet(concepts, isnt)
                    if (!result) appendSet(inconsistency.isnt, concepts)
                } else if (type === ConceptGroupType.Oneof) {
                    result = arrayIntersectSetCount(concepts, is) <= 1
                    if (!result) appendSet(inconsistency.is, arrayFilterInSet(concepts, is))
                }
            }
        }
        return new ConsistencyResult(inconsistency)
    }

export const verifyRelationsOnce: (relations: ConceptRelations, qualification: ConceptQualification) => VerifyingResult
= ({ is }, { negated, concept, group }) => {
    const missing = new Set<Concept>()
    const redundant = new Set<Concept>()
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
    return new VerifyingResult(missing, redundant)
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

type ResolvingResult = {
    relationsInconsistency: Set<Concept>
    qualificationConsistency: ConsistencyResult
}
export const resolveDeclarations: (qualification: ConceptQualification) => ResolvingResult
    = qualification => {
        const relations = initRelations()
        const { is, isnt, canbe } = relations
        qualification.declared.forEach(d => {
            if (d.verb === ConceptVerb.Is) is.add(d.concept)
            else if (d.verb === ConceptVerb.Isnt) isnt.add(d.concept)
            else if (d.verb === ConceptVerb.Canbe) canbe.add(d.concept)
        })
        qualification.resolved = relations
        const relationsInconsistency = checkRelationsInconsistency(relations)
        const qualificationConsistency = checkQualificationConsistency(qualification)
        return { relationsInconsistency, qualificationConsistency }
    }

export type ContextVerifyingResult = {
    resolved: ConceptRelations,
    qualified: ConceptQualification[],
    unqualified: [ConceptQualification, VerifyingResult][],
    incompatible: [ConceptQualification, ConsistencyResult][],
}
export const verifyRelationsRecursively: (relations: ConceptRelations, qualifications: ConceptQualification[]) => ContextVerifyingResult
    = (relations, qualifications) => {
        let resolved = cloneRelations(relations)
        const maybeQualified: Set<ConceptQualification> = new Set()
        const notQualified: Set<ConceptQualification> = new Set()
        const unqualifiedResults: Map<ConceptQualification, VerifyingResult> = new Map()
        const resolveMaybeQualified = () => {
            resolved = cloneRelations(relations)
            appendRelations(resolved, ...Array.from(maybeQualified).map(q => q.resolved))
        }
        const solveRecursiveConflicts: () => void
            = () => {
                let nolongerQualified: ConceptQualification[]
                do {
                    nolongerQualified = Array.from(maybeQualified).filter(q => {
                        const qres = verifyRelationsOnce(resolved, q)
                        if (!qres.result) {
                            unqualifiedResults.set(q, qres)
                            return true
                        }
                        return !checkTwoRelationsCompatibility(resolved, q.resolved!).result
                    })
                    nolongerQualified.forEach(q => {
                        maybeQualified.delete(q)
                        notQualified.add(q)
                        resolveMaybeQualified()
                    })
                } while (nolongerQualified.length)
            }

        let newlyQualified: ConceptQualification[] = []
        let incompatible: [ConceptQualification, ConsistencyResult][] = []
        do {
            if (newlyQualified.length) {
                newlyQualified.forEach(q => maybeQualified.add(q))
                resolveMaybeQualified()
            }
            if (maybeQualified.size) solveRecursiveConflicts()
            incompatible = []
            newlyQualified = qualifications
                .filter(q => !notQualified.has(q) && !maybeQualified.has(q))
                .filter(q => {
                    const res = verifyRelationsOnce(resolved, q)
                    if (!res.result) unqualifiedResults.set(q, res)
                    return res.result
                })
                .filter(q => {
                    const res = checkTwoRelationsCompatibility(resolved, q.resolved!)
                    if (!res.result) incompatible.push([q, res])
                    return res.result
                })
        } while (newlyQualified.length)
        return {
            resolved,
            qualified: Array.from(maybeQualified),
            unqualified: Array.from(unqualifiedResults).filter(([q]) => !maybeQualified.has(q)),
            incompatible: Array.from(incompatible),
        }
    }
