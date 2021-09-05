/**
 * This file is generated with meta-chevrotain
 */

import {
    CstParser,
    TokenType
} from "chevrotain";
import {
    And,
    Canbe,
    Cascading,
    Comma,
    Escape,
    Is,
    Isnt,
    LCurly,
    ModeToken,
    Name,
    Not,
    Oneof,
    Or,
    PrefixToken,
    RCurly,
    Reverse,
    Semicolon
} from './lexer'
export class CorrelationParser extends CstParser {
    constructor(tokens: TokenType[]) {
        super(tokens, {
            recoveryEnabled: true
        })
        this.performSelfAnalysis();
    }
    private OrderPrefix = this.RULE("OrderPrefix", () => {
        this.or(0, [{
            ALT: () => this.consume(0, Cascading)
        }, {
            ALT: () => this.consume(1, Reverse)
        }, ]);
    });
    private VerbPrefix = this.RULE("VerbPrefix", () => {
        this.or(0, [{
            ALT: () => this.consume(0, Is)
        }, {
            ALT: () => this.consume(1, Isnt)
        }, {
            ALT: () => this.consume(2, Canbe)
        }, ]);
    });
    private NameListPrefix = this.RULE("NameListPrefix", () => {
        this.option(0, () => this.or(0, [{
            ALT: () => this.consume(0, And)
        }, {
            ALT: () => this.consume(1, Or)
        }, {
            ALT: () => this.consume(2, Oneof)
        }, ]));
    });
    private NameList = this.RULE("NameList", () => {
        this.subrule(0, this.NameListPrefix);
        this.consume(0, Name);
        this.AT_LEAST_ONE({
            DEF: () => {
                this.consume(1, Comma);
                this.consume(2, Name);
            }
        });
    });
    private EscapedPrefix = this.RULE("EscapedPrefix", () => {
        this.option(0, () => this.subrule(0, this.OrderPrefix));
        this.option(1, () => this.subrule(1, this.VerbPrefix));
        this.option(2, () => this.consume(2, Not));
        this.option(3, () => this.subrule(2, this.NameListPrefix));
        this.consume(0, Escape);
        this.consume(1, PrefixToken);
    });
    private EscapedMode = this.RULE("EscapedMode", () => {
        this.or(0, [{
            ALT: () => this.consume(2, Isnt)
        }, {
            ALT: () => this.consume(3, Canbe)
        }, ]);
        this.consume(0, Escape);
        this.consume(1, ModeToken);
    });
    private EscapedLine = this.RULE("EscapedLine", () => {
        this.or(0, [{
            ALT: () => this.subrule(0, this.EscapedPrefix)
        }, {
            ALT: () => this.subrule(1, this.EscapedMode)
        }, ]);
    });
    private Sublines = this.RULE("Sublines", () => {
        this.consume(0, LCurly);
        this.MANY({
            DEF: () => {
                this.option(0, () => this.subrule(0, this.NormalLine));
                this.option(1, () => this.consume(2, Semicolon));
            }
        });
        this.consume(1, RCurly);
    });
    private NormalLine = this.RULE("NormalLine", () => {
        this.option(0, () => this.subrule(0, this.OrderPrefix));
        this.option(1, () => this.subrule(1, this.VerbPrefix));
        this.option(2, () => this.consume(0, Not));
        this.or(0, [{
            ALT: () => this.subrule(2, this.NameList),
            GATE: this.BACKTRACK(this.NameList)
        }, {
            ALT: () => this.consume(1, Name)
        }, ]);
        this.option(3, () => this.subrule(3, this.Sublines));
    });
    private Line = this.RULE("Line", () => {
        this.or(0, [{
            ALT: () => this.subrule(0, this.EscapedLine),
            GATE: this.BACKTRACK(this.EscapedLine)
        }, {
            ALT: () => this.subrule(1, this.NormalLine)
        }, ]);
    });
    private RootLines = this.RULE("RootLines", () => {
        this.MANY({
            DEF: () => {
                this.option(0, () => this.subrule(0, this.Line));
                this.option(1, () => this.consume(0, Semicolon));
            }
        });
    });
    public Root = this.RULE("Root", () => {
        this.subrule(0, this.EscapedMode);
        this.subrule(1, this.RootLines);
    });
}