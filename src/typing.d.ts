/**
  * This file is generated with meta-chevrotain
  */
 import { IToken } from 'chevrotain'

 interface OrderPrefixNode {
     name: string
     children: {
         Cascading?: IToken[]
         Reverse?: IToken[]
     }
     index?: number
 }
 
 interface VerbPrefixNode {
     name: string
     children: {
         Is?: IToken[]
         Isnt?: IToken[]
         Canbe?: IToken[]
     }
     index?: number
 }
 
 interface NameListPrefixNode {
     name: string
     children: {
         And?: IToken[]
         Or?: IToken[]
         Oneof?: IToken[]
     }
     index?: number
 }
 
 interface NameListNode {
     name: string
     children: {
         Name?: IToken[]
         Comma?: IToken[]
         NameListPrefix?: NameListPrefixNode[]
     }
     index?: number
 }
 
 interface SublinesNode {
     name: string
     children: {
         LCurly?: IToken[]
         Semicolon?: IToken[]
         RCurly?: IToken[]
         NormalLine?: NormalLineNode[]
     }
     index?: number
 }
 
 interface NormalLineNode {
     name: string
     children: {
         Not?: IToken[]
         Name?: IToken[]
         OrderPrefix?: OrderPrefixNode[]
         VerbPrefix?: VerbPrefixNode[]
         NameList?: NameListNode[]
         Sublines?: SublinesNode[]
     }
     index?: number
 }
 
 interface EscapedPrefixNode {
     name: string
     children: {
         Not?: IToken[]
         Escape?: IToken[]
         PrefixToken?: IToken[]
         OrderPrefix?: OrderPrefixNode[]
         VerbPrefix?: VerbPrefixNode[]
         NameListPrefix?: NameListPrefixNode[]
     }
     index?: number
 }
 
 interface EscapedModeNode {
     name: string
     children: {
         Isnt?: IToken[]
         Canbe?: IToken[]
         Escape?: IToken[]
         ModeToken?: IToken[]
     }
     index?: number
 }
 
 interface EscapedLineNode {
     name: string
     children: {
         EscapedPrefix?: EscapedPrefixNode[]
         EscapedMode?: EscapedModeNode[]
     }
     index?: number
 }
 
 interface LineNode {
     name: string
     children: {
         EscapedLine?: EscapedLineNode[]
         NormalLine?: NormalLineNode[]
     }
     index?: number
 }
 
 interface LinesNode {
     name: string
     children: {
         Semicolon?: IToken[]
         Line?: LineNode[]
     }
     index?: number
 }
 
 interface RootNode {
     name: string
     children: {
         EscapedMode?: EscapedModeNode[]
         Lines?: LinesNode[]
     }
     index?: number
 }