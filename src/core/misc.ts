import { nullopt, nullopt_, opt, Optional, optValueOr, throwOnNullopt } from "./optional";

/**
 * Does nothing / passthrough at runtime. Causes a compile error (assuming strict mode) if the passed in value is not of the specified type.
 *
 * Useful for pinning an object's type, in case changes in other parts of the code change its type without you realizing 
 * (e.g. adding an enum member might change the final case in an if-chain from `MyEnum.LastRemainingValue` to include `| MyEnum.NewUnhandledValue`
 * without either writer realizing they need to handle a new case).
 */
export function satisfiesCheck<AssertType>(_checkValue: AssertType): <ReturnType>(returnValue: ReturnType) => ReturnType {
  return returnValue => returnValue;
}
/**
 * Like satisfiesCheck, but the same value is being checked and returned, whereas satisfiedCheck can check one value and return another.
 */
export function assertType<AssertType>(x: AssertType): AssertType {
  return x;
}

/**
 * Constraining a type that might be automatically broadened by the compiler when you don't want it to.
 * e.g. Force a type alias to show up instead of the raw type, or prevent a tuple type from from automatically being inferred as an array type.
 */
export function asType<T>(): <U extends T>(x: U) => T {
  return x => x;
}

export type ElementTypeOf<TArray> = TArray extends (infer TElement)[] ? TElement : never;
export type Element2TypeOf<TArray> = TArray extends (infer TElement)[][] ? TElement : never;

/**
 * Returns a copy of the given object with the specified keys removed (if they are present).
 * 
 * @param omit key names to omit in the copy of `obj`
 * @param obj object to copy
 * @returns copy of `obj`, without any of the keys that appear in `omit`
 */
export function omitAttrs(omit: string[], obj: any): { [otherOptions: string]: unknown } {
  const result: any = {};
  Object.keys(obj).forEach((key) => {
    if (omit.indexOf(key) < 0) {
      result[key] = obj[key];
    }
  });
  return result;
}

/**
 * Returns a random integer between 0 (inclusive) and the provided maximum (exclusive).
 * 
 * @param max integer upper bound of integers that could be returned; 
 *            this maximum value will not be returned (exclusive)
 * @returns random integer between [0, `max`)
 */
export function getRandomInt(max: number) {
  return Math.floor(Math.random() * max);
}

/**
 * Returns the min and max of the given numbers.
 */
export function minmax(a: number, b: number): { min: number, max: number } {
  if (a <= b) return { min: a, max: b };
  else return { min: b, max: a };
}

export function* unionGeneratorElement<T1, T2, U, V>(g: Generator<T1, U, V> | Generator<T2, U, V>): Generator<T1 | T2, U, V> {
  const firstElement = g.next();
  if (firstElement.done) {
    return firstElement.value;
  }
  let n = yield firstElement.value;
  while (true) {
    const element = g.next(n);
    if (element.done) {
      return element.value;
    }
    n = yield element.value;
  }
}

export function* unionGeneratorReturn<T, U1, U2, V>(g: Generator<T, U1, V> | Generator<T, U2, V>): Generator<T, U1 | U2, V> {
  const firstElement = g.next();
  if (firstElement.done) {
    return firstElement.value;
  }
  let n = yield firstElement.value;
  while (true) {
    const element = g.next(n);
    if (element.done) {
      return element.value;
    }
    n = yield element.value;
  }
}

export function* unionGenerator2<T1, T2, U1, U2, V>(g: Generator<T1, U1, V> | Generator<T2, U2, V>): Generator<T1 | T2, U1 | U2, V> {
  const firstElement = g.next();
  if (firstElement.done) {
    return firstElement.value;
  }
  let n = yield firstElement.value;
  while (true) {
    const element = g.next(n);
    if (element.done) {
      return element.value;
    }
    n = yield element.value;
  }
}
export function* unionGenerator3<T1, T2, T3, U1, U2, U3, V>(g: Generator<T1, U1, V> | Generator<T2, U2, V> | Generator<T3, U3, V>): Generator<T1 | T2 | T3, U1 | U2 | U3, V> {
  const firstElement = g.next();
  if (firstElement.done) {
    return firstElement.value;
  }
  let n = yield firstElement.value;
  while (true) {
    const element = g.next(n);
    if (element.done) {
      return element.value;
    }
    n = yield element.value;
  }
}

export function mixGeneratorElement<T1, T2, U1, U2, V>(g: Generator<T1, U1, V> | Generator<T2, U2, V>): Generator<T1 | T2, U1, V> | Generator<T1 | T2, U2, V> {
  return g;
}

export function mixGeneratorReturn<T1, T2, U1, U2, V>(g: Generator<T1, U1, V> | Generator<T2, U2, V>): Generator<T1, U1 | U2, V> | Generator<T2, U1 | U2, V> {
  return g;
}

/**
 * Iterates a generator into a list, but also includes the final return value, not just the elements.
 */
export function fullyUnpackGenerator<T, U>(g: Generator<T, U, void>): (T | U)[] {
  const elements: (T | U)[] = [];
  while (true) {
    const element = g.next();
    if (element.done === true) {
      if (element.value === undefined) {
        return elements;
      }
    }
    elements.push(element.value);
    if (element.done === true) {
      return elements;
    }
  }
}

/**
 * Returns a random index of the given weight array (randomly selected via those weights).
 * nullopt is returned if empty list.
 * Negative weights are treated as zero.
 * Index chosen uniformly if all zero weights.
 */
export function weightedRandom(weights: number[]): Optional<number> {
  if (weights.length == 0) return nullopt;
  const positiveIndices = weights.filterTransform((w, i) => w > 0 ? opt(i) : nullopt);
  const defaultResult = positiveIndices.get(positiveIndices.length - 1);
  if (!defaultResult.hasValue) return opt(getRandomInt(weights.length));
  const nonNegativeWeights = weights.map(w => w < 0 ? 0 : w);
  let v = Math.random() * nonNegativeWeights.reduce((a, b) => a + b);
  return opt(
    optValueOr(
      nonNegativeWeights.reduce(
        (chosen, w, i) => {
          if (chosen.hasValue) return chosen;
          v -= w;
          if (v <= 0) return opt(i);
          else return nullopt;
        },
        nullopt_<number>()
      ),
      defaultResult.value
    )
  );
}

export function lerp(a: number, b: number, t: number) {
  return (b - a) * t + a;
}

export function tuple2<T, U>(t: [T, U]): [T, U] { return t; }
export function tuple3<T, U, V>(t: [T, U, V]): [T, U, V] { return t; }

export function map2<T, U>(arr: [T, T], mapper: (value: T, index: 0 | 1) => U): [U, U] {
  return [mapper(arr[0], 0), mapper(arr[1], 1)];
}
export function map3<T, U>(arr: [T, T, T], mapper: (value: T, index: 0 | 1 | 2) => U): [U, U, U] {
  return [mapper(arr[0], 0), mapper(arr[1], 1), mapper(arr[2], 2)];
}

/**
 * Like zipAll, but extra elements are dropped if some of the arrays are bigger than others.
 */
export function takeZipAll<T>(...arrs: T[][]): T[][] {
  if (arrs.length === 0) return [];
  const minLength = Math.min(...arrs.map(arr => arr.length));
  return Array(minLength).fill(false).map((_, i) => arrs.map(arr => throwOnNullopt(arr.get(i), "takeZipAll limited index impossibility")));
}
/**
 * Like zip, but accepts an arbitrary number of arrays to zip together.
 */
export function zipAll<T>(...arrs: T[][]): Optional<T[][]> {
  const [firstArr] = arrs.take1();
  if (!firstArr.hasValue) return nullopt;
  if (arrs.some(arr => arr.length != firstArr.value.length)) return nullopt;
  return opt(takeZipAll(...arrs));
}