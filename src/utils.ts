export function assert(value: unknown, msg?: string): asserts value {
    if (value === undefined)
        throw new Error('Parsed CST has invalid format' + msg ? `: ${msg}` : '');
}

export const unionTwoSets
    = <T>(a: Set<T>, b: Set<T>) =>
        new Set(Array(...a, ...b))

export const union
    = <T>(...sets: Set<T>[]) =>
        sets.slice(1).reduce((res, set) => unionTwoSets(res, set), sets[0])

export const intersectTwoSets
    = <T>(a: Set<T>, b: Set<T>) =>
        Array(...a).reduce((res, v) => b.has(v) ? res.add(v) : res, new Set<T>())

export const intersect
    = <T>(...sets: Set<T>[]) =>
        sets.slice(1).reduce((res, set) => intersectTwoSets(res, set), sets[0])

export const subtractTwoSets
    = <T>(a: Set<T>, b: Set<T>) =>
        new Set(Array(...a).filter(v => !b.has(v)))

export const subtract
    = <T>(...sets: Set<T>[]) =>
        sets.slice(1).reduce((res, set) => subtractTwoSets(res, set), sets[0])


export function appendSet<T>(set0: Set<T>, array: Array<T>): Set<T>
export function appendSet<T>(set0: Set<T>, set1: Set<T>): Set<T>
export function appendSet<T>(set0: Set<T>, collection: any): Set<T> {
    return collection.forEach((v: T) => set0.add(v))
}

export const arrayFilterInSet = <T>(arr: T[], set: Set<T>) =>
    arr.filter(c => set.has(c))

export const arrayFilterNotInSet = <T>(arr: T[], set: Set<T>) =>
    arr.filter(c => !set.has(c))

export const doesArrayIntersectSet = <T>(arr: T[], set: Set<T>) =>
    arr.some(c => set.has(c))

export const arrayIntersectSetCount = <T>(arr: T[], set: Set<T>) =>
    arrayFilterInSet(arr, set).length

export const isArrayInSet = <T>(arr: T[], set: Set<T>) =>
    arr.every(c => set.has(c))

export const mapGetOrInit: <K, V>(map: Map<K, V>, key: K, val: () => V) => V
    = (map, key, val) =>
        map.has(key) ? map.get(key)! : map.set(key, val()).get(key)!

export const mapPushOrInit: <T, F>(map: Map<T, F[]>, key: T, value: F) => void
    = (map, key, value) =>
        map.has(key) ? map.get(key)!.push(value) : map.set(key, [value])

export const mapAddOrInit: <T, F>(map: Map<T, Set<F>>, key: T, value: F) => void
    = (map, key, value) =>
        map.has(key) ? map.get(key)!.add(value) : map.set(key, new Set([value]))

export const appendMap: <T, F>(map0: Map<T, F[]>, map1: Map<T, F[]>) => void
    = (map0, map1) =>
        Array.from(map1.entries()).forEach(([k, arr]) => arr.forEach(v => mapPushOrInit(map0, k, v)))
