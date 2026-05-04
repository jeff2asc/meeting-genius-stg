/**
 * Node.js < 22 Polyfills
 * This ensures modern features like Promise.withResolvers are available
 * on older server environments.
 */

if (typeof Promise.withResolvers === 'undefined') {
  console.log("🔧 Applying Promise.withResolvers polyfill...");
  (Promise as any).withResolvers = function <T>() {
    let resolve: (value: T | PromiseLike<T>) => void;
    let reject: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve: resolve!, reject: reject! };
  };
}
