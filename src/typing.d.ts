/**
  * This file is generated with meta-chevrotain
  */
import { CstNode, IToken } from 'chevrotain'

interface OrderPrefixNode extends CstNode {
    readonly children: {
        Cascading?: IToken[]
        Reverse?: IToken[]
    }
}

interface VerbPrefixNode extends CstNode {
    readonly children: {
        Is?: IToken[]
        Isnt?: IToken[]
        Canbe?: IToken[]
    }
}

interface NameListPrefixNode extends CstNode {
    readonly children: {
        And?: IToken[]
        Or?: IToken[]
        Oneof?: IToken[]
    }
}

interface NameListNode extends CstNode {
    readonly children: {
        Name?: IToken[]
        Comma?: IToken[]
        NameListPrefix?: NameListPrefixNode[]
    }
}

interface EscapedPrefixNode extends CstNode {
    readonly children: {
        Not?: IToken[]
        Escape?: IToken[]
        PrefixToken?: IToken[]
        OrderPrefix?: OrderPrefixNode[]
        VerbPrefix?: VerbPrefixNode[]
        NameListPrefix?: NameListPrefixNode[]
    }
}

interface EscapedModeNode extends CstNode {
    readonly children: {
        Isnt?: IToken[]
        Canbe?: IToken[]
        Escape?: IToken[]
        ModeToken?: IToken[]
    }
}

interface EscapedLineNode extends CstNode {
    readonly children: {
        EscapedPrefix?: EscapedPrefixNode[]
        EscapedMode?: EscapedModeNode[]
    }
}

interface SublinesNode extends CstNode {
    readonly children: {
        LCurly?: IToken[]
        Semicolon?: IToken[]
        RCurly?: IToken[]
        NormalLine?: NormalLineNode[]
    }
}

interface NormalLineNode extends CstNode {
    readonly children: {
        Not?: IToken[]
        Name?: IToken[]
        OrderPrefix?: OrderPrefixNode[]
        VerbPrefix?: VerbPrefixNode[]
        NameList?: NameListNode[]
        Sublines?: SublinesNode[]
    }
}

interface LineNode extends CstNode {
    readonly children: {
        EscapedLine?: EscapedLineNode[]
        NormalLine?: NormalLineNode[]
    }
}

interface RootLinesNode extends CstNode {
    readonly children: {
        Semicolon?: IToken[]
        Line?: LineNode[]
    }
}

interface RootNode extends CstNode {
    readonly children: {
        EscapedMode?: EscapedModeNode[]
        RootLines?: RootLinesNode[]
    }
}