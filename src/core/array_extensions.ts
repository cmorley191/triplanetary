import { Optional, nullopt, opt, optBind, optValueOr } from "./optional"

export type ArrayEveryTransformResult<U> =
  | { testResult: true, transformed: U }
  | { testResult: false }
declare global {
  interface Array<T> {

    emptyOrSingleOrThrow(message?: string): Optional<T>

    /**
     * Similar to `every()`, but the predicate returns an optional transformed version of each element. 
     * If every element returns a populated optional, the array of transformed
     * elements is returned. Otherwise `nullopt` is returned.
     */
    everyTransform<U>(predicate: (element: T, index: number) => Optional<U>): Optional<U[]>

    filterTransform<U>(predicate: (element: T, index: number) => Optional<U>): U[]

    get(index: number): Optional<T>;
    /**
     * Keys are used to sort elements into groups, in the order that the keys first appear in the array.
     */
    groupBy<TKey>(keySelector: (element: T, index: number) => TKey): { key: TKey, group: T[] }[]
    /**
     * Like groupBy, but:
     * - empty groups are included for any keys in `requiredKeys` that do not have corresponding elements in the array, and
     * - the returned groups are ordered by the order of `requiredKeys`; 
     *   other groups (with a key *not* in `requiredKeys`) are appended in the order that the keys first appear in the array.
     */
    groupByAtLeast<TKey>(keySelector: (element: T, index: number) => TKey, requiredKeys: Set<TKey>): { key: TKey, group: T[] }[]
    /**
     * Like groupBy, but:
     * - empty groups are included for any keys in `requiredKeys` that do not have corresponding elements in the array, and
     * - returns nullopt if any elements have a key that is not in `requiredKeys`, and
     * - the returned groups are ordered by the order of `requiredKeys`.
     */
    groupByAtMost<TKey>(keySelector: (element: T, index: number) => TKey, requiredKeys: Set<TKey>): Optional<{ key: TKey, group: T[] }[]>
    /**
     * Like groupBy, but:
     * - returns nullopt if any keys in `requiredKeys` do not have a corresponding element in the array, and
     * - returns nullopt if any elements have a key that is not in `requiredKeys`, and
     * - the returned groups are ordered by the order of `requiredKeys`.
     */
    groupByExactly<TKey>(keySelector: (element: T, index: number) => TKey, requiredKeys: Set<TKey>): Optional<{ key: TKey, group: T[] }[]>

    /**
     * Splits the array into arrays of the specified size, grouping adjacent elements.
     * The last subarray may be smaller than the specified size if the array 
     * could not be evenly divided.
     * 
     * e.g. `[1, 2, 3, 4, 5, 6, 7].groupwise(3)` returns `[[1, 2, 3], [4, 5, 6], [7]]`
     */
    groupwise(groupSize: number): T[][]

    indexed(): [T, number][]

    padLeft(args: { toLength: number, getPadElement: (i: number) => T }): T[]
    padRight(args: { toLength: number, getPadElement: (i: number, arrayIndex: number) => T }): T[]

    permute(): T[][]

    pop_(index?: Optional<number>): Optional<T>;

    /**
     * Enumerates the array starting from `start` and looping around until `start` is reached again.
     * 
     * Equivalent to arr.skip(start).concat(arr.take(start)).
     * 
     * e.g. `[2, 4, 6, 8, 10].rotate(2)` returns `[6, 8, 10, 2, 4]`
     */
    rotate(start: number): T[],

    /**
     * Splits the array into two arrays `[trues, falses]` using the predicate.
     * The first array contains elements that predicate returned `true` for,
     * and the second array has the `false` elements.
     * 
     * Stable: order of elements is maintained.
     */
    split(predicate: (element: T, index: number) => boolean): [T[], T[]]
    splitMap<U>(predicate: (element: T, index: number) => [boolean, U]): [U[], U[]]

    shallowCopy(): T[]

    skip(count: number): T[]
    take(count: number): T[]
    take1(): [Optional<T>]
    take2(): [Optional<T>, Optional<T>]
    take3(): [Optional<T>, Optional<T>, Optional<T>]

    /**
     * Like zip, but extra elements are dropped if one of the arrays is bigger than the other.
     */
    takeZip<U>(other: U[]): [T, U][]
    zip<U>(other: U[]): [T, U][] | undefined
  }
}

Array.prototype.emptyOrSingleOrThrow = function <T>(this: T[], message: string = "too many elements") {
  const [v0, v1] = this.take2();
  if (v1.hasValue) throw message;
  return v0;
}

Array.prototype.everyTransform = function <T, U>(this: T[], predicate: (element: T, index: number) => Optional<U>) {
  const transformeds = this.filterTransform((x, i) => predicate(x, i));
  if (transformeds.length == this.length) {
    return opt(transformeds);
  } else {
    return nullopt;
  }
}

Array.prototype.filterTransform = function <T, U>(this: T[], predicate: (element: T, index: number) => Optional<U>) {
  const transformeds: U[] = [];
  this.forEach((x, i) => {
    const predicateResult = predicate(x, i);
    if (predicateResult.hasValue == true) {
      transformeds.push(predicateResult.value);
    }
  });
  return transformeds;
}

Array.prototype.get = function <T>(this: T[], index: number): Optional<T> {
  if (index < 0 || index >= this.length) {
    return nullopt;
  }

  // scary nonnull assertion! but removing the `| undefined` caused by index out of bounds is the whole point of this function.
  return opt(this[index]!);
};

Array.prototype.groupBy = function <T, TKey>(this: T[], keySelector: (element: T, index: number) => TKey) {
  return this.groupByAtLeast(keySelector, new Set<TKey>());
}
Array.prototype.groupByAtLeast = function <T, TKey>(this: T[], keySelector: (element: T, index: number) => TKey, requiredKeys: Set<TKey>) {
  const groups = new Map<TKey, T[]>([...requiredKeys.values()].map(key => [key, []]));
  this.forEach((x, i) => {
    const key = keySelector(x, i);
    const matchingGroup = groups.get(key);
    if (matchingGroup === undefined) {
      groups.set(key, [x]);
    } else {
      matchingGroup.push(x);
    }
  });
  return [...groups.entries()].map(([key, group]) => ({ key, group }));
}
Array.prototype.groupByAtMost = function <T, TKey>(this: T[], keySelector: (element: T, index: number) => TKey, requiredKeys: Set<TKey>) {
  const result = this.groupByAtLeast(keySelector, requiredKeys);
  if (result.length != requiredKeys.size) return nullopt;
  else return opt(result);
}
Array.prototype.groupByExactly = function <T, TKey>(this: T[], keySelector: (element: T, index: number) => TKey, requiredKeys: Set<TKey>) {
  return optBind(
    this.groupByAtMost(keySelector, requiredKeys),
    result => {
      if (result.some(g => g.group.length == 0)) return nullopt;
      else return opt(result);
    }
  );
}

Array.prototype.groupwise = function <T>(this: T[], groupSize: number) {
  const groups: T[][] = [];
  this.forEach((x, i) => {
    const lastGroup = groups[groups.length - 1];
    if (i % groupSize == 0) {
      groups.push([x]);
    } else if (lastGroup === undefined) {
      console.log(`groupwise forEach did not start at i=0: ${i}`);
      console.trace();
    } else {
      lastGroup.push(x);
    }
  });
  return groups;
}

Array.prototype.indexed = function <T>(this: T[]) {
  return this.map((x, i) => [x, i]);
}

Array.prototype.padLeft = function <T>(this: T[], args: { toLength: number, getPadElement: (i: number) => T }) {
  if (this.length >= args.toLength) return this;
  else return (
    Array(args.toLength - this.length).fill(0)
      .map(i => args.getPadElement(i))
      .concat(this)
  );
}
Array.prototype.padRight = function <T>(this: T[], args: { toLength: number, getPadElement: (i: number, arrayIndex: number) => T }) {
  if (this.length >= args.toLength) return this;
  else return (
    this.concat(
      Array(args.toLength - this.length).fill(0)
        .map(i => args.getPadElement(i, this.length + i))
    )
  );
}

Array.prototype.permute = function <T>(this: T[]) {
  const results: T[][] = [];

  function backtrack(path: T[], remaining: T[]) {
    if (remaining.length === 0) {
      results.push([...path]);
      return;
    }

    remaining.forEach((x, i) => {
      path.push(x);
      const nextRemaining = remaining.slice(0, i).concat(remaining.slice(i + 1));
      backtrack(path, nextRemaining);
      path.pop();
    });
  }

  backtrack([], this);
  return results;
}

Array.prototype.pop_ = function <T>(this: T[], index: Optional<number> = nullopt): Optional<T> {
  const index_ = optValueOr(index, this.length - 1);
  if (index_ < 0 || index_ >= this.length) {
    return nullopt;
  }
  // scary nonnull assertion! but removing the `| undefined` caused by index out of bounds is the whole point of this function.
  return opt(this.splice(index_, 1)[0]!);
}

Array.prototype.rotate = function <T>(this: T[], start: number): T[] {
  return this.skip(start).concat(this.take(start));
}

Array.prototype.shallowCopy = function <T>(this: T[]) {
  return [...this];
}

Array.prototype.splitMap = function <T, U>(this: T[], predicate: (element: T, index: number) => [boolean, U]) {
  const trues: U[] = [];
  const falses: U[] = [];
  this.forEach((x, i) => {
    const [trueFalse, obj] = predicate(x, i);
    if (trueFalse) {
      trues.push(obj)
    } else {
      falses.push(obj)
    }
  });
  return [trues, falses];
}
Array.prototype.split = function <T>(this: T[], predicate: (element: T, index: number) => boolean) {
  return this.splitMap((x, i) => [predicate(x, i), x]);
}

Array.prototype.skip = function <T>(this: T[], count: number) {
  return this.slice(count);
}
Array.prototype.take = function <T>(this: T[], count: number) {
  return this.slice(0, count);
}
Array.prototype.take1 = function <T>(this: T[]): [Optional<T>] {
  return [this.get(0)];
}
Array.prototype.take2 = function <T>(this: T[]): [Optional<T>, Optional<T>] {
  return [this.get(0), this.get(1)];
}
Array.prototype.take3 = function <T>(this: T[]): [Optional<T>, Optional<T>, Optional<T>] {
  return [this.get(0), this.get(1), this.get(2)];
}

Array.prototype.takeZip = function <T, U>(this: T[], other: U[]) {
  return this.filterTransform((x, i) => {
    const y = other[i];
    if (y === undefined) return nullopt;
    return opt([x, y]);
  });
}
Array.prototype.zip = function <T, U>(this: T[], other: U[]) {
  if (this.length !== other.length) {
    return undefined;
  }
  return this.takeZip(other);
}