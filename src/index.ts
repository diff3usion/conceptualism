import { readFileSync, writeFileSync } from 'fs';
import { inspect } from 'util';
import { verifyRelationsInContext } from './deducer';
import { analyzeCst, parse } from './dsl'
import { initRelations, stringifyContext, stringifyQualification, stringifyRelations } from './data';

export const dslTest = () => {
    const input = readFileSync('./examples/map.txt', 'utf-8')
    const parsed = parse(input)
    // console.log(JSON.stringify(parsed))
    if (parsed.lexErrors.length) console.error(parsed.lexErrors)
    if (parsed.parseErrors.length) console.error(parsed.parseErrors)
    const ctx = analyzeCst(parsed.cst)
    writeFileSync('./out.txt', inspect(stringifyContext(ctx), {showHidden: false, depth: null}))

    const rel = initRelations()
    rel.is.add(ctx.concepts.get("map_item")!)
    rel.is.add(ctx.concepts.get("path")!)
    rel.is.add(ctx.concepts.get("lake")!)
    const qualified = verifyRelationsInContext(rel, ctx)
    console.log(qualified.qualified.map(q => stringifyQualification(q)))
    console.log(stringifyRelations(qualified.resolved))
    console.log(qualified.incompatible)
    Array.from(ctx.concepts.keys()).filter(n => n[0] === '_').forEach(n => ctx.concepts.delete(n))
}

dslTest()
