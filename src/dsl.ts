import { CstNode, ILexingError, IRecognitionException } from "chevrotain"
import { ConceptOrder, ConceptVerb, ConceptGroupType, ConceptDefaultMode, Concept, ConceptRelations, ConceptDeclaration, ConceptGroup, ConceptQualification, resolveDeclarations, initRelations, qualifyRelations } from "./deducer"
import { lexer, tokens } from "./lexer"
import { CorrelationParser } from "./parser"
import { EscapedModeNode, EscapedPrefixNode, EscapedLineNode, OrderPrefixNode, VerbPrefixNode, NameListPrefixNode, NormalLineNode, LinesNode, RootNode } from "./typing"
import { mapPushOrInit, appendMap, mapGetOrInit, assert } from "./utils"

type Prefixes = {
    order?: ConceptOrder,
    verb?: ConceptVerb,
    negated?: boolean,
    groupType?: ConceptGroupType,
}

type NodeDefaults = {
    mode: ConceptDefaultMode
    prefixes: Prefixes,
}

enum CstNodeType {
    Declaration,
    Qualification,
}

type BuiltCstNode = {
    type: CstNodeType,
    mode: ConceptDefaultMode
    order?: ConceptOrder
    verb?: ConceptVerb
    negated?: boolean
    name?: string
    groupType?: ConceptGroupType
    list?: string[]
}

type CstNodeGraph = Map<BuiltCstNode, BuiltCstNode[]>

type ConceptStatement = {
    declaration?: ConceptDeclaration
    qualification?: ConceptQualification
}
type StatementGraph = Map<ConceptDeclaration, ConceptStatement[]>

export type ConceptContext = {
    concepts: Map<string, Concept>
    qualifications: ConceptQualification[]
}

const applyEscapedMode: (node: EscapedModeNode, defaults: NodeDefaults) => void
    = ({ children: { Canbe, Isnt } }, defaults) => {
        if (Canbe) {
            assert(Canbe[0])
            defaults.mode = ConceptDefaultMode.CanbeAnything
        } else {
            assert(Isnt && Isnt[0])
            defaults.mode = ConceptDefaultMode.IsNothing
        }
    }

const applyEscapedPrefix: (node: EscapedPrefixNode, defaults: NodeDefaults) => void
    = ({ children: { OrderPrefix, VerbPrefix, Not, NameListPrefix } }, { prefixes }) => {
        prefixes.order = getOrder(OrderPrefix)
        prefixes.verb = getVerb(VerbPrefix)
        prefixes.negated = Not !== undefined
        prefixes.groupType = getGroupType(NameListPrefix)
    }

const applyEscapedLine: (node: EscapedLineNode, defaults: NodeDefaults) => void
    = ({ children: { EscapedMode, EscapedPrefix } }, defaults) => {
        if (EscapedMode) {
            assert(EscapedMode[0])
            applyEscapedMode(EscapedMode[0], defaults)
        } else {
            assert(EscapedPrefix && EscapedPrefix[0])
            applyEscapedPrefix(EscapedPrefix[0], defaults)
        }
    }

const getOrder: (nodes?: OrderPrefixNode[]) => ConceptOrder | undefined
    = nodes => {
        if (nodes) {
            assert(nodes[0])
            const { Cascading, Reverse } = nodes[0].children
            if (Cascading) return ConceptOrder.Cascading
            if (Reverse) return ConceptOrder.Reverse
        }
    }
const getVerb: (nodes?: VerbPrefixNode[]) => ConceptVerb | undefined
    = nodes => {
        if (nodes) {
            assert(nodes[0])
            const { Is, Isnt, Canbe } = nodes[0].children
            if (Is) return ConceptVerb.Is
            if (Isnt) return ConceptVerb.Isnt
            if (Canbe) return ConceptVerb.Canbe
        }
    }
const getGroupType: (nodes?: NameListPrefixNode[]) => ConceptGroupType | undefined
    = nodes => {
        if (nodes) {
            assert(nodes[0])
            const { Or, And, Oneof } = nodes[0].children
            if (Or) return ConceptGroupType.Or
            if (And) return ConceptGroupType.And
            if (Oneof) return ConceptGroupType.Oneof
        }
    }

const lineToCstNode: (node: NormalLineNode, defaults: NodeDefaults) => BuiltCstNode
    = ({ children: { OrderPrefix, VerbPrefix, Not, Name, NameList, Sublines } }, defaults) => {
        const mode = defaults.mode
        let order = getOrder(OrderPrefix)
        if (!order) order = defaults.prefixes.order
        let verb = getVerb(VerbPrefix)
        if (!verb) verb = defaults.prefixes.verb
        let negated = Not !== undefined
        if (!Not && defaults.prefixes.negated !== undefined) negated = defaults.prefixes.negated
        let type = CstNodeType.Declaration
        if (order === ConceptOrder.Cascading && !Sublines || order === ConceptOrder.Reverse && Sublines)
            type = CstNodeType.Qualification
        let name
        if (Name) {
            assert(Name[0])
            name = Name[0].image
        }
        let list: string[] | undefined, groupType: ConceptGroupType | undefined
        if (NameList) {
            if (type === CstNodeType.Declaration)
                throw new Error("Cannot have list as declaration node")
            assert(NameList[0])
            list = NameList[0].children.Name?.map(token => token.image)
            groupType = getGroupType(NameList[0].children.NameListPrefix)
            if (!groupType) groupType = defaults.prefixes.groupType
        }
        return { type, mode, order, verb, negated, name, list, groupType }
    }

const buildNodeGraph: (node: NormalLineNode, defaults: NodeDefaults, built?: BuiltCstNode) => CstNodeGraph
    = (node, defaults, built) => {
        const { Sublines } = node.children
        const res: CstNodeGraph = new Map()
        const CstNode = built ? built : lineToCstNode(node, defaults)
        if (Sublines) {
            assert(Sublines[0])
            Sublines[0].children.NormalLine?.forEach(subline => {
                const subCstNode = lineToCstNode(subline, defaults)
                if (CstNode.order === ConceptOrder.Cascading) mapPushOrInit(res, CstNode, subCstNode)
                else mapPushOrInit(res, subCstNode, CstNode)
                appendMap(res, buildNodeGraph(subline, defaults, subCstNode))
            })
        }

        return res
    }

const buildCompleteNodeGraph: (node: LinesNode, defaults: NodeDefaults) => CstNodeGraph
    = (node, defaults) => {
        const Line = node.children.Line
        const res: CstNodeGraph = new Map()
        Line?.forEach(({ children: { EscapedLine, NormalLine } }) => {
            if (EscapedLine) {
                assert(EscapedLine[0])
                applyEscapedLine(EscapedLine[0], defaults)
            } else {
                assert(NormalLine && NormalLine[0])
                appendMap(res, buildNodeGraph(NormalLine[0], defaults))
            }
        })
        return res
    }

const conceptualizeNode: (cn: BuiltCstNode, doneConcepts: Map<string, Concept>) => ConceptStatement
    = (cn, doneConcepts) => {
        let declaration: ConceptDeclaration | undefined, qualification: ConceptQualification | undefined
        const initQualification = (negated: boolean) => ({
            negated,
            declared: [],
            resolved: initRelations(),
        })
        const initConcept = (name: string, mode: ConceptDefaultMode) => {
            const c: Concept = {
                name,
                defaultMode: mode,
                resolved: initRelations(),
                qualified: [],
            }
            c.resolved.is.add(c)
            return c
        }
        const conceptGetOrInit = (name: string, mode: ConceptDefaultMode) =>
            mapGetOrInit(doneConcepts, name, () => initConcept(name, mode))
        if (cn.type === CstNodeType.Declaration) {
            assert(cn.name && cn.verb)
            const verb = cn.verb
            const concept = conceptGetOrInit(cn.name, cn.mode)
            declaration = { verb, concept }
        } else {
            assert(cn.negated)
            const negated = cn.negated
            if (cn.name) {
                qualification = initQualification(negated)
                qualification.concept = conceptGetOrInit(cn.name, cn.mode)
            } else {
                assert(cn.list)
                assert(cn.groupType)
                const type = cn.groupType
                const concepts = cn.list.map(n => conceptGetOrInit(n, cn.mode))
                qualification = initQualification(negated)
                qualification.group = { type, concepts }
            }
        }
        if (declaration) return { declaration }
        return { qualification }
    }

const passDownDeclaration: (graph: StatementGraph) => Set<ConceptQualification>
    = graph => {
        const res = new Set<ConceptQualification>()
        const rootDeclarations = new Set<ConceptDeclaration>(graph.keys())
        Array.from(graph.values()).forEach(v =>
            v.filter(s => s.declaration).forEach(s => rootDeclarations.delete(s.declaration!)))
        const visitDeclaration = (d: ConceptDeclaration, stack: ConceptDeclaration[]) => {
            graph.get(d)?.forEach(({ declaration, qualification }) => {
                if (declaration) {
                    visitDeclaration(declaration, [...stack, declaration])
                } else {
                    assert(qualification)
                    qualification.declared = stack
                    res.add(qualification)
                }
            })
        }
        rootDeclarations.forEach(d => visitDeclaration(d, [d]))
        return res
    }

const buildContext: (graph: CstNodeGraph) => ConceptContext
    = graph => {
        const conceptGraph: StatementGraph = new Map()
        const concepts = new Map<string, Concept>()
        const statements = new Map<BuiltCstNode, ConceptStatement>()
        const statementGetOrInit = (node: BuiltCstNode) =>
            mapGetOrInit(statements, node, () => conceptualizeNode(node, concepts))
        Array.from(graph.entries()).forEach(([k, arr]) =>
            conceptGraph.set(statementGetOrInit(k).declaration!, arr.map(statementGetOrInit)))

        const qualifications = Array.from(passDownDeclaration(conceptGraph))
        qualifications.forEach(q => resolveDeclarations(q))
        return { concepts, qualifications }
    }

const qualifyContext: (context: ConceptContext) => void
    = context => {
        Array.from(context.concepts.values())
            .forEach(c => {
                const { resolved, qualified, incompatible } = qualifyRelations(c.resolved, context.qualifications)
                c.resolved = resolved
                c.qualified = qualified
                if (incompatible.length) {
                    console.log("Warning: Exited with incompatible ",
                        incompatible.map(([q, r]) =>
                            [stringifyConcept(context, c, true, true), stringifyQualification(q)]))
                }
            })
    }

export const analyzeCst: (root: RootNode) => ConceptContext
    = ({ children: { EscapedMode, Lines } }) => {
        if (!EscapedMode || !Lines) return { concepts: new Map(), qualifications: [] }
        const defaults: NodeDefaults = {
            mode: ConceptDefaultMode.CanbeAnything,
            prefixes: {},
        }
        assert(EscapedMode[0] && Lines[0])
        applyEscapedMode(EscapedMode[0], defaults)
        const nodeGraph = buildCompleteNodeGraph(Lines[0], defaults)
        const context = buildContext(nodeGraph)
        qualifyContext(context)
        return context
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
    = d => `Declaration(${d.verb}, ${d.concept.name}`

export const stringifyGroup: (g: ConceptGroup) => string
    = g => `Group(${g.type}, ${g.concepts.map(c => c.name).join(', ')}`

export const stringifyQualification: (q: ConceptQualification) => string
    = q => `Qualification(${q.negated}, ${q.concept ? q.concept.name : stringifyGroup(q.group!)}, ${q.declared.map(stringifyDeclaration)}, ${q.resolved ? stringifyRelations(q.resolved) : ''})`

export const stringifyContext: (ctx: ConceptContext) => any
    = ctx => ({
        concepts: Array.from(ctx.concepts.values()).map(c => stringifyConcept(ctx, c, true, true)),
        qualifications: ctx.qualifications.map((q, i) => [i, stringifyQualification(q)]),
    })

type ParseResult = {
    cst: CstNode,
    lexErrors: ILexingError[],
    parseErrors: IRecognitionException[]
}
export const parse: (text: string) => ParseResult
    = text => {
        const lexResult = lexer.tokenize(text)
        const parser = new CorrelationParser(tokens)
        parser.input = lexResult.tokens

        return {
            cst: parser.Root(),
            lexErrors: lexResult.errors,
            parseErrors: parser.errors,
        }
    }