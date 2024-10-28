import type { Field } from "./Field.ts";

export class Card {
  fields: Array<Field>;

  constructor(fields: Array<Field>) {
    this.fields = fields;
  }
}
