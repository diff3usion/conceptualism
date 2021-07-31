import { createToken, Lexer } from "chevrotain"

export const Is            = createToken({ name: "Is",         pattern: /\+/ })
export const Isnt          = createToken({ name: "Isnt",       pattern: /\-/ })
export const Canbe         = createToken({ name: "Canbe",      pattern: /\?/ })
export const Cascading     = createToken({ name: "Cascading",  pattern: />/ })
export const Reverse       = createToken({ name: "Reverse",    pattern: /</ })
export const And           = createToken({ name: "And",        pattern: /\&/ })
export const Or            = createToken({ name: "Or",         pattern: /\|/ })
export const Not           = createToken({ name: "Not",        pattern: /\~/ })
export const Oneof         = createToken({ name: "Oneof",      pattern: /\^/ })
export const Escape        = createToken({ name: "Escape",     pattern: /@/ })
export const ModeToken     = createToken({ name: "Mode",       pattern: /Mode/ })
export const PrefixToken   = createToken({ name: "Prefix",     pattern: /Prefix/ })
export const Name          = createToken({ name: "Name",       pattern: /\w+/ })
export const Comma         = createToken({ name: "Comma",      pattern: /,/ });
export const LCurly        = createToken({ name: "LCurly",     pattern: /{/ });
export const RCurly        = createToken({ name: "RCurly",     pattern: /}/ });
export const Semicolon     = createToken({ name: "Semicolon",  pattern: /;/ });
export const WhiteSpace    = createToken({ name: "WhiteSpace", pattern: /\s+/, group: Lexer.SKIPPED });

export const tokens = [
    Is         ,
    Isnt       ,
    Canbe      ,
    Cascading  ,
    Reverse    ,
    And        ,
    Or         ,
    Not        ,
    Oneof      ,
    Escape     ,
    ModeToken  ,
    PrefixToken,
    Name       ,
    Comma      ,
    LCurly     ,
    RCurly     ,
    Semicolon  ,
    WhiteSpace ,
]

export const lexer = new Lexer(tokens, {
    positionTracking: "onlyStart"
});
