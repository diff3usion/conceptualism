"use strict"
import { doesArrayIntersectSet, isArrayInSet, arrayIntersectSetCount, assert, arrayIntersectSet, intersect, appendSet } from "./utils"

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

const checkRelationsInconsistency: (relations: ConceptRelations) => Set<Concept>
    = ({ is, isnt, canbe }) => intersect(is, isnt)

export type CompatibilityResult = {
    result: boolean
    inconsistentIses: [Concept[], Concept[]]
}

export const checkTwoRelationsCompatibility: (rel0: ConceptRelations, rel1: ConceptRelations) => CompatibilityResult
    = ({ is, isnt }, { is: _is, isnt: _isnt }) => {
        const inconsistentIses = [[...intersect(is, _isnt)], [...intersect(isnt, _is)]] as [Concept[], Concept[]]
        const result = !inconsistentIses[0].length && !inconsistentIses[1].length
        return { result, inconsistentIses }
    }

type ConsistencyResult = {
    result: boolean
    inconsistentIs: Concept[]
    inconsistentIsnt: Concept[]
}

const checkQualificationConsistency: (qualification: ConceptQualification) => ConsistencyResult
    = ({ negated, concept, group, resolved }) => {
        const { is, isnt } = resolved!
        let result = true
        const inconsistentIs: Concept[] = []
        const inconsistentIsnt: Concept[] = []
        if (concept) {
            result = !(negated ? isnt : is).has(concept)
            if (!result) (negated ? inconsistentIsnt : inconsistentIs).push(concept)
        } else {
            assert(group)
            const { type, concepts } = group
            if (negated) {
                if (type === ConceptGroupType.And) {
                    result = !isArrayInSet(concepts, is)
                    if (!result) concepts.forEach(c => inconsistentIs.push(c))
                } else if (type === ConceptGroupType.Or) {
                    result = !doesArrayIntersectSet(concepts, is)
                    if (!result) concepts.filter(c => is.has(c)).forEach(c => inconsistentIs.push(c))
                } else if (type === ConceptGroupType.Oneof) {
                    result = arrayIntersectSetCount(concepts, is) !== 1 ||
                        arrayIntersectSetCount(concepts, isnt) !== concepts.length - 1
                    if (!result) {
                        concepts.filter(c => is.has(c)).forEach(c => inconsistentIs.push(c))
                        concepts.filter(c => isnt.has(c)).forEach(c => inconsistentIsnt.push(c))
                    }
                }
            } else {
                if (type === ConceptGroupType.And) {
                    result = !doesArrayIntersectSet(concepts, isnt)
                    if (!result) concepts.filter(c => isnt.has(c)).forEach(c => inconsistentIs.push(c))
                } else if (type === ConceptGroupType.Or) {
                    result = !isArrayInSet(concepts, isnt)
                    if (!result) concepts.forEach(c => inconsistentIsnt.push(c))
                } else if (type === ConceptGroupType.Oneof) {
                    result = arrayIntersectSetCount(concepts, is) <= 1
                    if (!result) concepts.filter(c => is.has(c)).forEach(c => inconsistentIs.push(c))
                }
            }
        }
        return { result, inconsistentIs, inconsistentIsnt }
    }

type VerifyingResult = {
    result: boolean
    missingIs: Concept[]
    redundantIs: Concept[]
}

export const verifyRelations: (relations: ConceptRelations, qualification: ConceptQualification) => VerifyingResult
    = ({ is, isnt, canbe }, { negated, concept, group }) => {
        let result = true
        const missingIs: Concept[] = []
        const redundantIs: Concept[] = []
        if (concept) {
            result = negated !== is.has(concept)
            if (!result) (negated ? redundantIs : missingIs).push(concept)
        } else {
            assert(group)
            const { type, concepts } = group
            if (type === ConceptGroupType.And) {
                result = negated !== isArrayInSet(concepts, is)
                if (!result) {
                    if (negated) {
                        concepts.forEach(c => redundantIs.push(c))
                    } else {
                        concepts.filter(c => !is.has(c)).forEach(c => missingIs.push(c))
                    }
                }
            } else if (type === ConceptGroupType.Or) {
                result = negated !== doesArrayIntersectSet(concepts, is)
                if (!result) {
                    if (negated) {
                        concepts.filter(c => is.has(c)).forEach(c => redundantIs.push(c))
                    } else {
                        concepts.forEach(c => missingIs.push(c))
                    }
                }
            } else if (type === ConceptGroupType.Oneof) {
                const intersects = arrayIntersectSet(concepts, is)
                result = negated !== (intersects.length === 1)
                if (!result) {
                    if (negated) {
                        intersects.forEach(c => redundantIs.push(c))
                        concepts.filter(c => !intersects.includes(c)).forEach(c => missingIs.push(c))
                    } else {
                        if (intersects.length < 1) concepts.forEach(c => missingIs.push(c))
                        else concepts.filter(c => is.has(c)).forEach(c => redundantIs.push(c))
                    }
                }
            }
        }
        return { result, missingIs, redundantIs }
    }

export const initRelations = () => ({
    is: new Set<Concept>(),
    isnt: new Set<Concept>(),
    canbe: new Set<Concept>(),
})

const cloneRelations: (rel: ConceptRelations) => ConceptRelations
    = rel => ({
        is: new Set(rel.is),
        isnt: new Set(rel.isnt),
        canbe: new Set(rel.canbe),
    })

const concatRelations: (rel0: ConceptRelations, rel1: ConceptRelations) => void
    = ({ is, isnt, canbe }, { is: _is, isnt: _isnt, canbe: _canbe }) => {
        appendSet(is, _is)
        appendSet(isnt, _isnt)
        appendSet(canbe, _canbe)
    }

const concatMultipleRelations: (rel0: ConceptRelations, rels: ConceptRelations[]) => void
    = (rel0, rels) => rels.forEach(r => concatRelations(rel0, r))

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

export type QualifyingResult = {
    resolved: ConceptRelations,
    qualified: ConceptQualification[],
    incompatible: [ConceptQualification, CompatibilityResult][]
}
export const qualifyRelations: (relations: ConceptRelations, qualifications: ConceptQualification[]) => QualifyingResult
    = (relations, qualifications) => {
        let resolved = cloneRelations(relations)
        const maybeQualified: Set<ConceptQualification> = new Set()
        const notQualified: Set<ConceptQualification> = new Set()
        const newlyQualified: Set<ConceptQualification> = new Set()
        const incompatible: Set<[ConceptQualification, CompatibilityResult]> = new Set()
        const resolveMaybeQualified = () => {
            resolved = cloneRelations(relations)
            concatMultipleRelations(resolved, Array.from(maybeQualified).map(q => q.resolved))
        }
        const solveRecursiveConflicts: () => void
            = () => {
                let nolongerQualified: ConceptQualification[]
                do {
                    nolongerQualified = Array.from(maybeQualified).filter(q =>
                        !verifyRelations(resolved, q).result ||
                        !checkTwoRelationsCompatibility(resolved, q.resolved!).result)
                    nolongerQualified.forEach(q => {
                        maybeQualified.delete(q)
                        notQualified.add(q)
                        resolveMaybeQualified()
                    })
                } while (nolongerQualified.length)
            }
        do {
            if (newlyQualified.size) {
                newlyQualified.forEach(q => maybeQualified.add(q))
                resolveMaybeQualified()
            }
            newlyQualified.clear()
            incompatible.clear()
            if (maybeQualified.size) solveRecursiveConflicts()
            qualifications
                .filter(q => !notQualified.has(q) && !maybeQualified.has(q))
                .filter(q => verifyRelations(resolved, q).result)
                .filter(q => {
                    const compatibility = checkTwoRelationsCompatibility(resolved, q.resolved!)
                    if (!compatibility.result) incompatible.add([q, compatibility])
                    return compatibility.result
                })
                .forEach(q => newlyQualified.add(q))
        } while (newlyQualified.size)
        return {
            resolved,
            qualified: Array.from(maybeQualified),
            incompatible: Array.from(incompatible),
        }
    }
