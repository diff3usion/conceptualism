[![npm](https://img.shields.io/npm/v/@diff3usion/conceptualism.svg )](https://www.npmjs.com/package/@diff3usion/conceptualism)
# Conceptualism
A DSL for describing and deducing relationships between concept terms.

This project is based on the [Chevrotain](https://github.com/Chevrotain/chevrotain) parser building toolkit, and [meta-chevrotain](https://github.com/diff3usion/meta-chevrotain) which is a DSL for generating chevrotain parser
## Introduction
[Rail Diagram](https://diff3usion.github.io/corconceptualismrelation/)

This DSL can be used to describe a context of related concept terms, usually names of sets, categories, or tags. 

Then, it can deduce whether a object in such context is valid, and if it's valid, its implied relations of all concepts in the context. 

### Example (Objects on a map)
- **Map Item**
    -  Anything on a map is a **Map Item**
- **Structural** and **Geographic**
    - A **Map Item** is either 
        - **Structural**, meaning it's a concept related to some structure: house, road, sign, etc., or
        - **Geographic**, meaning it's a geographical concept: island, lake, continent, etc. 
- **Building**
    - All **Building**s are **Structural**
- **House**
    - All **House**s are **Building**
- **Transportation**
    - All **Transportation** are **Structural**
- **Road**
    - All **Road**s are **Transportation**
- **Lake**, **River**, and **Ocean**
    - All **Lake**s, **River**s, and **Ocean** are **Geographic**
- **Water**
    - All **Lake**s, **River**s, and **Ocean** are **Water**

The above relations can be described as the following code

### Syntax
```
?@Mode
>- map_item {
    ~^ geographic, structural
}
>+ structural {
    >+ building {
        house
    }

    >+ transportation {
        road
    }
}
>+ geographic {
    >+ water {
        lake
        river
        ocean
    }
}
```
The syntax has a directed-graph-like structure, where the nodes are the concept terms, and their position in the structure denotes their relation.

The direction of the graph edge is determined by the ">" and "<" *order prefixes*. For example,
``` 
>+ building {
    house
}
 ```
defines an edge from **Building** to **House**. If the ">" symbol is replaced with "<", the edge direction would be reversed. 

### Declaration and Qualification

The nodes that has a outgoing edge are called *Declarations*, which means they declare certain relations for the nodes they points to. 

The nodes that has no outgoing edge are called *Qualifications*, which means they defines some conditions, such that once a object qualifies those conditions, the object are thus subject to the bounds of all declarations declared upon the qualification.

The two key relations between concepts terms are "is" and "isnt", which are denoted with the "+" and "-" *verb prefixes* in declarations.

Back to the previous example, in
``` 
>+ building {
    house
}
 ```
there is one declaration and one qualification. 

The declaration ">+ building" declares whatever it points to must be "is building".

The qualification "+ house" qualifies whatever object that satisfies "is house".

Therefore, this example as a whole means "All houses are building"

### Qualification with list of terms

Unlike declarations which can only have one term, qualifications can have a list of term along with a *list prefix* denoting the how the list is interpreted. 

There are three logical prefixes, "&" for *And*, *|* for *Or*, and *^* for *Oneof*. For example, if one wants to say "anything that is both **Building** and **Deserted** are  **ToBeImproved**", the following can work
```
>+ to_be_improved {
    &+ building, deserted
}
```

There is also another prefix for qualifications, the *negation prefix* "~", which reverse-selects what the qualification originally matches. For example, 
```
>- map_item {
    ~^ geographic, structural
}
```
says "anything that is not one of geographic and structural is not a map item"

## To be continued...

Just noticed the existance of [RDF, RDFS, and OWL](https://zhuanlan.zhihu.com/p/32122644), which fulfills the intention of this project. 

Development is suspended, and project is archived. 
