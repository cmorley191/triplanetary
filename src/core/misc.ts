import { nullopt, opt, Optional, optValueOr } from "./optional";

export function satisfiesCheck<AssertType>(_checkValue: AssertType): <ReturnType>(returnValue: ReturnType) => ReturnType {
  return (returnValue) => returnValue;
}

export function assertType<AssertType>(x: AssertType): AssertType {
  return x;
}

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

export function weightedRandom(weights: number[]): number {
  const sum = weights.reduce((a, b) => a + b);
  if (sum <= 0 || weights.some(x => x < 0)) return getRandomInt(weights.length);
  let v = Math.random() * sum;
  return optValueOr(
    weights.reduce(
      (chosen, w, i) => {
        if (chosen.hasValue) return chosen;
        v -= w;
        if (v <= 0) return opt(i);
        else return nullopt;
      },
      nullopt as Optional<number>
    ),
    weights.length - 1
  )
}