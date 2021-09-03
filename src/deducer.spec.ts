import { equal, notEqual, ok } from "assert";
import { ContextVerifyingResult, verifyRelationsInContext } from "./deducer";
import { analyzeCst, parse } from "./dsl";
import { Concept, ConceptContext, ConceptQualification, ConceptRelations, initRelations } from "./data";
import { readFileSync } from "fs";
import { subtract } from "./utils";
import { ConceptAdvisor } from "./advisor";

describe("map example", () => {
    const map_example = readFileSync('./examples/map.txt', 'utf-8')
    let ctx: ConceptContext
    let helperConcepts: Concept[]
    let helperQualifications: ConceptQualification[]
    let concept: (name: string) => Concept
    let relationsWith: (...names: string[]) => ConceptRelations
    let assertIncompatible: (res: ContextVerifyingResult) => void
    let assertCompatible: (res: ContextVerifyingResult) => void
    let assertIsConcepts: (res: ContextVerifyingResult, ...names: string[]) => void
    let assertIsntConcepts: (res: ContextVerifyingResult, ...names: string[]) => void
    let assertNoIsnt: (res: ContextVerifyingResult) => void
    before(() => {
        console.time('\tsetup time')
        const parsed = parse(map_example)
        equal(parsed.lexErrors.length, 0)
        equal(parsed.parseErrors.length, 0)
        ctx = analyzeCst(parsed.cst)
        helperConcepts = Array.from(ctx.concepts.values()).filter(c => c.name.startsWith('_'))
        helperQualifications = ctx.qualifications.filter(q =>
            Array(...q.resolved.is, ...q.resolved.isnt, ...q.resolved.canbe)
                .every(c => helperConcepts.includes(c)))
        concept = name => ctx.concepts.get(name)!
        relationsWith = (...names) => {
            const res = initRelations()
            names.forEach(n => res.is.add(concept(n)))
            return res
        }
        assertIncompatible = res =>
            notEqual(res.incompatible.length, 0)
        assertCompatible = res =>
            equal(res.incompatible.length, 0)
        assertIsConcepts = (res, ...names) =>
            names.forEach(n => ok(res.resolved.is.has(concept(n))))
        assertIsntConcepts = (res, ...names) =>
            names.forEach(n => ok(res.resolved.isnt.has(concept(n))))
        assertNoIsnt = res =>
            equal(res.resolved.isnt.size, 0)
        console.timeEnd('\tsetup time')
    })
    beforeEach(() => {
        console.time('\tcase time')
    })
    afterEach(() => {
        console.timeEnd('\tcase time')
    })
    it("ocean is area and geographic", () => {
        const rel = relationsWith("map_item", "ocean")
        const res = verifyRelationsInContext(rel, ctx)
        assertCompatible(res)
        assertIsConcepts(res, "geographic", "area")
    })

    it("statue is decorative and structural and artificial", () => {
        const rel = relationsWith("map_item", "statue")
        const res = verifyRelationsInContext(rel, ctx)
        assertCompatible(res)
        assertIsConcepts(res, "decorative", "structural", "artificial")
    })

    it("site and path is not map_item", () => {
        const rel = relationsWith("site", "path")
        const res = verifyRelationsInContext(rel, ctx)
        assertCompatible(res)
        assertIsntConcepts(res, "map_item")
    })

    it("map_item and path and island is incompatible", () => {
        const rel = relationsWith("map_item", "path", "island")
        const res = verifyRelationsInContext(rel, ctx)
        assertIncompatible(res)
    })

    it("map_item and housing and sea is incompatible", () => {
        const rel = relationsWith("map_item", "housing", "sea")
        const res = verifyRelationsInContext(rel, ctx)
        assertIncompatible(res)
    })

    it("transportation is functional building", () => {
        const rel = relationsWith("map_item", "transportation")
        const res = verifyRelationsInContext(rel, ctx)
        assertCompatible(res)
        assertIsConcepts(res, "transportation", "functional", "building")
    })

    it("map_item should suggest site", () => {
        const rel = relationsWith("map_item")
        const res = verifyRelationsInContext(rel, ctx)
        assertCompatible(res)
        const advisor = new ConceptAdvisor(rel, ctx, helperQualifications, helperConcepts, helperQualifications)
        ok(advisor.furtherConcepts.map(c => c.name).includes("site"))
        console.log(Array.from(res.resolved.is).map(c => c.name))
        console.log(advisor.furtherConcepts.map(c => c.name))
        console.log(advisor.furtherQualifications.map(([_, r]) => [...subtract(r.is, rel.is)].map(c => c.name).join('; ')))
    })
})
