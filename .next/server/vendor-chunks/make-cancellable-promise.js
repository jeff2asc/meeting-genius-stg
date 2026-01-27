"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/make-cancellable-promise";
exports.ids = ["vendor-chunks/make-cancellable-promise"];
exports.modules = {

/***/ "(ssr)/./node_modules/make-cancellable-promise/dist/cjs/index.js":
/*!*****************************************************************!*\
  !*** ./node_modules/make-cancellable-promise/dist/cjs/index.js ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, exports) => {

eval("\nObject.defineProperty(exports, \"__esModule\", ({ value: true }));\nfunction makeCancellablePromise(promise) {\n    var isCancelled = false;\n    var wrappedPromise = new Promise(function (resolve, reject) {\n        promise\n            .then(function (value) { return !isCancelled && resolve(value); })\n            .catch(function (error) { return !isCancelled && reject(error); });\n    });\n    return {\n        promise: wrappedPromise,\n        cancel: function () {\n            isCancelled = true;\n        },\n    };\n}\nexports[\"default\"] = makeCancellablePromise;\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvbWFrZS1jYW5jZWxsYWJsZS1wcm9taXNlL2Rpc3QvY2pzL2luZGV4LmpzIiwibWFwcGluZ3MiOiJBQUFhO0FBQ2IsOENBQTZDLEVBQUUsYUFBYSxFQUFDO0FBQzdEO0FBQ0E7QUFDQTtBQUNBO0FBQ0EscUNBQXFDLHdDQUF3QztBQUM3RSxzQ0FBc0MsdUNBQXVDO0FBQzdFLEtBQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVM7QUFDVDtBQUNBO0FBQ0Esa0JBQWUiLCJzb3VyY2VzIjpbIkM6XFxVc2Vyc1xcSmVmZiBEb21pbmdvXFxWaWRlb3NcXG1lZXRpbmctZ2VuaXVzXFxub2RlX21vZHVsZXNcXG1ha2UtY2FuY2VsbGFibGUtcHJvbWlzZVxcZGlzdFxcY2pzXFxpbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJcInVzZSBzdHJpY3RcIjtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcbmZ1bmN0aW9uIG1ha2VDYW5jZWxsYWJsZVByb21pc2UocHJvbWlzZSkge1xuICAgIHZhciBpc0NhbmNlbGxlZCA9IGZhbHNlO1xuICAgIHZhciB3cmFwcGVkUHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgcHJvbWlzZVxuICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24gKHZhbHVlKSB7IHJldHVybiAhaXNDYW5jZWxsZWQgJiYgcmVzb2x2ZSh2YWx1ZSk7IH0pXG4gICAgICAgICAgICAuY2F0Y2goZnVuY3Rpb24gKGVycm9yKSB7IHJldHVybiAhaXNDYW5jZWxsZWQgJiYgcmVqZWN0KGVycm9yKTsgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcHJvbWlzZTogd3JhcHBlZFByb21pc2UsXG4gICAgICAgIGNhbmNlbDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaXNDYW5jZWxsZWQgPSB0cnVlO1xuICAgICAgICB9LFxuICAgIH07XG59XG5leHBvcnRzLmRlZmF1bHQgPSBtYWtlQ2FuY2VsbGFibGVQcm9taXNlO1xuIl0sIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6WzBdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/make-cancellable-promise/dist/cjs/index.js\n");

/***/ })

};
;