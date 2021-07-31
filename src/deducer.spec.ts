import { equal, notEqual, ok } from "assert";
import { Concept, ConceptRelations, initRelations, QualifyingResult, qualifyRelations } from "./deducer";
import { analyzeCst, ConceptContext, parse } from "./dsl";

const map_example = `
?@Mode
>+@Prefix

_map_label {
    ^site, path, area
}
_non_map_label {
    ~|site, path, area
}
_origin {
    ^natural, artificial
}
_non_origin {
    ~|natural, artificial
}
_info_type {
    ^geographic, structural
}
_non_info_type {
    ~|geographic, structural
}

-map_item {
    ~|_map_label, _non_map_label
    ~|_origin, _non_origin
    ~|_info_type, _non_info_type
}

artificial {
    decorative
    functional
    area {
        building_group {
            settlement
            neighborhood
            village
            town
            city
            country
        }
    }
    structural {
        building {
            housing
            functional {
                machine
                factory
                transportation
            }
            decorative {
                painting
                statue
            }
        }
    }
}
geographic {
    biome_related {
        plain
    }
    canyan
    peninsula
    creek
    river
    -path {
        island
        floating_island
        pond
    }
    area {
        lake
        sea
        ocean
        continent
    }
}
`


describe("map example", () => {
    let ctx: ConceptContext
    let concept: (name: string) => Concept
    let relationsWith: (...names: string[]) => ConceptRelations
    let assertIncompatible: (res: QualifyingResult) => void
    let assertNoIncompatible: (res: QualifyingResult) => void
    let assertIsConcepts: (res: QualifyingResult, ...names: string[]) => void
    let assertIsntConcepts: (res: QualifyingResult, ...names: string[]) => void
    let assertNoIsnt: (res: QualifyingResult) => void
    before(() => {
        const parsed = parse(map_example)
        equal(parsed.lexErrors.length, 0)
        equal(parsed.parseErrors.length, 0)
        ctx = analyzeCst(parsed.cst)
        concept = name => ctx.concepts.get(name)!
        relationsWith = (...names) => {
            const res = initRelations()
            names.forEach(n => res.is.add(concept(n)))
            return res
        }
        assertIncompatible = res =>
            notEqual(res.incompatible.length, 0)
        assertNoIncompatible = res =>
            equal(res.incompatible.length, 0)
        assertIsConcepts = (res, ...names) =>
            names.forEach(n => ok(res.resolved.is.has(concept(n))))
        assertIsntConcepts = (res, ...names) =>
            names.forEach(n => ok(res.resolved.isnt.has(concept(n))))
        assertNoIsnt = res =>
            equal(res.resolved.isnt.size, 0)
    })
    it("lake is area and geographic", () => {
        const rel = relationsWith("map_item", "lake")
        const res = qualifyRelations(rel, ctx.qualifications)
        assertNoIncompatible(res)
        assertIsConcepts(res, "geographic", "area")
    })

    it("statue is decorative and structural and artificial", () => {
        const rel = relationsWith("map_item", "statue")
        const res = qualifyRelations(rel, ctx.qualifications)
        assertNoIncompatible(res)
        assertIsConcepts(res, "decorative", "structural", "artificial")
    })

    it("site and path is not map_item", () => {
        const rel = relationsWith("site", "path")
        const res = qualifyRelations(rel, ctx.qualifications)
        assertNoIncompatible(res)
        assertIsntConcepts(res, "map_item")
    })

    it("map_item and path and island is incompatible", () => {
        const rel = relationsWith("map_item", "path", "island")
        const res = qualifyRelations(rel, ctx.qualifications)
        assertIncompatible(res)
    })
})

