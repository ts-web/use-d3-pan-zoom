/* eslint-disable */
// https://github.com/observablehq/stdlib/blob/6ad71d98c4362d71e086fd5a0b5f97128cb9d906/src/dom/uid.js

var count = 0;

export function uid (name: string) {
  // @ts-ignore
  return new Id('O-' + (name == null ? '' : name + '-') + ++count);
}

function Id (this: any, id: string) {
  this.id = id;
  this.href = new URL(`#${id}`, String(location)) + '';
}

Id.prototype.toString = function() {
  return 'url(' + this.href + ')';
};

export default {
  uid,
};
