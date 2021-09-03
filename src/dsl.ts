import { CstNode, ILexingError, IRecognitionException, IToken } from "chevrotain"
import { isQualificationSelfConsistent, verifyRelationsInContext } from "./deducer"
import { lexer, tokens } from "./lexer"
import { CorrelationParser } from "./parser"
import { ConceptOrder, ConceptVerb, ConceptGroupType, ConceptDefaultMode, ConceptDeclaration, ConceptQualification, Concept, initConcept, initQualification, appendQualificationDeclarations, ConceptRelations, ConceptGroup, ConceptContext, stringifyConcept, stringifyQualification } from "./data"
import { EscapedModeNode, EscapedPrefixNode, EscapedLineNode, OrderPrefixNode, VerbPrefixNode, NameListPrefixNode, NormalLineNode, LinesNode, RootNode, SublinesNode, NameListNode } from "./typing"
import { mapPushOrInit, appendMap, mapGetOrInit, assert } from "./utils"

type Prefixes = {
    order?: ConceptOrder,
    verb?: ConceptVerb,
    negated?: boolean,
    groupType?: ConceptGroupType,
}

type NodeProps = {
    mode: ConceptDefaultMode
} & Prefixes

enum CstNodeType {
    Declaration,
    Qualification,
}

type FormattedCstNode = {
    type: CstNodeType,
    props: NodeProps
    name?: string
    list?: string[]
}

type CstNodeGraph = Map<FormattedCstNode, FormattedCstNode[]>

type ConceptStatement = {
    declaration?: ConceptDeclaration
    qualification?: ConceptQualification
}
type StatementGraph = Map<ConceptDeclaration, ConceptStatement[]>

//#region Apply escaped line
const applyEscapedMode: (node: EscapedModeNode, target: NodeProps) => void
    = ({ children: { Canbe, Isnt } }, target) => {
        if (Canbe) {
            assert(Canbe[0])
            target.mode = ConceptDefaultMode.CanbeAnything
        } else {
            assert(Isnt && Isnt[0])
            target.mode = ConceptDefaultMode.IsNothing
        }
    }
const applyEscapedPrefix: (node: EscapedPrefixNode, target: NodeProps) => void
    = ({ children: { OrderPrefix, VerbPrefix, Not, NameListPrefix } }, target) => {
        target.order = getOrder(target, OrderPrefix)
        target.verb = getVerb(target, VerbPrefix)
        target.negated = Not !== undefined
        target.groupType = getGroupType(target, NameListPrefix)
    }
const applyEscapedLine: (node: EscapedLineNode, target: NodeProps) => void
    = ({ children: { EscapedMode, EscapedPrefix } }, target) => {
        if (EscapedMode) {
            assert(EscapedMode[0])
            applyEscapedMode(EscapedMode[0], target)
        } else {
            assert(EscapedPrefix && EscapedPrefix[0])
            applyEscapedPrefix(EscapedPrefix[0], target)
        }
    }
//#endregion

//#region Get line parts
const getOrder: (defaults: NodeProps, nodes?: OrderPrefixNode[]) => ConceptOrder | undefined
    = (defaults, nodes) => {
        if (nodes) {
            assert(nodes[0])
            const { Cascading, Reverse } = nodes[0].children
            if (Cascading) return ConceptOrder.Cascading
            if (Reverse) return ConceptOrder.Reverse
        }
        return defaults.order
    }
const getVerb: (defaults: NodeProps, nodes?: VerbPrefixNode[]) => ConceptVerb | undefined
    = (defaults, nodes) => {
        if (nodes) {
            assert(nodes[0])
            const { Is, Isnt, Canbe } = nodes[0].children
            if (Is) return ConceptVerb.Is
            if (Isnt) return ConceptVerb.Isnt
            if (Canbe) return ConceptVerb.Canbe
        }
        return defaults.verb
    }
const getNegated: (defaults: NodeProps, not?: IToken[]) => boolean | undefined
    = (defaults, not) => {
        if (not !== undefined) return true
        return defaults.negated
    }
const getGroupType: (defaults: NodeProps, nodes?: NameListPrefixNode[]) => ConceptGroupType | undefined
    = (defaults, nodes) => {
        if (nodes) {
            assert(nodes[0])
            const { Or, And, Oneof } = nodes[0].children
            if (Or) return ConceptGroupType.Or
            if (And) return ConceptGroupType.And
            if (Oneof) return ConceptGroupType.Oneof
        }
        return defaults.groupType
    }
const getNodeType: (order?: ConceptOrder, sublines?: SublinesNode[]) => CstNodeType
    = (order, sublines) =>
        (order === ConceptOrder.Cascading && !sublines || order === ConceptOrder.Reverse && sublines) ?
            CstNodeType.Qualification :
            CstNodeType.Declaration
const getName: (name?: IToken[]) => string | undefined
    = name => {
        if (name) {
            assert(name[0])
            return name[0].image
        }
    }
const getNameList: (name?: IToken[]) => string[] | undefined
    = name => name?.map(token => token.image)
//#endregion

const lineToCstNode: (node: NormalLineNode, defaults: NodeProps) => FormattedCstNode
    = ({ children: { OrderPrefix, VerbPrefix, Not, Name, NameList, Sublines } }, defaults) => {
        const mode = defaults.mode
        const order = getOrder(defaults, OrderPrefix)
        const verb = getVerb(defaults, VerbPrefix)
        const negated = getNegated(defaults, Not)
        const type = getNodeType(order, Sublines)
        const name = getName(Name)
        let list: string[] | undefined, groupType: ConceptGroupType | undefined
        if (NameList) {
            if (type === CstNodeType.Declaration)
                throw new Error("Cannot have list as declaration node")
            assert(NameList[0])
            const { Name, NameListPrefix } = NameList[0].children
            list = getNameList(Name)
            groupType = getGroupType(defaults, NameListPrefix)
        }
        return { type, props: { mode, order, verb, negated, groupType }, name, list }
    }

const buildNodeGraph: (node: NormalLineNode, defaults: NodeProps, built?: FormattedCstNode) => CstNodeGraph
    = (node, defaults, built) => {
        const { Sublines } = node.children
        const res: CstNodeGraph = new Map()
        const CstNode = built ? built : lineToCstNode(node, defaults)
        if (Sublines) {
            assert(Sublines[0])
            Sublines[0].children.NormalLine?.forEach(subline => {
                const subCstNode = lineToCstNode(subline, defaults)
                if (CstNode.props.order === ConceptOrder.Cascading) mapPushOrInit(res, CstNode, subCstNode)
                else mapPushOrInit(res, subCstNode, CstNode)
                appendMap(res, buildNodeGraph(subline, defaults, subCstNode))
            })
        }
        return res
    }

const buildCompleteNodeGraph: (node: LinesNode, defaults: NodeProps) => CstNodeGraph
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

const conceptualizeNode: (fcn: FormattedCstNode, doneConcepts: Map<string, Concept>) => ConceptStatement
    = (fcn, doneConcepts) => {
        let declaration: ConceptDeclaration | undefined, qualification: ConceptQualification | undefined
        const conceptGetOrInit = (name: string, mode: ConceptDefaultMode) =>
            mapGetOrInit(doneConcepts, name, () => initConcept(name, mode))
        if (fcn.type === CstNodeType.Declaration) {
            assert(fcn.name && fcn.props.verb)
            const verb = fcn.props.verb
            const concept = conceptGetOrInit(fcn.name, fcn.props.mode)
            declaration = { verb, concept }
        } else {
            assert(fcn.props.negated)
            qualification = initQualification()
            qualification.negated = fcn.props.negated
            if (fcn.name) {
                qualification.matcher.concept = conceptGetOrInit(fcn.name, fcn.props.mode)
            } else {
                assert(fcn.list && fcn.props.groupType)
                const type = fcn.props.groupType
                const concepts = fcn.list.map(n => conceptGetOrInit(n, fcn.props.mode))
                qualification.matcher.group = { type, concepts }
            }
        }
        return declaration ? { declaration } : { qualification }
    }

const passDownDeclaration: (graph: StatementGraph) => ConceptQualification[]
    = graph => {
        const res: ConceptQualification[] = []
        const rootDeclarations = new Set<ConceptDeclaration>(graph.keys())
        Array.from(graph.values()).forEach(v =>
            v.filter(s => s.declaration).forEach(s => rootDeclarations.delete(s.declaration!)))
        const visitDeclaration = (d: ConceptDeclaration, stack: ConceptDeclaration[]) => {
            graph.get(d)?.forEach(({ declaration, qualification }) => {
                if (declaration) {
                    visitDeclaration(declaration, [...stack, declaration])
                } else {
                    assert(qualification)
                    appendQualificationDeclarations(qualification, stack)
                    res.push(qualification)
                }
            })
        }
        rootDeclarations.forEach(d => visitDeclaration(d, [d]))
        if (res.some(q => !isQualificationSelfConsistent(q).result))
            throw new Error('Inconsistent qualification found')
        return res
    }

const buildContext: (graph: CstNodeGraph) => ConceptContext
    = graph => {
        const conceptGraph: StatementGraph = new Map()
        const concepts = new Map<string, Concept>()
        const statements = new Map<FormattedCstNode, ConceptStatement>()
        const statementGetOrInit = (node: FormattedCstNode) =>
            mapGetOrInit(statements, node, () => conceptualizeNode(node, concepts))
        Array.from(graph.entries()).forEach(([k, arr]) =>
            conceptGraph.set(statementGetOrInit(k).declaration!, arr.map(statementGetOrInit)))

        const qualifications = passDownDeclaration(conceptGraph)
        return { concepts, qualifications }
    }

const verifyContext: (context: ConceptContext) => void
    = context => {
        Array.from(context.concepts.values())
            .forEach(c => {
                const { resolved, qualified, incompatible } = verifyRelationsInContext(c.resolved, context)
                c.resolved = resolved
                c.qualified = qualified
                if (incompatible.length) {
                    console.log("Warning: Exited with incompatible",
                        incompatible.map(([q, r]) =>
                            [stringifyConcept(context, c, true, true), stringifyQualification(q)]))
                }
            })
    }

export const analyzeCst: (root: RootNode) => ConceptContext
    = ({ children: { EscapedMode, Lines } }) => {
        if (!EscapedMode || !Lines) return { concepts: new Map(), qualifications: [] }
        const defaults: NodeProps = {
            mode: ConceptDefaultMode.CanbeAnything,
        }
        assert(EscapedMode[0] && Lines[0])
        applyEscapedMode(EscapedMode[0], defaults)
        const nodeGraph = buildCompleteNodeGraph(Lines[0], defaults)
        const context = buildContext(nodeGraph)
        verifyContext(context)
        return context
    }

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
