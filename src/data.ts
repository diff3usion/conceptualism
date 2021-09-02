import { appendSet } from "./utils"

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

export type ConceptContext = {
    concepts: Map<string, Concept>
    qualifications: ConceptQualification[]
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

export const pickRelationsSet: (rel: ConceptRelations, verb: ConceptVerb) => Set<Concept>
    = ({ is, isnt, canbe }, verb) => {
        switch (verb) {
            case ConceptVerb.Is: return is
            case ConceptVerb.Isnt: return isnt
            case ConceptVerb.Canbe: return canbe
        }
    }

export const cloneRelations: (rel: ConceptRelations) => ConceptRelations
    = rel => ({
        is: new Set(rel.is),
        isnt: new Set(rel.isnt),
        canbe: new Set(rel.canbe),
    })

export const appendTwoRelations: (rel0: ConceptRelations, rel1: ConceptRelations) => void
    = ({ is, isnt, canbe }, { is: _is, isnt: _isnt, canbe: _canbe }) => {
        appendSet(is, _is)
        appendSet(isnt, _isnt)
        appendSet(canbe, _canbe)
    }

export const appendRelations: (rel0: ConceptRelations, ...rels: ConceptRelations[]) => void
    = (rel0, ...rels) => rels.forEach(r => appendTwoRelations(rel0, r))

export const appendQualificationDeclarations: (qualification: ConceptQualification, declarations: ConceptDeclaration[]) => void
    = (q, d) => {
        q.declared.push(...d)
        q.declared.forEach(d => pickRelationsSet(q.resolved, d.verb).add(d.concept))
    }

export const stringifyRelations: (r: ConceptRelations) => string
    = r =>
        `Relation(${Object.entries(r).map(([s, set]) => `${s}{${[...set].map(c => c.name).join('; ')}}`).join(', ')}}`

export const stringifyConcept: (ctx: ConceptContext, c: Concept, showResolved?: boolean, showQualified?: boolean) => string
    = (ctx, c, showResolved = false, showQualified = false) =>
        `Concept(${c.name}, ${c.defaultMode}${showResolved ? `, ${stringifyRelations(c.resolved)}` : ''}, ${c.qualified && showQualified ? `, Qualified: [${[...c.qualified].map(q => ctx.qualifications.indexOf(q)).join(', ')
            }]` : ''
        })`

export const stringifyDeclaration: (d: ConceptDeclaration) => string
    = ({ verb, concept }) =>
        `Declaration(${verb}, ${concept.name}`

export const stringifyGroup: (g: ConceptGroup) => string
    = ({ type, concepts }) =>
        `Group(${type}, ${concepts.map(c => c.name).join(', ')}`

export const stringifyQualification: (q: ConceptQualification) => string
    = ({ negated, matcher: { concept, group }, declared, resolved }) =>
        `Qualification(${negated}, ${concept ? concept.name : stringifyGroup(group!)}, ${declared.map(stringifyDeclaration)}, ${resolved ? stringifyRelations(resolved) : ''})`

export const stringifyContext: (ctx: ConceptContext) => any
    = ctx => ({
        concepts: Array.from(ctx.concepts.values()).map(c => stringifyConcept(ctx, c, true, true)),
        qualifications: ctx.qualifications.map((q, i) => [i, stringifyQualification(q)]),
    })
